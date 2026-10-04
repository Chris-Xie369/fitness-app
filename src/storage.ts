import type { ActivityEntry, AppSettings, BodyEntry, MealEntry, MealType, MetricEntry, MetricType, Routine, WaterEntry, Workout } from './types'
import { isValidMetricValue } from './lib/body'

const WORKOUTS_KEY = 'fitness-app:workouts'
const BODY_KEY = 'fitness-app:body'
const MEALS_KEY = 'fitness-app:meals'
const ROUTINES_KEY = 'fitness-app:routines'
const WATER_KEY = 'fitness-app:water'
const METRICS_KEY = 'fitness-app:metrics'
const SETTINGS_KEY = 'fitness-app:settings'

export const DEFAULT_SETTINGS: AppSettings = { weeklyGoalDays: 3, waterGoal: 8, dietGoal: 'maintain', dietActivity: 1.375, dietPace: 0.5 }

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(36).slice(2)}`

// 载入警告：记录哪些 key 损坏/含被丢弃的条目，App 首次挂载时取走并展示给用户
const loadWarnings: string[] = []
export function takeLoadWarnings(): string[] {
  // 去重：StrictMode 下初始化器双跑会把同一 key 压入两次
  return Array.from(new Set(loadWarnings.splice(0, loadWarnings.length)))
}

// 损坏或含脏条目的 key：原始内容另存 .rescue 副本（配额满则放弃，不再阻塞载入）
function rescueKey(key: string, raw: string): void {
  try {
    localStorage.setItem(`${key}.rescue`, raw)
  } catch {
    /* ignore */
  }
}

// 列表类载入的通用路径：解析失败/非数组/含脏条目都留底原始内容并计入警告
function loadList<T>(key: string, label: string, valid: (x: unknown) => x is T): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) {
      rescueKey(key, raw)
      loadWarnings.push(label)
      return []
    }
    const kept = data.filter(valid)
    if (kept.length !== data.length) {
      rescueKey(key, raw)
      loadWarnings.push(`${label}（保留 ${kept.length}/${data.length} 条）`)
    }
    return kept
  } catch {
    const raw = localStorage.getItem(key)
    if (raw) {
      rescueKey(key, raw)
      loadWarnings.push(label)
    }
    return []
  }
}

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
    // 同日追加的最新保存时间：从最近到最早找第一条带 updatedAt 的
    const updatedAt = [...ordered].reverse().map((w) => w.updatedAt).find((v) => typeof v === 'number' && v > 0)
    // 同一训练内动作 id 必须唯一：导入合并可能带来重复 id，重复会让「按 id 删除」一次移除多条
    const seenIds = new Set<string>()
    merged.push({
      id: first.id,
      date: first.date,
      createdAt: first.createdAt,
      ...(updatedAt ? { updatedAt } : {}),
      durationSec: ordered.map((w) => w.durationSec).find((v) => typeof v === 'number' && v > 0),
      exercises: ordered.flatMap((w) => w.exercises).map((ex) => {
        if (!ex.id || seenIds.has(ex.id)) {
          const fresh = { ...ex, id: newId() }
          seenIds.add(fresh.id)
          return fresh
        }
        seenIds.add(ex.id)
        return ex
      }),
      note: ordered.map((w) => w.note).find((v) => typeof v === 'string' && v),
    })
  }
  // 最新的一天排最前（按日期而非录入时间：补记过去日时 createdAt 是"现在"，日期才是真实顺序）
  return merged.sort((a, b) => b.date.localeCompare(a.date))
}

export function loadWorkouts(): Workout[] {
  try {
    const raw = localStorage.getItem(WORKOUTS_KEY)
    if (!raw) return []
    const data: unknown = JSON.parse(raw)
    // 与其它加载器一致：非数组/含脏条目逐条过滤（isValidWorkout 为函数声明，此处可用）
    if (!Array.isArray(data)) throw new Error('workouts is not an array')
    const valid = (data as unknown[]).filter(
      (x): x is Record<string, unknown> => !!x && typeof x === 'object' && isValidWorkout(x as Record<string, unknown>),
    ) as unknown as Workout[]
    if (valid.length !== data.length) {
      // 有坏条目：把原始数据另存救援副本，再返回干净数据（不静默丢失）
      try { localStorage.setItem(WORKOUTS_KEY + '.rescue', raw) } catch { /* 配额满则放弃救援副本 */ }
      loadWarnings.push(`训练（保留 ${valid.length}/${data.length} 条）`)
    }
    return normalizeWorkouts(valid)
  } catch {
    // 解析彻底失败：保留原始字符串供人工恢复，绝不用 [] 覆盖
    try {
      const raw = localStorage.getItem(WORKOUTS_KEY)
      if (raw) localStorage.setItem(WORKOUTS_KEY + '.rescue', raw)
    } catch { /* ignore */ }
    loadWarnings.push('训练')
    return []
  }
}

export function saveWorkouts(workouts: Workout[]): boolean {
  try {
    localStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts))
    return true
  } catch {
    return false // 写入失败：内存里仍可正常使用，由 App 提示用户重试/导出
  }
}

const MEAL_VALUES = ['breakfast', 'lunch', 'dinner', 'snack']

// mealChoice 白名单校验：key 必须是合法餐别，值是 0-10 的整数（菜单序号）
export function isValidMealChoice(v: unknown): Partial<Record<MealType, number>> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const out: Partial<Record<MealType, number>> = {}
  for (const [k, val] of Object.entries(v)) {
    if (MEAL_VALUES.includes(k) && typeof val === 'number' && Number.isInteger(val) && val >= 0 && val <= 10) {
      out[k as MealType] = val
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

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
  return loadList(MEALS_KEY, '饮食', isValidMeal)
}

export function saveMeals(meals: MealEntry[]): boolean {
  try {
    localStorage.setItem(MEALS_KEY, JSON.stringify(meals))
    return true
  } catch {
    return false
  }
}

export function loadRoutines(): Routine[] {
  return loadList(ROUTINES_KEY, '训练模板', isValidRoutine)
}

export function saveRoutines(routines: Routine[]): boolean {
  try {
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(routines))
    return true
  } catch {
    return false
  }
}

function isValidRoutine(r: unknown): r is Routine {
  if (!r || typeof r !== 'object') return false
  const x = r as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    isNum(x.createdAt) &&
    Array.isArray(x.exercises) &&
    (x.exercises as unknown[]).every((e0) => {
      const e = e0 as Record<string, unknown>
      return (
        typeof e?.name === 'string' &&
        Array.isArray(e.sets) &&
        (e.sets as unknown[]).every(
          (s0) => {
            const s = s0 as Record<string, unknown>
            return isNum(s?.reps) && s.reps > 0 && (s.weight === undefined || (isNum(s.weight) && s.weight > 0))
          },
        )
      )
    })
  )
}

export function loadWater(): WaterEntry[] {
  return loadList(WATER_KEY, '饮水', isValidWater)
}

export function saveWater(water: WaterEntry[]): boolean {
  try {
    localStorage.setItem(WATER_KEY, JSON.stringify(water))
    return true
  } catch {
    return false
  }
}

function isValidWater(w: unknown): w is WaterEntry {
  if (!w || typeof w !== 'object') return false
  const x = w as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    isValidDate(x.date) &&
    isNum(x.glasses) && Number.isInteger(x.glasses) && x.glasses >= 0 && x.glasses <= 30 &&
    isNum(x.updatedAt)
  )
}

const ACTIVITIES_KEY = 'fitness-app:activities'
const ACTIVITY_KINDS = ['run', 'walk', 'brisk', 'other']

export function isValidActivity(a: unknown): a is ActivityEntry {
  if (!a || typeof a !== 'object') return false
  const x = a as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    isValidDate(x.date) &&
    ACTIVITY_KINDS.includes(x.kind as string) &&
    isNum(x.minutes) && x.minutes >= 1 && x.minutes <= 600 &&
    isNum(x.kcal) && x.kcal > 0 && x.kcal <= 9000 &&
    isNum(x.createdAt)
  )
}

export function loadActivities(): ActivityEntry[] {
  return loadList(ACTIVITIES_KEY, '运动', isValidActivity)
}

export function saveActivities(activities: ActivityEntry[]): boolean {
  try {
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities))
    return true
  } catch {
    return false
  }
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const x = JSON.parse(raw) as Record<string, unknown>
    return {
      weeklyGoalDays: typeof x.weeklyGoalDays === 'number' && x.weeklyGoalDays >= 1 && x.weeklyGoalDays <= 7 ? x.weeklyGoalDays : DEFAULT_SETTINGS.weeklyGoalDays,
      waterGoal: typeof x.waterGoal === 'number' && x.waterGoal >= 1 && x.waterGoal <= 30 ? x.waterGoal : DEFAULT_SETTINGS.waterGoal,
      heightCm: typeof x.heightCm === 'number' && x.heightCm > 0 ? x.heightCm : undefined,
      sex: x.sex === 'male' || x.sex === 'female' ? x.sex : undefined,
      birthYear: typeof x.birthYear === 'number' && x.birthYear >= 1900 && x.birthYear <= 2100 ? x.birthYear : undefined,
      dietGoal: x.dietGoal === 'lose' || x.dietGoal === 'maintain' || x.dietGoal === 'gain' ? x.dietGoal : DEFAULT_SETTINGS.dietGoal,
      dietActivity: typeof x.dietActivity === 'number' && x.dietActivity >= 1 && x.dietActivity <= 2 ? x.dietActivity : DEFAULT_SETTINGS.dietActivity,
      dietPace: typeof x.dietPace === 'number' && x.dietPace >= 0.1 && x.dietPace <= 1.5 ? x.dietPace : DEFAULT_SETTINGS.dietPace,
      mealChoice: isValidMealChoice(x.mealChoice),
    }
  } catch {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      rescueKey(SETTINGS_KEY, raw)
      loadWarnings.push('设置')
    }
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): boolean {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}

export const METRIC_TYPES: MetricType[] = ['weight', 'bodyFat', 'waist', 'chest', 'hips', 'upperArm', 'thigh']

function isValidMetric(m: unknown): m is MetricEntry {
  if (!m || typeof m !== 'object') return false
  const x = m as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    isValidDate(x.date) &&
    METRIC_TYPES.includes(x.type as MetricType) &&
    isNum(x.value) &&
    isValidMetricValue(x.type as MetricType, x.value) &&
    isNum(x.createdAt)
  )
}

export function loadMetrics(): MetricEntry[] {
  const raw = localStorage.getItem(METRICS_KEY)
  // key 已存在（哪怕是空数组）说明已迁移过，绝不再从旧 key 复活已删除数据
  if (raw !== null) return loadList(METRICS_KEY, '身体', isValidMetric)
  // 老版本只有体重：一次性迁移到通用指标（严格校验，成功后删除旧 key）
  try {
    const legacy = localStorage.getItem(BODY_KEY)
    if (legacy) {
      const old: unknown = JSON.parse(legacy)
      if (!Array.isArray(old)) {
        rescueKey(BODY_KEY, legacy)
        loadWarnings.push('身体（旧数据）')
        return []
      }
      const migrated: MetricEntry[] = old
        .filter(
          (b): b is BodyEntry =>
            !!b &&
            typeof b === 'object' &&
            isValidDate((b as BodyEntry).date) &&
            isNum((b as BodyEntry).weightKg) &&
            isValidMetricValue('weight', (b as BodyEntry).weightKg),
        )
        .map((b) => ({ id: b.id, date: b.date, type: 'weight' as const, value: b.weightKg, createdAt: 0 }))
      localStorage.setItem(METRICS_KEY, JSON.stringify(migrated))
      try {
        localStorage.removeItem(BODY_KEY)
      } catch {
        /* 旧 key 删除失败不影响使用 */
      }
      return migrated
    }
    return []
  } catch {
    return []
  }
}

export function saveMetrics(metrics: MetricEntry[]): boolean {
  try {
    localStorage.setItem(METRICS_KEY, JSON.stringify(metrics))
    return true
  } catch {
    return false
  }
}

// ===== 备份导出 / 导入 =====

export type BackupData = { workouts: Workout[]; body?: BodyEntry[]; metrics: MetricEntry[]; meals: MealEntry[]; routines: Routine[]; water: WaterEntry[]; activities: ActivityEntry[]; settings?: AppSettings; photos?: unknown[] }

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
    (x.updatedAt === undefined || (isNum(x.updatedAt) && x.updatedAt > 0)) &&
    (x.note === undefined || typeof x.note === 'string') &&
    (x.durationSec === undefined || (isNum(x.durationSec) && x.durationSec > 0)) &&
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
  // 前向兼容：拒绝明显不是本 App 的文件；来自更新版本的备份给调用方一个警告
  if (typeof obj.app === 'string' && obj.app !== 'fitness-app') return null
  const pick = (key: string, valid: (x: Record<string, unknown>) => boolean): Record<string, unknown>[] =>
    Array.isArray(obj[key])
      ? (obj[key] as unknown[]).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && valid(x as Record<string, unknown>))
      : []

  const workouts = normalizeWorkouts(pick('workouts', isValidWorkout) as unknown as Workout[]).map((w) => ({ ...w, id: restoreId() }))
  const body = (pick('body', isValidBodyEntry) as unknown as BodyEntry[])
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ ...e, id: restoreId() }))
  // 新备份用 metrics；旧备份的体重映射进来（同日有 weight 指标时以新指标为准）
  const metricsFromBody: MetricEntry[] = body.map((b) => ({ id: restoreId(), date: b.date, type: 'weight' as const, value: b.weightKg, createdAt: 0 }))
  const metricsNew = (pick('metrics', isValidMetric) as unknown as MetricEntry[]).map((m) => ({ ...m, id: restoreId() }))
  const metrics = [...metricsFromBody.filter((m) => !metricsNew.some((n) => n.date === m.date && n.type === m.type)), ...metricsNew]
  const meals = (pick('meals', (x) => isValidMeal(x)) as unknown as MealEntry[]).map((m) => ({ ...m, id: restoreId() }))
  const routines = pick('routines', isValidRoutine) as unknown as Routine[]
  const water = pick('water', isValidWater) as unknown as WaterEntry[]
  const activities = (pick('activities', (x) => isValidActivity(x)) as unknown as ActivityEntry[]).map((a) => ({ ...a, id: restoreId() }))
  const rawSettings = (obj.settings ?? null) as Record<string, unknown> | null
  const settings: AppSettings | undefined = rawSettings
    ? {
        weeklyGoalDays: typeof rawSettings.weeklyGoalDays === 'number' && rawSettings.weeklyGoalDays >= 1 && rawSettings.weeklyGoalDays <= 7 ? rawSettings.weeklyGoalDays : DEFAULT_SETTINGS.weeklyGoalDays,
        waterGoal: typeof rawSettings.waterGoal === 'number' && rawSettings.waterGoal >= 1 && rawSettings.waterGoal <= 30 ? rawSettings.waterGoal : DEFAULT_SETTINGS.waterGoal,
        heightCm: typeof rawSettings.heightCm === 'number' && rawSettings.heightCm > 0 ? rawSettings.heightCm : undefined,
        sex: rawSettings.sex === 'male' || rawSettings.sex === 'female' ? rawSettings.sex : undefined,
        birthYear: typeof rawSettings.birthYear === 'number' && rawSettings.birthYear >= 1900 && rawSettings.birthYear <= 2100 ? rawSettings.birthYear : undefined,
        dietGoal: rawSettings.dietGoal === 'lose' || rawSettings.dietGoal === 'maintain' || rawSettings.dietGoal === 'gain' ? rawSettings.dietGoal : DEFAULT_SETTINGS.dietGoal,
        dietActivity: typeof rawSettings.dietActivity === 'number' && rawSettings.dietActivity >= 1 && rawSettings.dietActivity <= 2 ? rawSettings.dietActivity : DEFAULT_SETTINGS.dietActivity,
        dietPace: typeof rawSettings.dietPace === 'number' && rawSettings.dietPace >= 0.1 && rawSettings.dietPace <= 1.5 ? rawSettings.dietPace : DEFAULT_SETTINGS.dietPace,
        mealChoice: isValidMealChoice(rawSettings.mealChoice),
      }
    : undefined

  const hasProfile = !!settings && (settings.heightCm != null || settings.sex != null || settings.birthYear != null)
  // photos 逐项校验：全部无效的照片不能让空集合获得「可导入」资格（restorePhotos 阶段还有二次解码校验）
  const photos = Array.isArray(obj.photos) ? (obj.photos as unknown[]).filter(isValidPhotoBackup) : []
  if (
    workouts.length === 0 &&
    body.length === 0 &&
    metrics.length === 0 &&
    meals.length === 0 &&
    routines.length === 0 &&
    water.length === 0 &&
    activities.length === 0 &&
    photos.length === 0 &&
    !hasProfile
  )
    return null
  return { workouts, body: [], metrics, meals, routines, water, activities, settings, photos }
}

// 备份里的照片条目：字段齐全、dataUrl 是图片前缀且尺寸在导出上限内（真正可解码性由 restorePhotos 校验）
function isValidPhotoBackup(p: unknown): boolean {
  if (!p || typeof p !== 'object') return false
  const x = p as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    x.id.length > 0 &&
    isValidDate(x.date) &&
    isNum(x.createdAt) &&
    typeof x.mime === 'string' &&
    x.mime.startsWith('image/') &&
    typeof x.dataUrl === 'string' &&
    x.dataUrl.startsWith('data:image/') &&
    x.dataUrl.length < 28_000_000
  )
}

// 备份顶层版本/来源警告（parseBackup 通过后调用）：未来版本备份给用户显式提示
export function backupMetaWarning(text: string): string | null {
  try {
    const obj = JSON.parse(text.replace(/^﻿/, '')) as Record<string, unknown>
    if (typeof obj.version === 'number' && obj.version > 1) {
      return '此备份来自更新版本的 App，部分新数据可能无法导入'
    }
    return null
  } catch {
    return null
  }
}

const HINT_KEY = 'fitness-app:backupHint'

export type BackupHintTimes = { lastExportAt: number | null; dismissedAt: number | null }

export function loadBackupHintTimes(): BackupHintTimes {
  try {
    const raw = localStorage.getItem(HINT_KEY)
    if (!raw) return { lastExportAt: null, dismissedAt: null }
    const x = JSON.parse(raw) as Record<string, unknown>
    return {
      lastExportAt: typeof x.lastExportAt === 'number' ? x.lastExportAt : null,
      dismissedAt: typeof x.dismissedAt === 'number' ? x.dismissedAt : null,
    }
  } catch {
    return { lastExportAt: null, dismissedAt: null }
  }
}

function saveHintTimes(t: BackupHintTimes): void {
  try {
    localStorage.setItem(HINT_KEY, JSON.stringify(t))
  } catch {
    /* 静默失败 */
  }
}

export function markExported(): void {
  const t = loadBackupHintTimes()
  saveHintTimes({ ...t, lastExportAt: Date.now(), dismissedAt: null })
}

export function dismissBackupHint(): BackupHintTimes {
  const t = loadBackupHintTimes()
  const next = { ...t, dismissedAt: Date.now() }
  saveHintTimes(next)
  return next
}

// 读出当前全部数据，打包成备份文本
export function exportBackup(): string {
  return JSON.stringify(
    {
      app: 'fitness-app',
      version: 1,
      exportedAt: new Date().toISOString(),
      workouts: loadWorkouts(),
      body: [],
      metrics: loadMetrics(),
      meals: loadMeals(),
      routines: loadRoutines(),
      water: loadWater(),
      activities: loadActivities(),
      settings: loadSettings(),
    },
    null,
    2,
  )
}
