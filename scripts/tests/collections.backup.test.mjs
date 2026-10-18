import assert from 'node:assert'
import { requireLib, storageStore } from './_harness.mjs'

const storage = requireLib('storage')
const { COLLECTIONS, COLLECTION_KEYS, countsOf, describeCounts } = requireLib('collections')

const D = '2026-10-12'
const samples = {
  workouts: { id: 'w', date: D, createdAt: 1, exercises: [{ id: 'e', name: '卧推', sets: [{ reps: 8, weight: 60 }] }] },
  meals: { id: 'm', date: D, meal: 'lunch', name: '米饭 150g', kcal: 174, createdAt: 1 },
  metrics: { id: 'b', date: D, type: 'weight', value: 70, createdAt: 1 },
  routines: { id: 'r', name: '推日', createdAt: 1, exercises: [{ name: '卧推', sets: [{ reps: 8 }] }] },
  water: { id: 'h', date: D, glasses: 6, updatedAt: 1 },
  activities: { id: 'a', date: D, kind: 'run', minutes: 30, kcal: 300, createdAt: 1 },
}
assert.deepStrictEqual(Object.keys(samples).sort(), [...COLLECTION_KEYS].sort(), '每个登记集合都要有往返样本：新增集合时在这里补一条')

storageStore.clear()
const save = { workouts: storage.saveWorkouts, meals: storage.saveMeals, metrics: storage.saveMetrics, routines: storage.saveRoutines, water: storage.saveWater, activities: storage.saveActivities }
for (const k of COLLECTION_KEYS) assert.ok(save[k]([samples[k]]), `${k} 写入成功`)

const parsed = storage.parseBackup(storage.exportBackup())
assert.ok(parsed, '导出的备份能被解析')
const counts = countsOf(parsed)
for (const k of COLLECTION_KEYS) assert.strictEqual(counts[k], 1, `${k} 经导出→解析往返后应保留 1 条，实际 ${counts[k]}`)

const text = describeCounts(counts)
for (const k of COLLECTION_KEYS) assert.ok(text.includes(COLLECTIONS[k].noun), `导入文案应包含「${COLLECTIONS[k].noun}」：${text}`)

console.log('collections.backup ✓')
