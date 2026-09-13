import type { Workout } from '../types'
import { mondayOf } from './stats'

export type WeekSummary = {
  trainDays: number
  totalSets: number
  tonnage: number
  durationMin: number
  avgKcal: number
  kcalDays: number
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 汇总某周前 dayCount 天（周一起）的训练与饮食。dayCount 让"本周至今"与"上周同星期区间"可比
export function summarizeWeek(
  workouts: Workout[],
  kcalByDate: Map<string, number>,
  weekMonday: Date,
  dayCount = 7,
): WeekSummary {
  const dates = new Set<string>()
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(weekMonday.getFullYear(), weekMonday.getMonth(), weekMonday.getDate() + i)
    dates.add(dateKey(d))
  }
  let totalSets = 0
  let tonnage = 0
  let durationSec = 0
  for (const w of workouts) {
    if (dates.has(w.date)) {
      totalSets += w.exercises.reduce((n, ex) => n + ex.sets.length, 0)
      durationSec += w.durationSec ?? 0
      for (const ex of w.exercises) {
        for (const set of ex.sets) {
          if (set.weight != null && set.weight > 0) tonnage += set.weight * set.reps
        }
      }
    }
  }
  const trainDays = workouts.filter((w) => dates.has(w.date)).length
  let kcalSum = 0
  let kcalDays = 0
  for (const date of dates) {
    const k = kcalByDate.get(date) ?? 0
    if (k > 0) { kcalSum += k; kcalDays++ }
  }
  return { trainDays, totalSets, tonnage: Math.round(tonnage), durationMin: Math.round(durationSec / 60), avgKcal: kcalDays ? Math.round(kcalSum / kcalDays) : 0, kcalDays }
}

export type WeeklyReport = {
  thisWeek: WeekSummary
  lastWeek: WeekSummary
  // 本周已过天数（含今天，1-7），用于卡片标注"截至周X"
  elapsedDays: number
}

export function weeklyReport(workouts: Workout[], kcalByDate: Map<string, number>, now = new Date()): WeeklyReport {
  const thisMonday = mondayOf(now)
  const lastMonday = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7)
  // 本周一到今天过了几天（周日=第7天）
  const elapsedDays = Math.min(
    7,
    Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - thisMonday.getTime()) / 86400000) + 1,
  )
  return {
    thisWeek: summarizeWeek(workouts, kcalByDate, thisMonday, elapsedDays),
    lastWeek: summarizeWeek(workouts, kcalByDate, lastMonday, elapsedDays),
    elapsedDays,
  }
}

// 教练式一句话周报：本周 vs 上周同星期区间
export function weeklyInsight(r: WeeklyReport): string {
  const t = r.thisWeek
  const l = r.lastWeek
  if (t.trainDays === 0) return '这周还没开练，挑个时间完成第一次打卡吧 💪'
  if (l.trainDays === 0) return `这周已练 ${t.trainDays} 天，开了个好头，继续保持！`
  const parts: string[] = []
  const dd = t.trainDays - l.trainDays
  if (dd > 0) parts.push(`训练 ${t.trainDays} 天，比上周多 ${dd} 天`)
  else if (dd < 0) parts.push(`训练 ${t.trainDays} 天，比上周少 ${-dd} 天`)
  else parts.push(`训练 ${t.trainDays} 天，与上周持平`)
  if (l.totalSets > 0) {
    const ds = t.totalSets - l.totalSets
    if (ds >= 4) parts.push(`多完成 ${ds} 组`)
    else if (ds <= -4) parts.push(`少完成 ${-ds} 组`)
  }
  if (t.kcalDays > 0 && l.kcalDays > 0) {
    const dk = t.avgKcal - l.avgKcal
    if (dk >= 150) parts.push(`日均多吃 ${dk} kcal`)
    else if (dk <= -150) parts.push(`日均少吃 ${-dk} kcal`)
  }
  return `${parts.join('，')}。`
}
