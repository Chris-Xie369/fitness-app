import type { MealEntry, MealType } from '../types'

const WEEKDAYS = '日一二三四五六'

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const MEAL_TYPES: { type: MealType; label: string; emoji: string }[] = [
  { type: 'breakfast', label: '早餐', emoji: '🍳' },
  { type: 'lunch', label: '午餐', emoji: '🍱' },
  { type: 'dinner', label: '晚餐', emoji: '🍲' },
  { type: 'snack', label: '加餐', emoji: '🍎' },
]

export function dayKcal(meals: MealEntry[], date: string): number {
  return meals.reduce((n, m) => (m.date === date ? n + m.kcal : n), 0)
}

export type DayKcal = { date: string; label: string; kcal: number }

// 最近 n 天（含今天）的每日热量，升序，末日 label 用「今」
export function weeklyKcal(meals: MealEntry[], n = 7): DayKcal[] {
  const now = new Date()
  const buckets: DayKcal[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const key = dateKey(d)
    buckets.push({
      date: key,
      label: i === 0 ? '今' : WEEKDAYS[d.getDay()],
      kcal: dayKcal(meals, key),
    })
  }
  return buckets
}

// 日期标签：今天/昨天显示相对说法，其余「M月D日 周X」
export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const base = `${m}月${d}日 周${WEEKDAYS[dt.getDay()]}`
  const today = new Date()
  const key = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  if (date === key(today)) return `今天 · ${base}`
  const yest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (date === key(yest)) return `昨天 · ${base}`
  return base
}

// 前后推 n 天，返回 'YYYY-MM-DD'
export function shiftDate(date: string, deltaDays: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d + deltaDays)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
