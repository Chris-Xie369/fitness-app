export type Sex = 'male' | 'female'
import type { MetricType } from '../types'

// 各类身体指标的合理边界：个人记录用途的宽松产品规则，UI 录入/载入校验/备份解析三处共用
// （120% 体脂这类数学上不可能的值必须在输入时就拦住，否则派生的瘦体重会变负数）
export const METRIC_LIMITS: Record<MetricType, { min: number; max: number; unit: string }> = {
  weight: { min: 20, max: 400, unit: 'kg' },
  bodyFat: { min: 2, max: 70, unit: '%' },
  waist: { min: 30, max: 200, unit: 'cm' },
  chest: { min: 40, max: 200, unit: 'cm' },
  hips: { min: 40, max: 200, unit: 'cm' },
  upperArm: { min: 10, max: 80, unit: 'cm' },
  thigh: { min: 20, max: 120, unit: 'cm' },
}

export function isValidMetricValue(type: MetricType, value: number): boolean {
  const lim = METRIC_LIMITS[type]
  return lim != null && Number.isFinite(value) && value >= lim.min && value <= lim.max
}

// BMI = 体重kg / 身高m²
export function bmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) return 0
  const m = heightCm / 100
  return Math.round((weightKg / (m * m)) * 10) / 10
}

// 中国成人标准：<18.5 偏瘦 / 18.5-23.9 正常 / 24-27.9 超重 / ≥28 肥胖
export function bmiCategory(v: number): string {
  if (v <= 0) return '—'
  if (v < 18.5) return '偏瘦'
  if (v < 24) return '正常'
  if (v < 28) return '超重'
  return '肥胖'
}

// 脂肪量 / 瘦体重（kg），依赖体脂率
export function fatMass(weightKg: number, bodyFatPct: number): number {
  return Math.round(weightKg * (bodyFatPct / 100) * 10) / 10
}
export function leanMass(weightKg: number, bodyFatPct: number): number {
  return Math.round(weightKg * (1 - bodyFatPct / 100) * 10) / 10
}

// Mifflin-St Jeor 基础代谢（kcal/天），学界公认对普通人群最准
export function bmrMifflin(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  if (weightKg <= 0 || heightCm <= 0 || age <= 0) return 0
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return Math.round(sex === 'male' ? base + 5 : base - 161)
}

export function ageFromBirthYear(birthYear: number | undefined, now = new Date()): number {
  if (!birthYear || birthYear < 1900 || birthYear > now.getFullYear()) return 0
  return now.getFullYear() - birthYear
}

// 7 日移动平均：每个点取含自身在内过去 7 天（日历日）所有测量的均值，滤掉单日水分波动
export function movingAverage(
  points: { date: string; value: number }[],
  windowDays = 7,
): ({ date: string; value: number; avg: number })[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((p) => {
    const [y, m, d] = p.date.split('-').map(Number)
    const start = new Date(y, m - 1, d - windowDays + 1).getTime()
    const inWindow = sorted.filter((q) => {
      const [qy, qm, qd] = q.date.split('-').map(Number)
      const t = new Date(qy, qm - 1, qd).getTime()
      return t >= start && t <= new Date(y, m - 1, d).getTime()
    })
    const avg = Math.round((inWindow.reduce((n, q) => n + q.value, 0) / inWindow.length) * 10) / 10
    return { ...p, avg }
  })
}

// 近 n 周体重变化速度：起点取窗口边界（n 周前）处最近的一条，而非全历史最早一条；
// 窗口内没有记录时退回最新之前的最早一条（此时 weeks 反映实际跨度，如实显示）
export function weightVelocity(
  metrics: { date: string; type: string; value: number }[],
  now = new Date(),
  weeks = 4,
): { kgPerWeek: number; delta: number; weeks: number } | null {
  const weights = metrics
    .filter((m) => m.type === 'weight')
    .sort((a, b) => a.date.localeCompare(b.date))
  if (weights.length < 2) return null
  const latest = weights[weights.length - 1]
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weeks * 7)
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`
  const inWindow = weights.filter((m) => m.date <= cutoffKey)
  const start = inWindow.length > 0 ? inWindow[inWindow.length - 1] : weights.find((m) => m.date < latest.date)
  if (!start || start.date === latest.date) return null
  const days = Math.max(1, Math.round((new Date(latest.date).getTime() - new Date(start.date).getTime()) / 86400000))
  const wk = days / 7
  const delta = Math.round((latest.value - start.value) * 10) / 10
  return { kgPerWeek: Math.round((delta / wk) * 100) / 100, delta, weeks: Math.round(wk * 10) / 10 }
}
