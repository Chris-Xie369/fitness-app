import type { Exercise, Routine, SetEntry } from '../types'

const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `routine_${Date.now()}_${Math.random().toString(36).slice(2)}`

// 从表单里筛出"动作名非空且至少一组有效次数"的动作
export function validExercises(exercises: Exercise[]): Exercise[] {
  const out: Exercise[] = []
  for (const e of exercises) {
    const name = e.name.trim()
    const sets = e.sets.filter((s) => Number.isFinite(s.reps) && s.reps > 0)
    if (name && sets.length > 0) out.push({ name, sets })
  }
  return out
}

// 同名模板视为更新（移动到最前）；否则新建
export function upsertRoutine(
  routines: Routine[],
  name: string,
  exercises: { name: string; sets: SetEntry[] }[],
): Routine[] {
  const trimmed = name.trim()
  const existing = routines.find((r) => r.name === trimmed)
  const next: Routine = existing
    ? { ...existing, exercises }
    : { id: uid(), name: trimmed, createdAt: Date.now(), exercises }
  return [next, ...routines.filter((r) => r.id !== next.id)]
}

export function deleteRoutine(routines: Routine[], id: string): Routine[] {
  return routines.filter((r) => r.id !== id)
}
