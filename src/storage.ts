import type { BodyEntry, Workout } from './types'

const WORKOUTS_KEY = 'fitness-app:workouts'
const BODY_KEY = 'fitness-app:body'

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
    return raw ? (JSON.parse(raw) as BodyEntry[]) : []
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
