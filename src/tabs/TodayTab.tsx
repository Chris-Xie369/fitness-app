import type { Workout } from '../types'
import { computeStreak, todayStr, weekStatus } from '../lib/streak'

const WEEKDAYS = '日一二三四五六'

export function TodayTab({ workouts, onGoRecord }: { workouts: Workout[]; onGoRecord: () => void }) {
  const today = todayStr()
  const todayWorkout = workouts.find((w) => w.date === today)
  const streak = computeStreak(workouts)
  const week = weekStatus(workouts)
  const now = new Date()
  const dateLabel = `${now.getMonth() + 1} 月 ${now.getDate()} 日 · 周${WEEKDAYS[now.getDay()]}`

  return (
    <div className="px-7 pt-16 pb-10">
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
    </div>
  )
}
