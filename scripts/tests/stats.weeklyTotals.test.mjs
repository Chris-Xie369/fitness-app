// weeklyTotals 周组数归属（历史 bug：X 轴误读为错位）
import { requireLib } from './_harness.mjs'
const s = requireLib('stats')
import assert from 'node:assert'

const D = (m, d) => `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const mk = (date, sets) => ({ id: date, date, createdAt: 1, exercises: [{ id: 'e', name: '卧推', sets: Array.from({ length: sets }, () => ({ reps: 8 })) }] })
const workouts = [21, 22, 23, 25, 26, 27].map((d) => mk(D(9, d), 10)).concat([mk(D(9, 28), 11)])

const buckets = s.weeklyTotals(workouts, 8, new Date(2026, 8, 29))
assert.strictEqual(buckets.length, 8)
const w921 = buckets.find((b) => b.label === '9/21周')
const w928 = buckets.find((b) => b.label === '9/28周')
assert.ok(w921 && w928, '应有 9/21 与 9/28 桶')
assert.strictEqual(w921.sets, 60, `上周(21-27)6天×10组应为60，实际 ${w921.sets}`)
assert.strictEqual(w928.sets, 11, `本周一9/28为11组，实际 ${w928.sets}`)

// 纯打卡（exercises 为空）也算训练日，组数按 0 计
const checkinOnly = [{ id: 'c1', date: D(9, 29), createdAt: 2, exercises: [] }]
const mixed = s.weeklyTotals(checkinOnly.concat([mk(D(9, 28), 11)]), 8, new Date(2026, 8, 29))
const w928c = mixed.find((b) => b.label === '9/28周')
assert.strictEqual(w928c.days, 2, `纯打卡+明细两天都应计入训练日，实际 ${w928c.days}`)
assert.strictEqual(w928c.sets, 11, `纯打卡组数为0，实际 ${w928c.sets}`)
const heat = s.heatmap(checkinOnly, 12)
const cell = heat.find((c) => c.date === D(9, 29))
assert.ok(cell && cell.trained === true && cell.sets === 0, '热力格：纯打卡日 trained=true sets=0（日期须落在近12周内）')

console.log('stats.weeklyTotals ✓')
