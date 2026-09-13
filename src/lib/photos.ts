// 进度照片存 IndexedDB（Blob 容量远大于 localStorage）。照片不进 JSON 备份，仅本机。
const DB_NAME = 'fitness-photos'
const STORE = 'photos'
const VERSION = 1

export type StoredPhoto = {
  id: string
  date: string
  createdAt: number
  blob: Blob
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('date', 'date')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// 关键：必须在事务 oncomplete 后才算写入成功（quota/IO 错误在请求 onsuccess 之后仍会 abort）
function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        t.oncomplete = () => {
          db.close()
          resolve(req.result)
        }
        t.onabort = t.onerror = () => {
          db.close()
          reject(t.error ?? req.error)
        }
      }),
  )
}

export async function listPhotos(): Promise<StoredPhoto[]> {
  const all = await tx<StoredPhoto[]>('readonly', (store) => store.getAll() as IDBRequest<StoredPhoto[]>)
  return all.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
}

export async function putPhoto(photo: StoredPhoto): Promise<void> {
  await tx('readwrite', (store) => store.put(photo) as IDBRequest<IDBValidKey>)
}

export async function deletePhoto(id: string): Promise<void> {
  await tx('readwrite', (store) => store.delete(id) as IDBRequest<undefined>)
}

export const newPhotoId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `photo_${Date.now()}_${Math.random().toString(36).slice(2)}`

// ===== 备份：照片 ↔ dataURL（JSON 可携带）=====

export type PhotoBackup = {
  id: string
  date: string
  createdAt: number
  mime: string
  dataUrl: string
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl)
  if (!m) return null
  try {
    const binary = atob(m[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: m[1] })
  } catch {
    return null
  }
}

export async function exportPhotosForBackup(): Promise<PhotoBackup[]> {
  const all = await listPhotos()
  const out: PhotoBackup[] = []
  for (const p of all) {
    try {
      out.push({ id: p.id, date: p.date, createdAt: p.createdAt, mime: p.blob.type || 'image/jpeg', dataUrl: await blobToDataUrl(p.blob) })
    } catch {
      /* 读不出来的照片跳过，不阻断备份 */
    }
  }
  return out
}

// 真实日历日校验（2026-02-31 这类值拒绝）
function isValidDateStr(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export type RestoreResult = { restored: number; skipped: number }

// 恢复照片：先校验+解码全部条目，再在同一事务内清空+写入（语义=覆盖）。
// dataUrl 上限对齐 image.ts 的 20MB 原图（base64 约 ×1.34）。
// 没有任何合法条目时不动现有照片库。
export async function restorePhotos(items: unknown): Promise<RestoreResult> {
  if (!Array.isArray(items)) return { restored: 0, skipped: 0 }
  const ready: StoredPhoto[] = []
  let skipped = 0
  for (const raw of items) {
    const x = raw as Record<string, unknown>
    if (
      !x || typeof x !== 'object' ||
      typeof x.id !== 'string' ||
      !isValidDateStr(x.date) ||
      typeof x.createdAt !== 'number' ||
      typeof x.dataUrl !== 'string' ||
      x.dataUrl.length > 28_000_000
    ) {
      skipped++
      continue
    }
    const blob = dataUrlToBlob(x.dataUrl)
    if (!blob) {
      skipped++
      continue
    }
    ready.push({ id: x.id, date: x.date, createdAt: x.createdAt, blob })
  }
  if (ready.length === 0) return { restored: 0, skipped }

  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite')
    const store = t.objectStore(STORE)
    store.clear()
    for (const photo of ready) store.put(photo)
    t.oncomplete = () => {
      db.close()
      resolve()
    }
    t.onabort = t.onerror = () => {
      db.close()
      reject(t.error)
    }
  })
  return { restored: ready.length, skipped }
}
