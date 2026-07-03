import type { Workout } from './types'

const STORAGE_KEY = 'fitness-app:workouts'

// 读：失败或为空返回空数组
export function loadWorkouts(): Workout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Workout[]) : []
  } catch {
    return []
  }
}

// 写：失败（隐私模式/满了）静默忽略
export function saveWorkouts(workouts: Workout[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts))
  } catch {
    /* 静默失败：内存里仍可正常使用 */
  }
}
