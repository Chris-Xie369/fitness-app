import type { Workout } from '../types'
import { addDays, dateKey, dayNumber, mondayOf, parseDateKey } from './date'

// 计算连续打卡天数：今天练了就从今天起，否则若昨天练了从昨天起，再往前数连续天数（now 可注入便于测试）
export function computeStreak(workouts: Workout[], now = new Date()): number {
  if (workouts.length === 0) return 0
  const days = new Set(
    workouts.map((w) => {
      return dayNumber(parseDateKey(w.date))
    })
  )
  const today = dayNumber(now)
  const yesterday = today - 1

  let cursor = days.has(today) ? today : days.has(yesterday) ? yesterday : -1
  if (cursor === -1) return 0

  let streak = 0
  while (days.has(cursor)) {
    streak++
    cursor--
  }
  return streak
}

// 返回本周（周一~周日）7 天的打卡情况：true = 当天有训练
export function weekStatus(workouts: Workout[], now = new Date()): boolean[] {
  const monday = mondayOf(now)
  const doneDates = new Set(workouts.map((w) => w.date))
  return Array.from({ length: 7 }, (_, i) => doneDates.has(dateKey(addDays(monday, i))))
}
