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
