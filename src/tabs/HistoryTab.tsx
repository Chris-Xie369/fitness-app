import { useEffect, useRef, useState } from 'react'
import type { Workout } from '../types'
import type { BackupData } from '../storage'
import { exportBackup, parseBackup } from '../storage'

const WEEKDAYS = '日一二三四五六'

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Number(dateStr.slice(0, 4)), m - 1, d)
  return `${m} 月 ${d} 日 · 周${WEEKDAYS[dt.getDay()]}`
}

function todayStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function HistoryTab({
  workouts,
  onDelete,
  onBack,
  onImport,
}: {
  workouts: Workout[]
  onDelete: (id: string) => void
  onBack: () => void
  onImport: (data: BackupData) => void
}) {
  // 二次确认：一天的卡片现在包含当天全部动作，误删损失大。第一次点只进入确认态，4 秒不操作自动复位
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [pending, setPending] = useState<BackupData | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 删除确认态 4 秒不操作自动复位
  useEffect(() => {
    if (!confirmId) return
    const t = setTimeout(() => setConfirmId(null), 4000)
    return () => clearTimeout(t)
  }, [confirmId])

  async function doExport() {
    const fileName = `fitness-backup-${todayStamp()}.json`
    const file = new File([exportBackup()], fileName, { type: 'application/json' })
    // iPhone 主屏幕 PWA 里 blob 下载会静默失败：优先系统分享（可存到「文件」/微信/网盘）
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: '健身打卡数据备份' })
        setMsg('备份已分享，请保存到安全的地方（文件/微信/网盘）')
      } catch {
        /* 用户取消分享，不提示成功 */
      }
      return
    }
    const url = URL.createObjectURL(new Blob([file], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMsg('备份文件已导出，请保存到安全的地方（文件/微信/网盘）')
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许再次选同一个文件
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const data = parseBackup(String(reader.result ?? ''))
      if (!data) {
        setPending(null)
        setMsg('文件无法识别，请选择本 App 导出的备份文件')
        return
      }
      setMsg(null)
      setPending(data)
    }
    reader.readAsText(file)
  }

  function confirmImport() {
    if (!pending) return
    onImport(pending)
    setMsg(`导入成功：${pending.workouts.length} 天训练 · ${pending.body.length} 条体重 · ${pending.meals.length} 条饮食`)
    setPending(null)
  }

  return (
    <div className="relative px-7 pt-16 pb-10">
      <button onClick={onBack} className="absolute left-6 top-[54px] text-[15px] text-muted hover:text-clay transition">‹ 返回</button>
      <h1 className="font-display text-[28px] text-ink text-center">历史</h1>

      {workouts.length === 0 ? (
        <p className="mt-12 text-center text-[14px] text-muted">还没有记录。去「记录」页练一次吧。</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {workouts.map((w) => (
            <li key={w.id} className="rounded-2xl bg-surface border border-line p-4">
              <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-[15px] text-ink">{formatDate(w.date)}</p>
                <p className="text-[12px] text-muted mt-0.5">
                  {w.exercises.length} 个动作 · {w.exercises.reduce((n, ex) => n + ex.sets.length, 0)} 组
                </p>
              </div>
              {confirmId === w.id ? (
                <span className="flex items-center gap-2 text-[12px] whitespace-nowrap">
                  <button onClick={() => onDelete(w.id)} className="text-clay">确认删除？</button>
                  <button onClick={() => setConfirmId(null)} className="text-muted/60">取消</button>
                </span>
              ) : (
                <button onClick={() => setConfirmId(w.id)} className="text-muted/50 hover:text-clay text-sm">删除</button>
              )}
              </div>
              <div className="mt-2 h-px bg-line" />
              <ul className="mt-2 space-y-1">
                {w.exercises.map((ex, i) => (
                  <li key={i} className="text-[14px] text-ink">
                    {ex.name}
                    <span className="text-muted"> — {ex.sets.map((s) => (s.weight ? `${s.reps}×${s.weight}kg` : `${s.reps}次`)).join('、')}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {/* 数据管理：localStorage 换机/清缓存即丢，定期导出留个安全网 */}
      <div className="mt-8 rounded-2xl bg-surface border border-line p-4">
        <p className="font-display text-[13px] italic text-muted mb-1">数据管理</p>
        <p className="text-[12px] text-muted leading-relaxed">数据只存在这台手机上，换手机或清缓存前请先导出备份。</p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => void doExport()} className="flex-1 py-2.5 rounded-xl border border-line text-[13px] text-ink hover:border-clay/40 hover:text-clay transition">
            导出备份
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex-1 py-2.5 rounded-xl border border-line text-[13px] text-ink hover:border-clay/40 hover:text-clay transition">
            导入恢复
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} className="hidden" />
        </div>

        {pending && (
          <div className="mt-3 rounded-xl bg-paper border border-clay/30 p-3 text-[12px]">
            <p className="text-ink">
              将用备份覆盖当前全部数据：{pending.workouts.length} 天训练 · {pending.body.length} 条体重 · {pending.meals.length} 条饮食
            </p>
            <div className="mt-2 flex gap-2">
              <button onClick={confirmImport} className="px-3 py-1.5 rounded-lg bg-clay text-white">确认导入</button>
              <button onClick={() => setPending(null)} className="px-3 py-1.5 rounded-lg text-muted">取消</button>
            </div>
          </div>
        )}
        {msg && <p className="mt-2 text-[12px] text-muted">{msg}</p>}
      </div>
    </div>
  )
}
