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

// 应用设置
export type AppSettings = {
  weeklyGoalDays: number
  waterGoal: number
}
