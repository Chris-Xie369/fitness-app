import type { Workout } from '../types'
import { mondayOf } from './stats'

export type CelebrationItem = {
  emoji: string
  title: string
  desc: string
}

export type PRHit = {
  name: string
  weight: number
  reps: number
}

// 每个动作历史最大重量（只看负重组）
function bestWeights(workouts: Workout[]): Map<string, PRHit> {
  const m = new Map<string, PRHit>()
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const name = ex.name.trim()
      for (const s of ex.sets) {
        if (s.weight == null || s.weight <= 0) continue
        const cur = m.get(name)
        if (!cur || s.weight > cur.weight) m.set(name, { name, weight: s.weight, reps: s.reps })
      }
    }
  }
  return m
}

// 一次保存后新产生的重量 PR（该动作之前练过、且这次重量超过历史最佳）
export function newlySetPRs(before: Workout[], after: Workout[]): CelebrationItem[] {
  const b = bestWeights(before)
  const a = bestWeights(after)
  const hits: CelebrationItem[] = []
  for (const [name, now] of a) {
    const old = b.get(name)
    // 新动作的第一次记录不算 PR（初次打卡成就已覆盖）
    if (old && now.weight > old.weight) {
      hits.push({ emoji: '🏆', title: `新纪录 ${now.weight}kg`, desc: `${name} · 原纪录 ${old.weight}kg` })
    }
  }
  return hits
}

// 本周训练目标是否在这次保存后刚好达成（之前未达标、现在达标）
export function weekGoalJustReached(
  before: Workout[],
  after: Workout[],
  goalDays: number,
  now = new Date(),
): boolean {
  const monday = mondayOf(now)
  const inThisWeek = (w: Workout) => {
    const [y, m, d] = w.date.split('-').map(Number)
    const t = new Date(y, m - 1, d).getTime()
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
    return t >= monday.getTime() && t < todayEnd
  }
  const beforeDays = new Set(before.filter(inThisWeek).map((w) => w.date)).size
  const afterDays = new Set(after.filter(inThisWeek).map((w) => w.date)).size
  return beforeDays < goalDays && afterDays >= goalDays
}

// 周标识（ISO 周一日期），用于"每周只庆祝一次"
export function weekKey(d = new Date()): string {
  const monday = mondayOf(d)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}
