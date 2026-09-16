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

// ===== 统计用聚合 =====

// 最近 n 天每日热量（升序），含 0 值（画趋势用）
export function kcalTrend(meals: MealEntry[], n = 30): DayKcal[] {
  return weeklyKcal(meals, n)
}

// 近 n 天里，训练日 vs 休息日的平均摄入（只统计有饮食记录的日子）
export function avgKcalByTraining(
  meals: MealEntry[],
  workoutDates: Set<string>,
  n = 30,
): { trainAvg: number; restAvg: number; trainDays: number; restDays: number } {
  const trend = kcalTrend(meals, n)
  let trainSum = 0, trainN = 0, restSum = 0, restN = 0
  for (const d of trend) {
    if (d.kcal <= 0) continue
    if (workoutDates.has(d.date)) { trainSum += d.kcal; trainN++ }
    else { restSum += d.kcal; restN++ }
  }
  return {
    trainAvg: trainN ? Math.round(trainSum / trainN) : 0,
    restAvg: restN ? Math.round(restSum / restN) : 0,
    trainDays: trainN,
    restDays: restN,
  }
}

// 最近吃过的食物（按名去重，最近优先），用于快捷录入
export function recentMeals(meals: MealEntry[], limit = 6): { name: string; kcal: number }[] {
  const names: { name: string; kcal: number }[] = []
  for (const m of [...meals].sort((a, b) => b.createdAt - a.createdAt)) {
    const name = m.name.trim()
    if (name && !names.some((x) => x.name === name)) names.push({ name, kcal: m.kcal })
  }
  return names.slice(0, limit)
}

// 库外食物的历史估算：从「<名> <克数>g」形态的历史记录反推 kcal/100g（克数来自菜单记录或克数录入）。
// 只采纳基础名完全一致、估算值落在合理区间 [5,900] 的样本；无克数样本返回 null。
const GRAM_SUFFIX = /^(.*?)\s*(\d+(?:\.\d+)?)g$/

export function learnedKcal(meals: MealEntry[], name: string): number | null {
  const base = name.trim()
  if (!base) return null
  let sumPerGram = 0
  let n = 0
  for (const m of meals) {
    const match = m.name.trim().match(GRAM_SUFFIX)
    if (!match) continue
    if (match[1].trim() !== base) continue
    const grams = Number(match[2])
    if (!(grams > 0)) continue
    const per100 = (m.kcal / grams) * 100
    if (per100 < 5 || per100 > 900) continue
    sumPerGram += m.kcal / grams
    n++
  }
  if (n === 0) return null
  return Math.round((sumPerGram / n) * 100)
}
