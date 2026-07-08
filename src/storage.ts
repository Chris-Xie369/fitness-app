import type { BodyEntry, Workout } from './types'

const WORKOUTS_KEY = 'fitness-app:workouts'
const BODY_KEY = 'fitness-app:body'

export function loadWorkouts(): Workout[] {
  try {
    const raw = localStorage.getItem(WORKOUTS_KEY)
    return raw ? (JSON.parse(raw) as Workout[]) : []
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
