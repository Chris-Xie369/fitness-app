import type { ActivityEntry, MealEntry, MetricEntry, Routine, WaterEntry, Workout } from './types'

// 记录类集合的唯一登记表：备份导出/解析、导入确认与结果文案、备份提醒计数都从这里派生。
// 新增集合只改这里与 CollectionData：漏登记会在 satisfies 处编译失败。
export type CollectionData = {
  workouts: Workout[]
  meals: MealEntry[]
  metrics: MetricEntry[]
  routines: Routine[]
  water: WaterEntry[]
  activities: ActivityEntry[]
}
export type CollectionKey = keyof CollectionData

type CollectionMeta = { unit: string; noun: string; countsAsRecord: boolean }

export const COLLECTIONS = {
  workouts: { unit: '天', noun: '训练', countsAsRecord: true },
  meals: { unit: '条', noun: '饮食', countsAsRecord: true },
  metrics: { unit: '条', noun: '身体记录', countsAsRecord: true },
  routines: { unit: '个', noun: '模板', countsAsRecord: false },
  water: { unit: '天', noun: '饮水', countsAsRecord: false },
  activities: { unit: '条', noun: '运动', countsAsRecord: true },
} as const satisfies Record<CollectionKey, CollectionMeta>

export const COLLECTION_KEYS = Object.keys(COLLECTIONS) as CollectionKey[]

export type CollectionCounts = Record<CollectionKey, number>

export function countsOf(data: { [K in CollectionKey]?: unknown[] }): CollectionCounts {
  return Object.fromEntries(COLLECTION_KEYS.map((k) => [k, data[k]?.length ?? 0])) as CollectionCounts
}

export function describeCounts(counts: CollectionCounts): string {
  return COLLECTION_KEYS.map((k) => `${counts[k]} ${COLLECTIONS[k].unit}${COLLECTIONS[k].noun}`).join(' · ')
}

export function recordCount(counts: CollectionCounts): number {
  return COLLECTION_KEYS.filter((k) => COLLECTIONS[k].countsAsRecord).reduce((n, k) => n + counts[k], 0)
}

export function isEmpty(counts: CollectionCounts): boolean {
  return COLLECTION_KEYS.every((k) => counts[k] === 0)
}
