import type { BodyEntry, MealEntry, Workout } from './types'

const WORKOUTS_KEY = 'fitness-app:workouts'
const BODY_KEY = 'fitness-app:body'
const MEALS_KEY = 'fitness-app:meals'

// 旧版本里"再记一次"会在同一天产生多条 workout，今天页只能看到第一条。
// 归一化：同日期的记录合并成一条，动作按保存先后拼接，保留最早的 id/创建时间。
export function normalizeWorkouts(workouts: Workout[]): Workout[] {
  const byDate = new Map<string, Workout[]>()
  for (const w of workouts) {
    const list = byDate.get(w.date)
    if (list) list.push(w)
    else byDate.set(w.date, [w])
  }

  const merged: Workout[] = []
  for (const list of byDate.values()) {
    const ordered = [...list].sort((a, b) => a.createdAt - b.createdAt)
    const first = ordered[0]
    merged.push({
      id: first.id,
      date: first.date,
      createdAt: first.createdAt,
      exercises: ordered.flatMap((w) => w.exercises),
      note: ordered.map((w) => w.note).find(Boolean),
    })
  }
  // 最新的一天排最前（历史页顺序 & addWorkout 的 find 都依赖这个顺序）
  return merged.sort((a, b) => b.createdAt - a.createdAt)
}

export function loadWorkouts(): Workout[] {
  try {
    const raw = localStorage.getItem(WORKOUTS_KEY)
    return raw ? normalizeWorkouts(JSON.parse(raw) as Workout[]) : []
  } catch {
    return []
  }
}

export function saveWorkouts(workouts: Workout[]): void {
  try {
    localStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts))
  } catch {
    /* 静默失败：内存里仍可正常使用 */
  }
}

export function loadBody(): BodyEntry[] {
  try {
    const raw = localStorage.getItem(BODY_KEY)
    if (!raw) return []
    const data: unknown = JSON.parse(raw)
    return Array.isArray(data) ? (data as BodyEntry[]) : []
  } catch {
    return []
  }
}

export function saveBody(entries: BodyEntry[]): void {
  try {
    localStorage.setItem(BODY_KEY, JSON.stringify(entries))
  } catch {
    /* 静默失败 */
  }
}

const MEAL_VALUES = ['breakfast', 'lunch', 'dinner', 'snack']

// 结构校验：脏 JSON / 调试残留 / 未来 schema 变更都不能让饮食页崩
function isValidMeal(m: unknown): m is MealEntry {
  if (!m || typeof m !== 'object') return false
  const x = m as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    typeof x.date === 'string' &&
    typeof x.name === 'string' &&
    typeof x.kcal === 'number' &&
    Number.isFinite(x.kcal) &&
    typeof x.createdAt === 'number' &&
    MEAL_VALUES.includes(x.meal as string)
  )
}

export function loadMeals(): MealEntry[] {
  try {
    const raw = localStorage.getItem(MEALS_KEY)
    if (!raw) return []
    const data: unknown = JSON.parse(raw)
    return Array.isArray(data) ? (data.filter(isValidMeal) as MealEntry[]) : []
  } catch {
    return []
  }
}

export function saveMeals(meals: MealEntry[]): void {
  try {
    localStorage.setItem(MEALS_KEY, JSON.stringify(meals))
  } catch {
    /* 静默失败 */
  }
}
