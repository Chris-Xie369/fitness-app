import type { Workout } from '../types'

// 把日期转成"天数整数"（按自然天，方便比较）
function toDayStamp(date: Date): number {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor(d.getTime() / 86400000)
}

// 计算连续打卡天数：今天练了就从今天起，否则若昨天练了从昨天起，再往前数连续天数
export function computeStreak(workouts: Workout[]): number {
  if (workouts.length === 0) return 0
  const days = new Set(
    workouts.map((w) => {
      const [y, m, d] = w.date.split('-').map(Number)
      return toDayStamp(new Date(y, m - 1, d))
    })
  )
  const today = toDayStamp(new Date())
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

// 今天的日期字符串 'YYYY-MM-DD'（本地时区）
export function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 返回本周（周一~周日）7 天的打卡情况：true = 当天有训练
export function weekStatus(workouts: Workout[]): boolean[] {
  const now = new Date()
  const day = now.getDay() // 0=周日, 1=周一 ... 6=周六
  const offsetToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetToMonday)
  const doneDates = new Set(workouts.map((w) => w.date))
  const result: boolean[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    result.push(doneDates.has(key))
  }
  return result
}
