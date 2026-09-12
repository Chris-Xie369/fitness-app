import { useEffect, useState } from 'react'
import type { Workout } from '../types'
import { computeStreak, todayStr, weekStatus } from '../lib/streak'

const WEEKDAYS = '日一二三四五六'

type LastAdded = { at: number; appended: boolean; count: number; date: string }

export function TodayTab({
  workouts,
  lastAdded,
  onGoRecord,
  onGoHistory,
}: {
  workouts: Workout[]
  lastAdded: LastAdded | null
  onGoRecord: () => void
  onGoHistory: () => void
}) {
  const today = todayStr()
  const todayWorkout = workouts.find((w) => w.date === today)
  const streak = computeStreak(workouts)
  const week = weekStatus(workouts)
  const now = new Date()
  const dateLabel = `${now.getMonth() + 1} 月 ${now.getDate()} 日 · 周${WEEKDAYS[now.getDay()]}`

  // 刚保存完：提示成功，并把新动作（列表最后一条）滚动到可见位置
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    // 补记过去日的保存不在今天页反馈（历史页有自己的确认）
    if (!lastAdded || lastAdded.date !== today) return
    setToast(lastAdded.appended ? `已追加 ${lastAdded.count} 个动作到今天的训练` : '打卡成功，开练！')
    document.querySelector('main ul li:last-child')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [lastAdded, today])

  return (
    <div className="px-7 pt-16 pb-10">
      {toast && (
        <div className="sticky top-3 z-30 flex justify-center pointer-events-none">
          <span className="rounded-full bg-ink/90 text-paper text-[13px] px-4 py-1.5 shadow-lg">{toast}</span>
        </div>
      )}

      <p className="font-display text-[13px] italic text-muted text-center">{dateLabel}</p>
      <h1 className="font-display text-[28px] leading-none mt-1 text-ink text-center">健身打卡</h1>

      <div className="mt-6 rounded-2xl bg-surface border border-line p-6 text-center">
        <p className="font-display text-[15px] text-muted">连续坚持</p>
        <p className="font-display text-[56px] leading-none mt-1 text-clay">{streak}</p>
        <p className="text-[13px] text-muted mt-1">天</p>
        <p className={`mt-4 text-[14px] ${todayWorkout ? 'text-clay' : 'text-muted'}`}>
          {todayWorkout ? '今天已打卡' : '今天还没打卡'}
        </p>

      <div className="mt-5 flex justify-center gap-3">
        {week.map((done, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-muted">{'一二三四五六日'[i]}</span>
            <span className={`h-2.5 w-2.5 rounded-full ${done ? 'bg-clay' : 'bg-line'}`} />
          </div>
        ))}
      </div>  
      </div>

      {todayWorkout && (
        <div className="mt-5">
          <p className="font-display text-[13px] italic text-muted mb-2">今日训练</p>
          <ul className="space-y-2">
            {todayWorkout.exercises.map((ex, i) => (
              <li key={i} className="rounded-xl bg-surface border border-line px-4 py-3">
                <p className="text-[15px] text-ink">{ex.name}</p>
                <p className="text-[13px] text-muted mt-0.5">
                  {ex.sets.map((s) => (s.weight ? `${s.reps}×${s.weight}kg` : `${s.reps}次`)).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onGoRecord}
        className="mt-6 w-full py-3 rounded-xl bg-clay text-white font-medium hover:bg-clay/90 active:scale-[0.98] transition"
      >
        {todayWorkout ? '再记一次' : '记录今天的训练'}
      </button>

      <button
        onClick={onGoHistory}
        className="mt-3 w-full py-3 rounded-xl border border-line text-[14px] text-muted hover:text-clay hover:border-clay/40 transition"
      >
        📅 查看全部历史 ›
      </button>
    </div>
  )
}
