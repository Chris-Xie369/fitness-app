import { useCallback, useEffect, useRef, useState } from 'react'
import { compressImage } from '../lib/image'
import { deletePhoto, listPhotos, newPhotoId, putPhoto, type StoredPhoto } from '../lib/photos'
import { todayStr } from '../lib/streak'

function hhmm(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function ProgressPhotos() {
  const [photos, setPhotos] = useState<StoredPhoto[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try {
      setPhotos(await listPhotos())
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (confirmDelete === null) return
    const t = setTimeout(() => setConfirmDelete(null), 3000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  // Blob URL 生命周期：照片变化时重建，卸载时释放
  useEffect(() => {
    const next: Record<string, string> = {}
    for (const p of photos) next[p.id] = URL.createObjectURL(p.blob)
    setUrls(next)
    return () => {
      Object.values(next).forEach((u) => URL.revokeObjectURL(u))
    }
  }, [photos])

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setSaveError(false)
    try {
      const blob = await compressImage(file)
      if (!blob) {
        setSaveError(true)
        return
      }
      await putPhoto({ id: newPhotoId(), date: todayStr(), createdAt: Date.now(), blob })
      await refresh()
    } catch {
      // 配额满 / 隐私模式 / IDB 不可用
      setSaveError(true)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      return
    }
    try {
      await deletePhoto(id)
      setPicked((p) => p.filter((x) => x !== id))
      await refresh()
    } catch {
      setSaveError(true)
    }
    setConfirmDelete(null)
  }

  function togglePick(id: string) {
    setPicked((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id)
      if (p.length >= 2) return [p[1], id]
      return [...p, id]
    })
  }

  const sameDayCounts = photos.reduce<Record<string, number>>((m, p) => {
    m[p.date] = (m[p.date] ?? 0) + 1
    return m
  }, {})
  const comparePhotos = picked
    .map((id) => photos.find((p) => p.id === id))
    .filter((p): p is StoredPhoto => !!p)

  return (
    <div className="mt-4 rounded-2xl bg-surface border border-line p-4">
      <div className="flex items-center justify-between">
        <p className="font-display text-[13px] italic text-muted">进度照 · 同光线同姿势对比最准</p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="px-3 py-1.5 rounded-full bg-clay text-white text-[12px] hover:bg-clay/90 active:scale-95 transition disabled:opacity-40"
        >
          {busy ? '处理中…' : '📷 拍照'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={(e) => void onPickFile(e)} className="hidden" />
      </div>

      {saveError && <p className="mt-2 text-[12px] text-clay">照片没存上：存储空间可能已满，或当前环境不支持本地存储。</p>}
      {loadError && <p className="mt-2 text-[12px] text-clay">照片暂时读不出来，重启 App 再试。</p>}

      {photos.length === 0 && !loadError ? (
        <p className="mt-3 text-[12px] text-muted/70">还没有照片。每周固定时间拍一张正面/侧面照，体型变化比体重更诚实。</p>
      ) : photos.length > 0 ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative">
                <button onClick={() => togglePick(p.id)} className="block w-full">
                  <img
                    src={urls[p.id]}
                    alt={p.date}
                    className={`w-full aspect-[3/4] object-cover rounded-lg border-2 transition ${picked.includes(p.id) ? 'border-clay' : 'border-transparent'}`}
                  />
                </button>
                <span className="absolute left-1 top-1 rounded bg-ink/55 px-1 text-[9px] text-white leading-tight text-center">
                  {p.date.slice(5)}
                  {sameDayCounts[p.date] > 1 && <><br />{hhmm(p.createdAt)}</>}
                </span>
                <button
                  onClick={() => void remove(p.id)}
                  aria-label="删除照片"
                  className={`absolute right-1 top-1 h-5 min-w-5 px-1 rounded-full text-[10px] leading-none transition ${confirmDelete === p.id ? 'bg-clay text-white' : 'bg-ink/55 text-white'}`}
                >
                  {confirmDelete === p.id ? '确认?' : '✕'}
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11px] text-muted">点选两张照片{comparePhotos.length ? `（已选 ${comparePhotos.length}/2）` : ''}</p>
            <button
              onClick={() => setComparing(true)}
              disabled={comparePhotos.length !== 2}
              className="text-[12px] text-clay disabled:opacity-30 hover:underline"
            >
              对比 ›
            </button>
          </div>
        </>
      ) : null}
      <p className="mt-3 text-[10px] text-muted/60">照片只存在这台手机上，不包含在导出备份里。</p>

      {/* 双图对比：absolute 限定在手机屏幕容器内 */}
      {comparing && comparePhotos.length === 2 && (
        <div className="absolute inset-0 z-50 bg-ink/85 flex flex-col p-4">
          <div className="flex justify-end">
            <button onClick={() => setComparing(false)} className="h-9 w-9 rounded-full bg-white/15 text-white text-lg">✕</button>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-3 pb-6">
            {comparePhotos.map((p) => (
              <div key={p.id} className="flex flex-col items-center justify-center">
                <img src={urls[p.id]} alt={p.date} className="max-h-full rounded-xl object-contain" />
                <p className="mt-2 text-[12px] text-white/80">{p.date}{sameDayCounts[p.date] > 1 ? ` ${hhmm(p.createdAt)}` : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
