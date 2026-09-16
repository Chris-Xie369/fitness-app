export type Sex = 'male' | 'female'

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

// 近 n 周体重变化速度：首条（n 周前至今最早一条）与最新一条的差 / 周数
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
  const start = weights.find((m) => m.date <= latest.date && m.date <= cutoffKey) ?? weights.find((m) => m.date < latest.date)
  if (!start || start.date === latest.date) return null
  const days = Math.max(1, Math.round((new Date(latest.date).getTime() - new Date(start.date).getTime()) / 86400000))
  const wk = days / 7
  const delta = Math.round((latest.value - start.value) * 10) / 10
  return { kgPerWeek: Math.round((delta / wk) * 100) / 100, delta, weeks: Math.round(wk * 10) / 10 }
}
