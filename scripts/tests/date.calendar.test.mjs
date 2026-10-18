import assert from 'node:assert'
import { requireLib } from './_harness.mjs'

process.env.TZ = 'America/New_York'
const d = requireLib('date')

assert.strictEqual(d.daysBetween(new Date(2026, 2, 7), new Date(2026, 2, 9)), 2, '跨 DST 起始日（23 小时）仍是 2 天')
assert.strictEqual(d.daysBetween(new Date(2026, 10, 1), new Date(2026, 10, 2)), 1, '跨 DST 结束日（25 小时）仍是 1 天')
assert.strictEqual(d.shiftDate('2026-03-08', 1), '2026-03-09')
assert.strictEqual(d.dateKey(d.mondayOf(new Date(2026, 9, 18))), '2026-10-12', '周日归属本周一')
assert.strictEqual(d.dateKey(d.mondayOf(new Date(2026, 9, 12))), '2026-10-12', '周一归属自己')
assert.strictEqual(d.dayLabel('2026-10-18', new Date(2026, 9, 18, 23, 59)), '今天 · 10月18日 周日')
assert.strictEqual(d.dayLabel('2026-10-17', new Date(2026, 9, 18, 0, 1)), '昨天 · 10月17日 周六')
assert.strictEqual(d.todayStr(new Date(2026, 0, 5)), '2026-01-05')

console.log('date.calendar ✓')
