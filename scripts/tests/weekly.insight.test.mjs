// weeklyInsight 口径：区分 未记录 / 只打卡未填明细 / 有明细对比（Codex 评估第三批）
import { requireLib } from './_harness.mjs'
const weekly = requireLib('weekly')
import assert from 'node:assert'

const D = (m, d) => `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const wk = (d, sets) => ({
  id: d,
  date: d,
  createdAt: 1,
  exercises: sets === 0 ? [] : [{ id: 'e', name: '卧推', sets: Array.from({ length: sets }, () => ({ reps: 8, weight: 50 })) }],
})

// 本周=2026/10/5(周一)起 elapsed 3 天；上周同期=9/28-9/30
function insight(thisList, lastList) {
  const r = weekly.weeklyReport([...thisList, ...lastList], new Map(), new Date(2026, 9, 7))
  return weekly.weeklyInsight(r)
}

assert.match(insight([], []), /还没开始记录/, '未记录')
assert.match(insight([wk(D(10, 6), 0)], [wk(D(9, 30), 0)]), /打卡了 1 天，明细还没补/, '只打卡：不比组数，指路补明细')
assert.match(insight([wk(D(10, 6), 10)], [wk(D(9, 30), 10)]), /训练 1 天，与上周持平/, '有明细正常对比')
assert.match(insight([wk(D(10, 5), 10), wk(D(10, 6), 0)], [wk(D(9, 30), 10)]), /训练 2 天，比上周多 1 天/, '混合打卡+明细按日期计数')

console.log('weekly.insight ✓')
