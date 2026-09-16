import type { SetEntry, Workout } from '../types'

export type PersonalRecord = {
  name: string
  weight: number
  reps: number
  date: string
}

// 每个动作的历史最重一组（重量最大；同重量取次数多者，再并列取最近日期）
export function personalRecords(workouts: Workout[], limit = 5): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>()
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const name = ex.name.trim()
      if (!name) continue
      for (const s of ex.sets) {
        if (s.weight == null || s.weight <= 0) continue
        const cur = best.get(name)
        const cand: PersonalRecord = { name, weight: s.weight, reps: s.reps, date: w.date }
        if (
          !cur ||
          s.weight > cur.weight ||
          (s.weight === cur.weight && s.reps > cur.reps) ||
          (s.weight === cur.weight && s.reps === cur.reps && w.date > cur.date)
        ) {
          best.set(name, cand)
        }
      }
    }
  }
  return [...best.values()].sort((a, b) => b.weight - a.weight).slice(0, limit)
}

// 估算 1RM（Epley 公式），仅用于展示
export function estimate1RM(set: SetEntry): number {
  if (set.weight == null) return 0
  return Math.round(set.weight * (1 + set.reps / 30))
}
