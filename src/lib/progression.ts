// 渐进超负荷建议（新手线性进步规则）
// 依据：上次训练该动作全部完成组的表现，给出下次每组可直接套用的重量/次数
export type PrevSet = { reps: number; weight?: number }
export type NextSuggestion = {
  label: string
  sets: { reps: number; weight?: number }[]
}

// 重量步进：2.5kg 为最小杠铃片组合的一半，新手上肢/下肢通用
const WEIGHT_STEP = 2.5
// 次数目标区间：达到 10 次说明可以加重，5-9 次先加次数
const REPS_TARGET = 10
const REPS_FLOOR = 5

export function nextSuggestion(prevSets: PrevSet[]): NextSuggestion | null {
  const sets = prevSets.filter((s) => Number.isFinite(s.reps) && s.reps > 0)
  if (sets.length === 0) return null
  const minReps = Math.min(...sets.map((s) => s.reps))
  const bodyweight = sets.every((s) => s.weight == null || s.weight === 0)

  if (bodyweight) {
    // 徒手动作：统一加 1 次
    const reps = minReps + 1
    return { label: `可试 ${reps} 次`, sets: sets.map(() => ({ reps })) }
  }

  // 负重动作：以历史最重组为步进基准（各组重量可能不同）
  const maxWeight = Math.max(...sets.map((s) => s.weight ?? 0))
  if (!(maxWeight > 0)) return null

  if (minReps >= REPS_TARGET) {
    const weight = Math.round((maxWeight + WEIGHT_STEP) * 10) / 10
    return { label: `可试 ${weight}kg`, sets: sets.map((s) => ({ reps: s.reps, weight })) }
  }
  if (minReps >= REPS_FLOOR) {
    const reps = minReps + 1
    return { label: `可试 ${reps} 次`, sets: sets.map((s) => ({ reps, weight: s.weight ?? maxWeight })) }
  }
  return null
}
