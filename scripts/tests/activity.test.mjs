// 运动消耗：METs 估算、dayBurn、存储校验、备份往返（含老备份兼容）
import { requireLib, storageStore } from './_harness.mjs'
const a = requireLib('activity')
const s = requireLib('storage')
import assert from 'node:assert'

assert.strictEqual(a.estimateKcal('run', 30, 70), 280)
assert.strictEqual(a.estimateKcal('walk', 60, 70), 245)
assert.strictEqual(a.estimateKcal('brisk', 45, 60), 225)

const acts = [
  { id: '1', date: '2026-09-29', kind: 'run', minutes: 30, kcal: 280, createdAt: 1 },
  { id: '2', date: '2026-09-29', kind: 'walk', minutes: 60, kcal: 245, createdAt: 2 },
  { id: '3', date: '2026-09-28', kind: 'run', minutes: 20, kcal: 180, createdAt: 3 },
]
assert.strictEqual(a.dayBurn(acts, '2026-09-29'), 525)
assert.strictEqual(a.dayBurn(acts, '2026-09-30'), 0)

assert.strictEqual(s.isValidActivity(acts[0]), true)
assert.strictEqual(s.isValidActivity({ ...acts[0], kind: 'fly' }), false)
assert.strictEqual(s.isValidActivity({ ...acts[0], minutes: 0 }), false)
assert.strictEqual(s.isValidActivity({ ...acts[0], minutes: 700 }), false)
assert.strictEqual(s.isValidActivity({ ...acts[0], kcal: 0 }), false)
assert.strictEqual(s.isValidActivity({ ...acts[0], kcal: 6400 }), true, '上界放宽后 6400 应合法')

storageStore.set('fitness-app:activities', JSON.stringify([acts[2], { garbage: true }]))
assert.strictEqual(s.loadActivities().length, 1, '脏条目应被过滤')

storageStore.set('fitness-app:activities', JSON.stringify([acts[0]]))
const backup = s.exportBackup()
assert.strictEqual(JSON.parse(backup).activities.length, 1)
const parsed = s.parseBackup(backup)
assert.strictEqual(parsed.activities.length, 1, '备份往返应保留 activities')
assert.notStrictEqual(parsed.activities[0].id, '1', '导入应重建 id')

const oldBackup = JSON.stringify({ app: 'fitness-app', version: 1, workouts: [], metrics: [], meals: [], routines: [], water: [], settings: { heightCm: 175 } })
const oldParsed = s.parseBackup(oldBackup)
assert.ok(oldParsed && oldParsed.activities.length === 0, '老备份 activities 降级为空数组')

console.log('activity ✓')
