import type { BodyEntry, MealEntry, Workout } from './types'

const WORKOUTS_KEY = 'fitness-app:workouts'
const BODY_KEY = 'fitness-app:body'
const MEALS_KEY = 'fitness-app:meals'

// 旧版本里"再记一次"会在同一天产生多条 workout，今天页只能看到第一条。
// 归一化：同日期的记录合并成一条，动作按保存先后拼接，保留最早的 id/创建时间。
export function normalizeWorkouts(workouts: Workout[]): Workout[] {
  const byDate = new Map<string, Workout[]>()
  for (const w of workouts) {
    const list = byDate.get(w.date)
    if (list) list.push(w)
    else byDate.set(w.date, [w])
  }

  const merged: Workout[] = []
  for (const list of byDate.values()) {
    const ordered = [...list].sort((a, b) => a.createdAt - b.createdAt)
    const first = ordered[0]
    merged.push({
      id: first.id,
      date: first.date,
      createdAt: first.createdAt,
      exercises: ordered.flatMap((w) => w.exercises),
      note: ordered.map((w) => w.note).find(Boolean),
    })
  }
  // 最新的一天排最前（历史页顺序 & addWorkout 的 find 都依赖这个顺序）
  return merged.sort((a, b) => b.createdAt - a.createdAt)
}

export function loadWorkouts(): Workout[] {
  try {
    const raw = localStorage.getItem(WORKOUTS_KEY)
    return raw ? normalizeWorkouts(JSON.parse(raw) as Workout[]) : []
  } catch {
    return []
  }
}

export function saveWorkouts(workouts: Workout[]): void {
  try {
    localStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts))
  } catch {
    /* 静默失败：内存里仍可正常使用 */
  }
}

export function loadBody(): BodyEntry[] {
  try {
    const raw = localStorage.getItem(BODY_KEY)
    if (!raw) return []
    const data: unknown = JSON.parse(raw)
    return Array.isArray(data) ? (data as BodyEntry[]) : []
  } catch {
    return []
  }
}

export function saveBody(entries: BodyEntry[]): void {
  try {
    localStorage.setItem(BODY_KEY, JSON.stringify(entries))
  } catch {
    /* 静默失败 */
  }
}

const MEAL_VALUES = ['breakfast', 'lunch', 'dinner', 'snack']

// 结构校验：脏 JSON / 调试残留 / 未来 schema 变更都不能让饮食页崩
export function isValidMeal(m: unknown): m is MealEntry {
  if (!m || typeof m !== 'object') return false
  const x = m as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    isValidDate(x.date) &&
    typeof x.name === 'string' &&
    typeof x.kcal === 'number' &&
    Number.isFinite(x.kcal) &&
    x.kcal > 0 &&
    typeof x.createdAt === 'number' &&
    MEAL_VALUES.includes(x.meal as string)
  )
}

export function loadMeals(): MealEntry[] {
  try {
    const raw = localStorage.getItem(MEALS_KEY)
    if (!raw) return []
    const data: unknown = JSON.parse(raw)
    return Array.isArray(data) ? data.filter(isValidMeal) : []
  } catch {
    return []
  }
}

export function saveMeals(meals: MealEntry[]): void {
  try {
    localStorage.setItem(MEALS_KEY, JSON.stringify(meals))
  } catch {
    /* 静默失败 */
  }
}

// ===== 备份导出 / 导入 =====

export type BackupData = { workouts: Workout[]; body: BodyEntry[]; meals: MealEntry[] }

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

// 备份文件的边界：必须是真实存在的日历日，防止手改/第三方文件渲染出 NaN
function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

// 导入时统一重建 id：备份里若有重复 id，原样保留会让"删除一条"连删多天
const restoreId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `restore_${Date.now()}_${Math.random().toString(36).slice(2)}`

function isValidWorkout(x: Record<string, unknown>): boolean {
  return (
    typeof x.id === 'string' &&
    isValidDate(x.date) &&
    isNum(x.createdAt) &&
    Array.isArray(x.exercises) &&
    (x.exercises as unknown[]).every((e0) => {
      const e = e0 as Record<string, unknown>
      return (
        typeof e?.name === 'string' &&
        Array.isArray(e.sets) &&
        (e.sets as unknown[]).every((s0) => {
          const s = s0 as Record<string, unknown>
          return isNum(s?.reps) && s.reps > 0 && (s.weight === undefined || (isNum(s.weight) && s.weight > 0))
        })
      )
    })
  )
}

function isValidBodyEntry(x: Record<string, unknown>): boolean {
  return typeof x.id === 'string' && isValidDate(x.date) && isNum(x.weightKg) && x.weightKg > 0
}

// 解析并严格校验备份文件；任何一部分缺失/脏数据都安全降级为空数组，返回 null = 完全不可用
export function parseBackup(text: string): BackupData | null {
  let data: unknown
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>
  const pick = (key: string, valid: (x: Record<string, unknown>) => boolean): Record<string, unknown>[] =>
    Array.isArray(obj[key])
      ? (obj[key] as unknown[]).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && valid(x as Record<string, unknown>))
      : []

  const workouts = normalizeWorkouts(pick('workouts', isValidWorkout) as unknown as Workout[]).map((w) => ({ ...w, id: restoreId() }))
  const body = (pick('body', isValidBodyEntry) as unknown as BodyEntry[])
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ ...e, id: restoreId() }))
  const meals = (pick('meals', (x) => isValidMeal(x)) as unknown as MealEntry[]).map((m) => ({ ...m, id: restoreId() }))

  if (workouts.length === 0 && body.length === 0 && meals.length === 0) return null
  return { workouts, body, meals }
}

// 读出当前全部数据，打包成备份文本
export function exportBackup(): string {
  return JSON.stringify(
    {
      app: 'fitness-app',
      version: 1,
      exportedAt: new Date().toISOString(),
      workouts: loadWorkouts(),
      body: loadBody(),
      meals: loadMeals(),
    },
    null,
    2,
  )
}
