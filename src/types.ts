// 一组动作里的「一组」：次数 + 可选重量
export type SetEntry = {
  reps: number      // 这一组做了几次
  weight?: number   // 重量(kg)，自重动作可不填
}

// 一个动作（如卧推），包含若干组
export type Exercise = {
  name: string
  sets: SetEntry[]
}

// 一次完整训练（= 当天的一次打卡）
export type Workout = {
  id: string
  date: string        // 'YYYY-MM-DD'
  exercises: Exercise[]
  note?: string
  createdAt: number
}
