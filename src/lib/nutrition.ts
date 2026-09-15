import type { Sex } from './body'

export type DietGoal = 'lose' | 'maintain' | 'gain'

// 活动系数（TDEE = BMR × PAL）。描述"训练之外的日常活动"，刻意训练由训练日 +200 单独覆盖
export const ACTIVITY_LEVELS = [
  { value: 1.2, label: '久坐', hint: '办公室为主，日常很少走动' },
  { value: 1.375, label: '轻度', hint: '日常有走动、家务（不含刻意训练）' },
  { value: 1.55, label: '中度', hint: '经常走动、站立工作较多' },
  { value: 1.725, label: '高度', hint: '体力工作或整天都很活跃' },
] as const

// 减重/增重速度（kg/周）
export const PACE_OPTIONS = [
  { value: 0.25, label: '温和 0.25kg/周' },
  { value: 0.5, label: '标准 0.5kg/周' },
  { value: 0.75, label: '较快 0.75kg/周' },
] as const

// 训练日固定加热量（力量训练消耗估算不可靠，不给"吃回"，只在 TDEE 上小幅上调）
export const TRAINING_DAY_BONUS = 200

// 安全下限（MFP/Lose It!/NIH 一致）：女 1200 / 男 1500，仅减脂时强制
export function calorieFloor(sex: Sex | undefined): number {
  return sex === 'male' ? 1500 : 1200
}

// 1kg 脂肪 ≈ 7700 kcal；每日缺口 = 周速度 × 7700 / 7 = 速度 × 1100
export function dailyDeficit(paceKgPerWeek: number): number {
  return Math.round(paceKgPerWeek * 1100)
}

export type TargetInput = {
  bmr: number
  pal: number
  goal: DietGoal
  paceKgPerWeek: number
  isTrainingDay: boolean
  sex?: Sex
}

export type TargetResult = {
  target: number // 当日热量目标（已含训练日加成；减脂时已应用安全下限）
  restTarget: number // 休息日目标
  tdee: number // 维持热量（已含训练日加成）
  rawTarget: number // 下限保护前的休息日目标
  clamped: boolean // 减脂目标是否触发安全下限
}

export function calorieTarget(input: TargetInput): TargetResult {
  const { bmr, pal, goal, paceKgPerWeek, isTrainingDay, sex } = input
  const baseTdee = bmr * pal
  const tdee = Math.round(baseTdee + (isTrainingDay ? TRAINING_DAY_BONUS : 0))
  const delta = dailyDeficit(paceKgPerWeek)
  const rawRest = Math.round(goal === 'lose' ? baseTdee - delta : goal === 'gain' ? baseTdee + delta : baseTdee)
  const restTarget = goal === 'lose' ? Math.max(rawRest, calorieFloor(sex)) : rawRest
  const target = isTrainingDay ? restTarget + TRAINING_DAY_BONUS : restTarget
  return {
    tdee,
    restTarget,
    rawTarget: rawRest,
    target,
    clamped: goal === 'lose' && rawRest < calorieFloor(sex),
  }
}

// 当日对照建议（规则文案，纯本地，确定性）
export function dayAdvice(eaten: number, target: number, isToday: boolean): string {
  if (target <= 0) return ''
  if (eaten === 0) {
    return isToday ? `今天目标 ${target} kcal，记第一顿饭开始追踪吧` : `当天目标 ${target} kcal`
  }
  const remain = target - eaten
  if (remain >= 0) {
    if (remain <= 200) return `还剩 ${remain} kcal，刚刚好，悠着点收尾`
    return `还能吃 ${remain} kcal`
  }
  const over = -remain
  if (over <= 300) return `已超 ${over} kcal，偶尔一顿不影响，明天继续`
  return `已超 ${over} kcal，差距不小；不必节食补偿，明天回到目标即可`
}

export type AdherenceDay = { date: string; kcal: number }

// 近 7 天 adherence：每天摄入与"当天自己的目标"（训练日 +200）比，再求均值。
// 至少 3 天有记录才下结论；文案随目标方向变化（增肌期多吃是对的）。
export function weekAdherence(
  logged: AdherenceDay[],
  workoutDates: Set<string>,
  restTarget: number,
  goal: DietGoal,
): string | null {
  const loggedDays = logged.filter((d) => d.kcal > 0)
  if (loggedDays.length < 3) return null
  const diffs = loggedDays.map((d) => d.kcal - (restTarget + (workoutDates.has(d.date) ? TRAINING_DAY_BONUS : 0)))
  const avgDiff = Math.round(diffs.reduce((n, x) => n + x, 0) / diffs.length / 10) * 10
  if (Math.abs(avgDiff) < 100) return '近 7 天日均摄入与每日目标基本持平，保持得不错'
  const n = Math.abs(avgDiff)
  if (goal === 'gain') {
    return avgDiff > 0 ? `近 7 天日均多吃约 ${n} kcal，增肌盈余到位` : `近 7 天日均少吃约 ${n} kcal，增肌期要尽量吃够目标`
  }
  if (goal === 'maintain') {
    return avgDiff > 0 ? `近 7 天日均多吃约 ${n} kcal，注意体重变化` : `近 7 天日均少吃约 ${n} kcal，维持期偏低，可适当加餐`
  }
  return avgDiff > 0
    ? `近 7 天日均多吃约 ${n} kcal，注意缺口累积`
    : `近 7 天日均少吃约 ${n} kcal，别饿过头，持续过低反而掉肌肉`
}
