import { estimate1RM } from './pr'
import type { Workout } from '../types'

export type ProgressPoint = {
  date: string
  e1rm: number // 当天该动作最高估算 1RM
  weight: number
  reps: number
}

// 某动作按时间排列的进步曲线：每次训练取当天估算 1RM 最高的一组
export function exerciseProgress(workouts: Workout[], name: string): ProgressPoint[] {
  const key = name.trim()
  const points: ProgressPoint[] = []
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    let best: ProgressPoint | null = null
    for (const ex of w.exercises) {
      if (ex.name.trim() !== key) continue
      for (const s of ex.sets) {
        if (s.weight == null || s.weight <= 0) continue
        const e1rm = estimate1RM(s)
        if (!best || e1rm > best.e1rm) best = { date: w.date, e1rm, weight: s.weight, reps: s.reps }
      }
    }
    if (best) points.push(best)
  }
  return points
}
