import type { ActivityEntry, ActivityKind } from '../types'

// MET 代谢当量（参考 Compendium of Physical Activities 常用值）：慢跑 8、快走 5、步行 3.5
export const ACTIVITY_METS: Record<Exclude<ActivityKind, 'other'>, number> = { run: 8, walk: 3.5, brisk: 5 }

// 估算消耗热量 = 体重 × MET × 小时
export function estimateKcal(kind: Exclude<ActivityKind, 'other'>, minutes: number, weightKg: number): number {
  return Math.round(weightKg * ACTIVITY_METS[kind] * (minutes / 60))
}

// 当日运动消耗合计（kcal）
export function dayBurn(activities: ActivityEntry[], date: string): number {
  return activities.reduce((n, a) => (a.date === date ? n + a.kcal : n), 0)
}
