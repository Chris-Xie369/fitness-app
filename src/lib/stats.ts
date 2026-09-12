import type { Workout } from '../types'

// 周一 0 点（与 streak.weekStatus 的一周口径一致）
export function mondayOf(d: Date): Date {
  const offset = d.getDay() === 0 ? -6 : 1 - d.getDay()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset)
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mdLabel(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function setsOf(w: Workout): number {
  return w.exercises.reduce((n, ex) => n + ex.sets.length, 0)
}

// 把每条 workout 摊成"某天的组数"（归一化后一天一条，这里对重复数据也稳妥）
function setsByDate(workouts: Workout[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const w of workouts) map.set(w.date, (map.get(w.date) ?? 0) + setsOf(w))
  return map
}

export type Overview = { totalDays: number; weekDays: number; totalSets: number }

export function overview(workouts: Workout[]): Overview {
  const dates = new Set(workouts.map((w) => w.date))
  const thisMonday = dateKey(mondayOf(new Date()))
  const weekDays = [...dates].filter((s) => s >= thisMonday).length
  const totalSets = workouts.reduce((n, w) => n + setsOf(w), 0)
  return { totalDays: dates.size, weekDays, totalSets }
}

export type WeekBucket = { label: string; days: number; sets: number }

// 最近 n 周（含本周），按时间升序；每周统计训练天数与总组数。
// 一律用本地日期分量推进（不用 7*86400000 毫秒推算），夏令时切换周边界也不会偏。
export function weeklyTotals(workouts: Workout[], n = 8): WeekBucket[] {
  const byDate = setsByDate(workouts)
  const monday = mondayOf(new Date())
  const buckets: WeekBucket[] = []
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - i * 7)
    let days = 0
    let sets = 0
    for (let dow = 0; dow < 7; dow++) {
      const s = byDate.get(dateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + dow)))
      if (s) {
        days++
        sets += s
      }
    }
    buckets.push({ label: mdLabel(start), days, sets })
  }
  return buckets
}

export type ExerciseStat = { name: string; sets: number; times: number }

// 动作榜：按累计组数降序（同名动作跨天合并计数）；并列时训练天数多的在前，再按名称
export function exerciseRanking(workouts: Workout[]): ExerciseStat[] {
  const map = new Map<string, ExerciseStat & { dates: Set<string> }>()
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const cur = map.get(ex.name) ?? { name: ex.name, sets: 0, times: 0, dates: new Set<string>() }
      cur.sets += ex.sets.length
      cur.times += 1
      cur.dates.add(w.date)
      map.set(ex.name, cur)
    }
  }
  return [...map.values()]
    .map(({ name, sets, dates }) => ({ name, sets, times: dates.size }))
    .sort((a, b) => b.sets - a.sets || b.times - a.times || a.name.localeCompare(b.name, 'zh'))
}

export type HeatCell = { date: string; sets: number }

// 最近 n 周打卡热力：按列（周）排列，每列周一→周日，供 CSS grid-flow-col 使用
export function heatmap(workouts: Workout[], n = 12): HeatCell[] {
  const byDate = setsByDate(workouts)
  const monday = mondayOf(new Date())
  const cells: HeatCell[] = []
  for (let i = n - 1; i >= 0; i--) {
    const colMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - i * 7)
    for (let dow = 0; dow < 7; dow++) {
      const d = new Date(colMonday.getFullYear(), colMonday.getMonth(), colMonday.getDate() + dow)
      const key = dateKey(d)
      cells.push({ date: key, sets: byDate.get(key) ?? 0 })
    }
  }
  return cells
}
