// Workout.updatedAt 透传：normalizeWorkouts 合并取最新、老数据不新增字段、loadWorkouts 透传
import { requireLib, storageStore } from './_harness.mjs'
const s = requireLib('storage')
import assert from 'node:assert'

const w = [
  { id: 'b', date: '2026-09-29', createdAt: 200, updatedAt: 500, exercises: [{ name: '深蹲', sets: [{ reps: 8 }] }] },
  { id: 'a', date: '2026-09-29', createdAt: 100, exercises: [{ name: '卧推', sets: [{ reps: 10, weight: 60 }] }] },
]
const merged = s.normalizeWorkouts(w)
assert.strictEqual(merged.length, 1)
assert.strictEqual(merged[0].createdAt, 100, 'createdAt 取最早')
assert.strictEqual(merged[0].updatedAt, 500, 'updatedAt 应保留最新')

const old = s.normalizeWorkouts([{ id: 'x', date: '2026-09-28', createdAt: 50, exercises: [{ name: '卧推', sets: [{ reps: 8 }] }] }])
assert.strictEqual(old[0].updatedAt, undefined, '老数据不新增 updatedAt')

storageStore.clear()
storageStore.set('fitness-app:workouts', JSON.stringify([
  { id: 'a', date: '2026-09-28', createdAt: 50, exercises: [{ name: '卧推', sets: [{ reps: 8 }] }] },
  { id: 'b', date: '2026-09-29', createdAt: 200, updatedAt: 500, exercises: [{ name: '深蹲', sets: [{ reps: 8 }] }] },
]))
const loaded = s.loadWorkouts()
assert.strictEqual(loaded.length, 2)
assert.strictEqual(loaded.find((x) => x.id === 'b').updatedAt, 500, 'loadWorkouts 应透传 updatedAt')

console.log('storage.updatedAt ✓')
