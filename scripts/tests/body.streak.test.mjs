// 身体指标按类型校验 / 四周趋势窗口 / 连续天数 DST 安全（Codex 评估 F04/F05/F06 回归）
import { requireLib, storageStore } from './_harness.mjs'
const body = requireLib('body')
const storage = requireLib('storage')
const streak = requireLib('streak')
import assert from 'node:assert'

const D = (m, d) => `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// F04：按类型边界（UI 录入 / load / parseBackup 三处共享）
assert.strictEqual(body.isValidMetricValue('bodyFat', 120), false, '120% 体脂必须在输入层被拦')
assert.strictEqual(body.isValidMetricValue('bodyFat', 22.5), true)
assert.strictEqual(body.isValidMetricValue('weight', 70), true)
assert.strictEqual(body.isValidMetricValue('weight', 0), false)
assert.strictEqual(body.isValidMetricValue('waist', 85), true)
for (const t of ['weight', 'bodyFat', 'waist', 'chest', 'hips', 'upperArm', 'thigh']) {
  assert.ok(body.METRIC_LIMITS[t], `METRIC_LIMITS 应覆盖 ${t}`)
}

// 载入同样拦截（load/parse 共用 isValidMetric）
storageStore.clear()
storageStore.set('fitness-app:metrics', JSON.stringify([
  { id: 'a', date: D(10, 1), type: 'bodyFat', value: 120, createdAt: 1 },
  { id: 'b', date: D(10, 1), type: 'weight', value: 70, createdAt: 1 },
]))
const loaded = storage.loadMetrics()
assert.strictEqual(loaded.length, 1, '120% 体脂不应通过载入校验')
assert.strictEqual(loaded[0].type, 'weight')

// F05：四周趋势取窗口边界最近一条，而非全历史最早（报告复现：1/1=90、9/6=80、10/4=78 应为 4 周 -2kg）
const metrics = [
  { date: D(1, 1), type: 'weight', value: 90 },
  { date: D(9, 6), type: 'weight', value: 80 },
  { date: D(10, 4), type: 'weight', value: 78 },
]
const v = body.weightVelocity(metrics, new Date(2026, 9, 4), 4)
assert.strictEqual(v.weeks, 4, `应取 9/6 起点=4 周，实际 ${v.weeks}`)
assert.strictEqual(v.delta, -2, `窗口内变化应为 -2kg，实际 ${v.delta}`)
assert.strictEqual(v.kgPerWeek, -0.5)

// 窗口内无记录：退回最新之前最早一条，weeks 如实反映实际跨度
const sparse = body.weightVelocity([
  { date: D(10, 1), type: 'weight', value: 80 },
  { date: D(10, 4), type: 'weight', value: 78 },
], new Date(2026, 9, 4), 4)
assert.strictEqual(sparse.delta, -2)
assert.ok(sparse.weeks < 1, `稀疏记录应显示实际跨度，实际 ${sparse.weeks}`)

// F06：日期分量推算，DST 周边连续日不错算（2026-03-29 伦敦夏令时切换）；now 可注入
const wk = (d) => ({ id: d, date: d, createdAt: 1, exercises: [{ id: 'e', name: '卧推', sets: [{ reps: 8 }] }] })
const dstWorkouts = [D(3, 27), D(3, 28), D(3, 29), D(3, 30)].map(wk)
assert.strictEqual(streak.computeStreak(dstWorkouts, new Date(2026, 2, 30)), 4, 'DST 周边四个连续日应为 4')
assert.strictEqual(streak.computeStreak([D(3, 28), D(3, 30)].map(wk), new Date(2026, 2, 30)), 1, '断档日不连计')
assert.strictEqual(streak.computeStreak([D(10, 2)].map(wk), new Date(2026, 9, 4)), 0, '隔天（非今天/昨天）不算连续')
assert.strictEqual(streak.computeStreak([D(10, 3)].map(wk), new Date(2026, 9, 4)), 1, '昨天的记录按宽限语义计 1 天')

console.log('body.streak ✓')
