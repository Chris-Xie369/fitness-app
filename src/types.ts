// 训练相关
export type SetEntry = {
  reps: number
  weight?: number
}

export type Exercise = {
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
