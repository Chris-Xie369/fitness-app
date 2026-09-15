// 训练相关
export type SetEntry = {
  reps: number
  weight?: number
}

export type Exercise = {
  id?: string
  name: string
  sets: SetEntry[]
}

export type Workout = {
  id: string
  date: string
  exercises: Exercise[]
  note?: string
  durationSec?: number
  createdAt: number
}

// 身体记录（阶段 2）
export type BodyEntry = {
  id: string
  date: string
  weightKg: number
}

// 饮食记录（三餐热量版）
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type MealEntry = {
  id: string
  date: string
  meal: MealType
  name: string
  kcal: number
  createdAt: number
}

// 训练模板（如"推日""腿日"）
export type Routine = {
  id: string
  name: string
  createdAt: number
  exercises: { name: string; sets: SetEntry[] }[]
}

// 喝水记录（一天一条）
export type WaterEntry = {
  id: string
  date: string
  glasses: number
  updatedAt: number
}

// 应用设置（profile 字段用于派生 BMI/BMR，可选）
export type AppSettings = {
  weeklyGoalDays: number
  waterGoal: number
  heightCm?: number
  sex?: 'male' | 'female'
  birthYear?: number
  // 饮食目标
  dietGoal?: 'lose' | 'maintain' | 'gain'
  dietActivity?: number // 活动系数 PAL：1.2/1.375/1.55/1.725
  dietPace?: number // kg/周：0.25/0.5/0.75
}

// 身体指标（通用化：体重/体脂率/腰围…同一天每种一条）
export type MetricType = 'weight' | 'bodyFat' | 'waist' | 'chest' | 'hips' | 'upperArm' | 'thigh'

export type MetricEntry = {
  id: string
  date: string
  type: MetricType
  value: number
  createdAt: number
}
