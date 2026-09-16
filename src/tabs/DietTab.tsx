import { useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import type { AppSettings, MealEntry, MealType, MetricEntry, WaterEntry, Workout } from '../types'
import { dayKcal, dayMacros, learnedKcal, macrosOf, MEAL_TYPES, recentMeals, weeklyKcal } from '../lib/diet'
import { kcalFor, searchFoods } from '../lib/foods'
import { ageFromBirthYear, bmrMifflin } from '../lib/body'
import { ACTIVITY_LEVELS, calorieTarget, dayAdvice, PACE_OPTIONS, TRAINING_DAY_BONUS, weekAdherence, type DietGoal } from '../lib/nutrition'
import { last7Glasses } from '../lib/goals'
import { dayLabel, shiftDate } from '../lib/date'
import { todayStr } from '../lib/streak'
import { ZeroBar } from '../components/ZeroBar'
import { MealPlanView } from '../components/MealPlanView'
import { macroTargets, type ScaledItem } from '../lib/mealplan'

const uid = () => globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(36).slice(2)}`

function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

type PickedFood = { name: string; kcalPer100g: number; learned?: boolean }
type Draft = { name: string; kcal: string; grams: string; picked: PickedFood | null }
// 用工厂而不是共享常量：draft 内含嵌套对象，重置时每次给全新副本
function freshDrafts(): Record<MealType, Draft> {
  return {
    breakfast: { name: '', kcal: '', grams: '', picked: null },
    lunch: { name: '', kcal: '', grams: '', picked: null },
    dinner: { name: '', kcal: '', grams: '', picked: null },
    snack: { name: '', kcal: '', grams: '', picked: null },
  }
}

function KcalTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { date: string; kcal: number } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const [, m, day] = d.date.split('-').map(Number)
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] text-ink shadow">
      {m}/{day} · {d.kcal} kcal
    </div>
  )
}

export function DietTab({
  meals,
  water,
  workouts,
  metrics,
  settings,
  onAdd,
  onDelete,
  onChangeWater,
  onUpdateSettings,
  onCopyDay,
}: {
  meals: MealEntry[]
  water: WaterEntry[]
  workouts: Workout[]
  metrics: MetricEntry[]
  settings: AppSettings
  onAdd: (m: MealEntry) => void
  onDelete: (id: string) => void
  onChangeWater: (date: string, delta: number) => void
  onUpdateSettings: (patch: Partial<AppSettings>) => void
  onCopyDay: (srcDate: string, targetDate: string) => void
}) {
  const [showGoalSetup, setShowGoalSetup] = useState(false)
  const [view, setView] = useState<'log' | 'plan'>('log')
  const [loggedKeys, setLoggedKeys] = useState<string[]>([])
  const today = todayStr()
  const [date, setDate] = useState(today)
  const isToday = date === today
  const dayMeals = meals.filter((m) => m.date === date)
  const total = dayKcal(meals, date)
  const week = weeklyKcal(meals)

  // 热量目标：最近体重 + 身体资料 → Mifflin BMR → TDEE ± 缺口；训练日 +200
  const latestWeight = metrics.filter((m) => m.type === 'weight').sort((a, b) => b.date.localeCompare(a.date))[0]?.value
  const age = ageFromBirthYear(settings.birthYear)
  const hasProfile = !!(latestWeight && settings.heightCm && age > 0 && settings.sex)
  const isTrainingDay = workouts.some((w) => w.date === date)
  const goal: DietGoal = settings.dietGoal ?? 'maintain'
  const targetInfo = hasProfile
    ? calorieTarget({
        bmr: bmrMifflin(latestWeight!, settings.heightCm!, age, settings.sex!),
        pal: settings.dietActivity ?? 1.375,
        goal,
        paceKgPerWeek: settings.dietPace ?? 0.5,
        isTrainingDay,
        sex: settings.sex,
      })
    : null
  const goalLabel = goal === 'lose' ? '减脂' : goal === 'gain' ? '增肌' : '维持'
  const advice = targetInfo ? dayAdvice(total, targetInfo.target, isToday) : ''
  const macrosToday = dayMacros(meals, date)
  const macroTargetsInfo = targetInfo && latestWeight ? macroTargets(latestWeight, goal, targetInfo.target) : null
  const workoutDateSet = new Set(workouts.map((w) => w.date))
  // 周建议只在看今天时显示；按每天自己的目标（训练日 +200）评估，至少 3 天记录
  const weekTip = targetInfo && isToday
    ? weekAdherence(
        week.map((d) => ({ date: d.date, kcal: d.kcal })),
        workoutDateSet,
        targetInfo.restTarget,
        goal,
      )
    : null
  const hasWeekData = week.some((d) => d.kcal > 0)
  const [drafts, setDrafts] = useState(freshDrafts)
  // 自动补全下拉：一次只开一餐；idx 为键盘高亮
  const [suggest, setSuggest] = useState<{ meal: MealType; idx: number } | null>(null)
  const [copyConfirm, setCopyConfirm] = useState(false)
  const recent = recentMeals(meals)
  const todayGlasses = water.find((w) => w.date === date)?.glasses ?? 0
  const weekGlasses = last7Glasses(water, today)

  const clay = token('--color-clay', '#B8553A')
  const ink = token('--color-ink', '#211C16')
  const muted = token('--color-muted', '#8C8275')
  const line = token('--color-line', '#E2DBCD')

  function goTo(next: string) {
    setDate(next)
    setDrafts(freshDrafts())
    setCopyConfirm(false)
    setLoggedKeys([])
    setSuggest(null)
  }
  // 函数式更新：快速连点不丢步
  function stepDate(delta: number) {
    setDate((prev) => {
      const next = shiftDate(prev, delta)
      return delta > 0 && next > today ? prev : next
    })
    setDrafts(freshDrafts())
    setCopyConfirm(false)
    setLoggedKeys([])
    setSuggest(null)
  }

  function setDraft(meal: MealType, patch: Partial<Draft>) {
    setDrafts((p) => ({ ...p, [meal]: { ...p[meal], ...patch } }))
  }

  // 当前餐下拉建议：库内匹配 + 同名历史估算（库内精确命中时不重复显示学到项）
  function suggestionsFor(meal: MealType): PickedFood[] {
    const q = drafts[meal].name.trim()
    if (!q) return []
    const fromLib: PickedFood[] = searchFoods(q).map((f) => ({ name: f.name, kcalPer100g: f.kcalPer100g }))
    if (fromLib.some((f) => f.name === q)) return fromLib
    const learned = learnedKcal(meals, q)
    if (learned != null) return [...fromLib, { name: q, kcalPer100g: learned, learned: true }]
    return fromLib
  }

  // 选中某条建议：进入克数模式
  function pickFood(meal: MealType, food: PickedFood) {
    setDraft(meal, { name: food.name, picked: food, grams: '', kcal: '' })
    setSuggest(null)
  }

  // 克数模式生效条件（两条路径）：
  // ① 显式点选下拉某条（库内食物或「上次估算」）
  // ② 精确输入库内食物名
  // 手填过大卡时一律以大卡为准：避免补全名字/点历史胶囊时静默吞掉已输入的数值
  function resolveFood(meal: MealType): PickedFood | null {
    const d = drafts[meal]
    const q = d.name.trim()
    if (!q) return null
    if (d.picked && d.picked.name === q) return d.picked
    if (d.kcal) return null
    const hit = searchFoods(q).find((f) => f.name === q)
    if (hit) return { name: hit.name, kcalPer100g: hit.kcalPer100g }
    return null
  }

  // 单条食物热量上限：超过 1 万大卡基本是输错了
  const MAX_KCAL = 10000
  // 克数按 0.1 取整（与写入记录一致）：避免 0.04g 这类输入产生 0g/0kcal 记录
  const roundGrams = (raw: string): number => Math.round(Number(raw) * 10) / 10

  function canAdd(meal: MealType): boolean {
    const d = drafts[meal]
    if (resolveFood(meal)) {
      const g = roundGrams(d.grams)
      return Number.isFinite(g) && g > 0
    }
    if (!d.name.trim() || !d.kcal) return false
    const k = Number(d.kcal)
    // 先取整再判正：0.4 大卡 round 后是 0，不该产生一条 0 kcal 记录
    return Number.isFinite(k) && Math.round(k) > 0 && k <= MAX_KCAL
  }

  function add(meal: MealType) {
    if (!canAdd(meal)) return
    const d = drafts[meal]
    const picked = resolveFood(meal)
    if (picked) {
      const grams = roundGrams(d.grams)
      onAdd({
        id: uid(),
        date,
        meal,
        name: `${picked.name} ${grams}g`,
        kcal: kcalFor(picked.kcalPer100g, grams),
        createdAt: Date.now(),
      })
    } else {
      onAdd({
        id: uid(),
        date,
        meal,
        name: d.name.trim(),
        kcal: Math.round(Number(d.kcal)),
        createdAt: Date.now(),
      })
    }
    setDrafts((p) => ({ ...p, [meal]: { name: '', kcal: '', grams: '', picked: null } }))
    setSuggest(null)
  }

  function applyRecent(meal: MealType, name: string, kcal: number) {
    setDraft(meal, { name, kcal: String(kcal), grams: '', picked: null })
    setSuggest(null)
  }

  // 名字输入框键盘：下拉打开时 ↑↓ 移动、Enter 选中；否则 Enter 添加
  function nameKeyDown(meal: MealType, e: React.KeyboardEvent<HTMLInputElement>) {
    // 中文输入法组合中（拼音选词）的回车不算提交
    if (e.nativeEvent.isComposing) return
    const list = suggestionsFor(meal)
    if (suggest?.meal === meal && list.length > 0) {
      const idx = suggest.idx
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSuggest({ meal, idx: (idx + 1) % list.length })
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSuggest({ meal, idx: (idx - 1 + list.length) % list.length })
        return
      }
      if (e.key === 'Enter' && idx >= 0 && idx < list.length) {
        e.preventDefault()
        pickFood(meal, list[idx])
        return
      }
    }
    if (e.key === 'Enter') add(meal)
  }

  // 复制前一天的全部饮食到当前选中日期（目标已有记录时需二次点击确认）
  function copyPrev() {
    const src = shiftDate(date, -1)
    const hasSrc = meals.some((m) => m.date === src)
    if (!hasSrc) return
    if (dayMeals.length > 0 && !copyConfirm) {
      setCopyConfirm(true)
      setTimeout(() => setCopyConfirm(false), 4000)
      return
    }
    onCopyDay(src, date)
    setCopyConfirm(false)
  }

  // 「换一套」：菜单序号持久化到 settings（刷新/换日保留）
  function chooseMenu(meal: MealType, index: number) {
    onUpdateSettings({ mealChoice: { ...settings.mealChoice, [meal]: index } })
  }

  // 「按菜单记录」：逐项写入当天记录（与手动记录同构，单条可删、进备份）
  function logMenu(meal: MealType, menuId: string, items: ScaledItem[]) {
    // 反向写入：addMeal 前插，倒序遍历后最终展示顺序与菜单一致
    for (const it of [...items].reverse()) {
      onAdd({ id: uid(), date, meal, name: `${it.name} ${it.grams}g`, kcal: it.kcal, createdAt: Date.now() })
    }
    // 多张餐卡的确认态并存，各自 4 秒独立复位（连记多餐不会互相顶掉）
    const key = `${meal}:${menuId}`
    setLoggedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]))
    setTimeout(() => setLoggedKeys((prev) => prev.filter((k) => k !== key)), 4000)
  }

  // 增肌只用慢档：0.75kg/周 = 每天约 +825kcal 盈余，超出部分主要转化为脂肪
  const paceOptions = goal === 'gain' ? PACE_OPTIONS.filter((p) => p.value <= 0.5) : PACE_OPTIONS

  return (
    <div className="px-7 pt-16 pb-10">
      <h1 className="font-display text-[28px] text-ink text-center">饮食</h1>

      <div className="mt-2 flex justify-center gap-1.5">
        <button onClick={() => setView('log')} className={`px-3 py-1 rounded-full text-[12px] border transition ${view === 'log' ? 'bg-clay text-white border-clay' : 'border-line text-muted'}`}>记录</button>
        <button onClick={() => setView('plan')} className={`px-3 py-1 rounded-full text-[12px] border transition ${view === 'plan' ? 'bg-clay text-white border-clay' : 'border-line text-muted'}`}>计划</button>
      </div>

      {/* 日期切换：补记/修改过去任意一天 */}
      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          onClick={() => stepDate(-1)}
          className="h-8 w-8 rounded-full border border-line text-muted hover:text-clay hover:border-clay/40 transition"
          aria-label="前一天"
        >
          ‹
        </button>
        <p className="min-w-[150px] text-center text-[14px] text-ink">{dayLabel(date)}</p>
        <button
          onClick={() => stepDate(1)}
          disabled={isToday}
          className="h-8 w-8 rounded-full border border-line text-muted transition enabled:hover:text-clay enabled:hover:border-clay/40 disabled:opacity-30"
          aria-label="后一天"
        >
          ›
        </button>
      </div>
      <div className="mt-2 flex items-center justify-center gap-3">
        {!isToday && (
          <button onClick={() => goTo(today)} className="py-1 px-3 text-[12px] text-clay hover:underline">回到今天</button>
        )}
        {view === 'log' && (
          <button
            onClick={copyPrev}
            disabled={!meals.some((m) => m.date === shiftDate(date, -1))}
            className={`py-1 px-3 text-[12px] rounded-full border transition disabled:opacity-30 ${copyConfirm ? 'border-clay text-clay' : 'border-line text-muted hover:text-clay'}`}
          >
            {copyConfirm ? '再点一次，将覆盖当天饮食' : '⧉ 复制前一天'}
          </button>
        )}
      </div>

      {view === 'plan' && (
        <MealPlanView
          isToday={isToday}
          isTrainingDay={isTrainingDay}
          dayTarget={targetInfo ? targetInfo.target : null}
          goal={goal}
          weightKg={latestWeight}
          waterGoal={settings.waterGoal}
          mealChoice={settings.mealChoice}
          loggedKeys={loggedKeys}
          onChoose={chooseMenu}
          onLogMenu={logMenu}
        />
      )}

      {view === 'log' && (
        <>
      {/* 热量目标设置（无身体资料时只提示，不展示无效控件） */}
      {hasProfile ? (
      <div className="mt-4 rounded-2xl bg-surface border border-line p-4">
        <button onClick={() => setShowGoalSetup(!showGoalSetup)} className="w-full flex items-center justify-between text-[13px]">
          <span className="font-display italic text-muted">热量目标 · {goalLabel}{goal !== 'maintain' ? ` ${settings.dietPace ?? 0.5}kg/周` : ''}</span>
          <span className="text-clay">{showGoalSetup ? '收起' : `${targetInfo!.target} kcal/天${isTrainingDay ? `（含训练日 +${TRAINING_DAY_BONUS}）` : ''}`}</span>
        </button>
        {showGoalSetup && (
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-[11px] text-muted mb-1">目标</p>
              <div className="flex gap-1.5">
                {([['lose', '减脂'], ['maintain', '维持'], ['gain', '增肌']] as [DietGoal, string][]).map(([v, l]) => (
                  <button key={v} onClick={() => onUpdateSettings({ dietGoal: v })} className={`flex-1 py-1.5 rounded-full text-[12px] border ${goal === v ? 'bg-clay text-white border-clay' : 'border-line text-muted'}`}>{l}</button>
                ))}
              </div>
            </div>
            {goal !== 'maintain' && (
              <div>
                <p className="text-[11px] text-muted mb-1">速度</p>
                <div className="flex gap-1.5">
                  {paceOptions.map((p) => (
                    <button key={p.value} onClick={() => onUpdateSettings({ dietPace: p.value })} className={`flex-1 py-1.5 rounded-full text-[11px] border ${(settings.dietPace ?? 0.5) === p.value ? 'bg-clay text-white border-clay' : 'border-line text-muted'}`}>{p.label}</button>
                  ))}
                </div>
                {goal === 'gain' && (
                  <p className={`text-[10px] mt-1 ${(settings.dietPace ?? 0.5) > 0.5 ? 'text-clay' : 'text-muted/70'}`}>
                    {(settings.dietPace ?? 0.5) > 0.5 ? '当前 0.75kg/周 盈余偏大，建议选 0.5 或 0.25' : '增肌宜慢，速度过快多长脂肪'}
                  </p>
                )}
              </div>
            )}
            <div>
              <p className="text-[11px] text-muted mb-1">日常活动量</p>
              <div className="flex gap-1.5">
                {ACTIVITY_LEVELS.map((a) => (
                  <button key={a.value} onClick={() => onUpdateSettings({ dietActivity: a.value })} className={`flex-1 py-1.5 rounded-full text-[11px] border ${(settings.dietActivity ?? 1.375) === a.value ? 'bg-clay text-white border-clay' : 'border-line text-muted'}`}>{a.label}</button>
                ))}
              </div>
              <p className="text-[10px] text-muted/70 mt-1">{ACTIVITY_LEVELS.find((a) => a.value === (settings.dietActivity ?? 1.375))?.hint}；训练日自动 +200 kcal</p>
            </div>
          </div>
        )}
      </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-surface border border-line p-4 text-center">
          <p className="text-[12px] text-muted">在「身体」页填写体重、身高、性别和出生年后，这里会生成每日热量目标</p>
        </div>
      )}

      {/* 当日热量 vs 目标 */}
      {targetInfo ? (
        <div className="mt-3 rounded-2xl bg-surface border border-line p-5 text-center">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] text-muted text-left">已吃</p>
              <p className="font-display text-[28px] leading-none text-ink">{total}<span className="text-[12px] text-muted"> kcal</span></p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted">{total <= targetInfo.target ? '还能吃' : '已超出'}</p>
              <p className={`font-display text-[40px] leading-none ${total <= targetInfo.target ? 'text-clay' : 'text-ink/60'}`}>
                {Math.abs(targetInfo.target - total)}<span className="text-[14px] text-muted"> kcal</span>
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-line overflow-hidden">
            <div className={`h-full rounded-full ${total > targetInfo.target ? 'bg-ink/50' : 'bg-clay'}`} style={{ width: `${Math.min(100, Math.round((total / targetInfo.target) * 100))}%` }} />
          </div>
          <p className="mt-2 text-[12px] text-muted leading-relaxed">{advice}</p>
          <p className="mt-2 text-[11px] text-muted/80 tabular-nums">
            今日 · 蛋白 {macrosToday.p}g{macroTargetsInfo ? `（${macroTargetsInfo.protein.low}-${macroTargetsInfo.protein.high}g）` : ''}
            {' '}· 碳水 {macrosToday.c}g{macroTargetsInfo ? `（${macroTargetsInfo.carbs.low}-${macroTargetsInfo.carbs.high}g）` : ''}
            {' '}· 脂肪 {macrosToday.f}g{macroTargetsInfo ? `（${macroTargetsInfo.fat.low}-${macroTargetsInfo.fat.high}g）` : ''}
          </p>
          {targetInfo.clamped && goal === 'lose' && (
            <p className="mt-1 text-[11px] text-clay">目标已按安全下限调整（{settings.sex === 'male' ? 1500 : 1200} kcal），建议放慢速度</p>
          )}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl bg-surface border border-line p-6 text-center">
          <p className="font-display text-[15px] text-muted">{isToday ? '今天已吃' : '当天已吃'}</p>
          <p className="font-display text-[56px] leading-none mt-1 text-clay">
            {total}<span className="text-[20px] text-muted"> kcal</span>
          </p>
          <p className="mt-2 text-[11px] text-muted/80">在「身体」页填写体重、身高、性别和出生年后可生成热量目标</p>
          <p className="mt-2 text-[11px] text-muted/80 tabular-nums">
            今日 · 蛋白 {macrosToday.p}g{macroTargetsInfo ? `（${macroTargetsInfo.protein.low}-${macroTargetsInfo.protein.high}g）` : ''}
            {' '}· 碳水 {macrosToday.c}g{macroTargetsInfo ? `（${macroTargetsInfo.carbs.low}-${macroTargetsInfo.carbs.high}g）` : ''}
            {' '}· 脂肪 {macrosToday.f}g{macroTargetsInfo ? `（${macroTargetsInfo.fat.low}-${macroTargetsInfo.fat.high}g）` : ''}
          </p>
        </div>
      )}
      {weekTip && <p className="mt-2 px-1 text-[12px] text-ink/70">📊 {weekTip}</p>}

      {/* 喝水 */}
      <div className="mt-3 rounded-2xl bg-surface border border-line p-4">
        <div className="flex items-center justify-between">
          <p className="text-[15px] text-ink">💧 喝水</p>
          <div className="flex items-center gap-2">
            <button onClick={() => onChangeWater(date, -1)} disabled={todayGlasses === 0} className="h-7 w-7 rounded-full border border-line text-muted enabled:hover:text-clay disabled:opacity-30">－</button>
            <p className="font-display text-[20px] text-clay w-16 text-center tabular-nums">{todayGlasses}<span className="text-[12px] text-muted">/{settings.waterGoal} 杯</span></p>
            <button onClick={() => onChangeWater(date, 1)} className="h-7 w-7 rounded-full bg-clay text-white text-lg leading-none">＋</button>
          </div>
        </div>
        <div className="mt-3 flex items-end justify-between gap-1">
          {weekGlasses.map((g) => (
            <div key={g.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full h-10 flex items-end bg-paper rounded">
                <div className="w-full rounded bg-clay/70" style={{ height: `${Math.min(100, (g.glasses / Math.max(settings.waterGoal, 1)) * 100)}%` }} />
              </div>
              <span className="text-[9px] text-muted">{g.label}</span>
            </div>
          ))}
        </div>
        <button onClick={() => onUpdateSettings({ waterGoal: settings.waterGoal === 8 ? 10 : 8 })} className="mt-2 text-[11px] text-muted/70 hover:text-clay">
          每日目标 {settings.waterGoal} 杯 · 点此切换 8/10
        </button>
      </div>

      {/* 四餐 */}
      <div className="mt-5 space-y-3">
        {MEAL_TYPES.map(({ type, label, emoji }) => {
          const items = dayMeals.filter((m) => m.meal === type)
          const subtotal = items.reduce((n, m) => n + m.kcal, 0)
          const d = drafts[type]
          const picked = resolveFood(type)
          const suggestions = suggest?.meal === type ? suggestionsFor(type) : []
          const gramsNum = picked ? roundGrams(d.grams) : NaN
          const gramsWarn = picked && Number.isFinite(gramsNum) && gramsNum > 2000
          return (
            <div key={type} className="rounded-2xl bg-surface border border-line p-4">
              <div className="flex items-center justify-between">
                <p className="text-[15px] text-ink">{emoji} {label}</p>
                {subtotal > 0 && <p className="text-[12px] text-muted">{subtotal} kcal</p>}
              </div>

              {items.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {items.map((m) => (
                    <li key={m.id} className="flex items-center justify-between text-[14px]">
                      <span className="text-ink">{m.name}</span>
                      <span className="flex items-center gap-2">
                        {(() => {
                          const g = m.name.trim().match(/^(.*?)\s*(\d+(?:\.\d+)?)g$/)
                          const mac = g ? macrosOf(m.name, Number(g[2])) : null
                          return mac ? <span className="text-[10px] text-muted/70 tabular-nums">P{mac.p}·C{mac.c}·F{mac.f}</span> : null
                        })()}
                        <span className="text-muted">{m.kcal} kcal</span>
                        <button onClick={() => onDelete(m.id)} className="-m-3 p-3 leading-none text-muted/50 hover:text-clay text-sm">✕</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {!d.name && suggestions.length === 0 && recent.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recent.slice(0, 6).map((r) => (
                    <button
                      key={r.name}
                      onClick={() => applyRecent(type, r.name, r.kcal)}
                      className="px-2.5 py-1 rounded-full bg-paper border border-line text-[12px] text-ink hover:border-clay/50 hover:text-clay transition"
                    >
                      {r.name} {r.kcal}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative mt-2">
                <div className="flex items-center gap-2">
                  <input
                    value={d.name}
                    onChange={(e) => {
                      setDraft(type, { name: e.target.value })
                      setSuggest({ meal: type, idx: 0 })
                    }}
                    onFocus={() => d.name.trim() && setSuggest({ meal: type, idx: suggest?.meal === type ? suggest.idx : 0 })}
                    onBlur={() => setTimeout(() => setSuggest((s) => (s?.meal === type ? null : s)), 120)}
                    onKeyDown={(e) => nameKeyDown(type, e)}
                    placeholder="食物（如：鸡胸肉）"
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-line bg-paper text-[14px] text-ink placeholder:text-muted/70 focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
                  />
                  {picked ? (
                    <input
                      value={d.grams}
                      onChange={(e) => setDraft(type, { grams: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && add(type)}
                      inputMode="decimal"
                      placeholder="克数"
                      className="w-16 px-3 py-2 rounded-xl border border-line bg-paper text-[14px] text-ink placeholder:text-muted/70 focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
                    />
                  ) : (
                    <input
                      value={d.kcal}
                      onChange={(e) => setDraft(type, { kcal: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && add(type)}
                      inputMode="numeric"
                      placeholder="大卡"
                      className="w-16 px-3 py-2 rounded-xl border border-line bg-paper text-[14px] text-ink placeholder:text-muted/70 focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
                    />
                  )}
                  <button
                    onClick={() => add(type)}
                    disabled={!canAdd(type)}
                    className={`shrink-0 w-9 h-9 rounded-xl text-[18px] leading-none transition ${
                      canAdd(type)
                        ? 'bg-clay text-white hover:bg-clay/90 active:scale-95'
                        : 'bg-line text-muted/60'
                    }`}
                  >
                    ＋
                  </button>
                </div>

                {/* 自动补全下拉：文档流内展开（卡片变高、下方卡片下移）——
                    绝对定位会盖住下一张餐卡的输入框，点击被建议行截胡，绝不改回浮层 */}
                {suggestions.length > 0 && (
                  <ul className="mt-1.5 max-h-40 overflow-y-auto rounded-xl border border-line bg-surface shadow">
                    {suggestions.map((s, i) => (
                      <li key={s.name}>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); pickFood(type, s) }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left text-[13px] ${suggest?.idx === i ? 'bg-clay/10 text-clay' : 'text-ink'}`}
                        >
                          <span className="truncate">{s.name}{s.learned && <span className="ml-1 text-[11px] text-muted">上次估算</span>}</span>
                          <span className="ml-2 shrink-0 text-muted tabular-nums">{s.kcalPer100g}/100g</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {picked && Number.isFinite(gramsNum) && gramsNum > 0 && (
                <p className={`mt-1 pl-1 text-[12px] ${gramsWarn ? 'text-clay' : 'text-muted'}`}>
                  ≈ {kcalFor(picked.kcalPer100g, gramsNum)} kcal{gramsWarn ? ' · 克数偏大，确认单位是克？' : ''}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* 近 7 天热量（点柱子跳到那天查看/补记） */}
      <div className="mt-5 rounded-2xl bg-surface border border-line p-4">
        <p className="font-display text-[13px] italic text-muted mb-2">近 7 天 · 每日热量（点柱子可查看/补记）</p>
        {hasWeekData ? (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={week} margin={{ top: 5, right: 8, bottom: 0, left: 8 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: muted }} axisLine={{ stroke: line }} tickLine={false} interval={0} />
              <Tooltip cursor={{ fill: 'rgba(140,130,117,0.08)' }} content={<KcalTooltip />} />
              <Bar
                dataKey="kcal"
                maxBarSize={26}
                isAnimationActive={false}
                shape={<ZeroBar fill={clay} zeroFill={line} selectedFill={ink} selectedDate={date} />}
                onClick={(entry: { payload?: { date: string } }) => entry.payload && goTo(entry.payload.date)}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-[13px] text-muted">近 7 天还没有饮食记录</p>
        )}
      </div>
        </>
      )}
    </div>
  )
}
