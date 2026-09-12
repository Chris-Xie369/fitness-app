import { useEffect, useState } from 'react'
import type { Workout } from '../types'

const WEEKDAYS = '日一二三四五六'

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Number(dateStr.slice(0, 4)), m - 1, d)
  return `${m} 月 ${d} 日 · 周${WEEKDAYS[dt.getDay()]}`
}

export function HistoryTab({ workouts, onDelete, onBack }: { workouts: Workout[]; onDelete: (id: string) => void; onBack: () => void }) {
  // 二次确认：一天的卡片现在包含当天全部动作，误删损失大。第一次点只进入确认态，4 秒不操作自动复位
  const [confirmId, setConfirmId] = useState<string | null>(null)
  useEffect(() => {
    if (!confirmId) return
    const t = setTimeout(() => setConfirmId(null), 4000)
    return () => clearTimeout(t)
  }, [confirmId])

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
    </div>
  )
}
