import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { PhoneFrame } from './components/PhoneFrame'
import { BodyIcon, DietIcon, RecordIcon, StatsIcon, TodayIcon } from './components/icons'
import { TodayTab } from './tabs/TodayTab'
// 首页之外按需加载：初始包不含 recharts 等大依赖，首访该页时才拉取（与 mountedTabs 常驻机制配合）
const RecordTab = lazy(() => import('./tabs/RecordTab').then((m) => ({ default: m.RecordTab })))
const DietTab = lazy(() => import('./tabs/DietTab').then((m) => ({ default: m.DietTab })))
const BodyTab = lazy(() => import('./tabs/BodyTab').then((m) => ({ default: m.BodyTab })))
const StatsTab = lazy(() => import('./tabs/StatsTab').then((m) => ({ default: m.StatsTab })))
const HistoryTab = lazy(() => import('./tabs/HistoryTab').then((m) => ({ default: m.HistoryTab })))
import { Celebration } from './components/Celebration'
import { newlyEarned, newlyEarnedMeals } from './lib/achievements'
import { newlySetPRs, weekGoalJustReached, weekKey, type CelebrationItem } from './lib/feedback'
import { deleteRoutine, upsertRoutine } from './lib/routines'
import { restorePhotos } from './lib/photos'
import { useRestTimer } from './hooks/useRestTimer'
import { loadActivities, loadMeals, loadMetrics, loadRoutines, loadSettings, loadWater, loadWorkouts, saveActivities, saveMeals, saveMetrics, saveRoutines, saveSettings, saveWater, saveWorkouts, takeLoadWarnings } from './storage'
import type { BackupData } from './storage'
import { todayStr } from './lib/streak'
import type { ActivityEntry, AppSettings, MealEntry, MetricEntry, MetricType, Routine, WaterEntry, Workout } from './types'

const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(36).slice(2)}`

type Tab = 'today' | 'record' | 'diet' | 'body' | 'stats' | 'history'
type LastAdded = { at: number; appended: boolean; count: number; date: string }

export default function App() {
  const [workouts, setWorkouts] = useState<Workout[]>(() => loadWorkouts())
  const [meals, setMeals] = useState<MealEntry[]>(() => loadMeals())
  const [routines, setRoutines] = useState<Routine[]>(() => loadRoutines())
  const [water, setWater] = useState<WaterEntry[]>(() => loadWater())
  const [activities, setActivities] = useState<ActivityEntry[]>(() => loadActivities())
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [metrics, setMetrics] = useState<MetricEntry[]>(() => loadMetrics())
  const [tab, setTab] = useState<Tab>('today')
  // 已访问过的 tab 保持挂载（切页用 hidden 隐藏）：表单草稿在去饮食/身体转一圈后还在
  const [mountedTabs, setMountedTabs] = useState<ReadonlySet<Tab>>(() => new Set<Tab>(['today']))
  function go(t: Tab) {
    setTab(t)
    setMountedTabs((prev) => {
      if (prev.has(t)) return prev
      const next = new Set(prev)
      next.add(t)
      return next
    })
  }
  const [lastAdded, setLastAdded] = useState<LastAdded | null>(null)
  const [achQueue, setAchQueue] = useState<CelebrationItem[]>([])
  const [workoutStart, setWorkoutStart] = useState<number | null>(null)
  const restTimer = useRestTimer(90)
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [tab])

  // 状态一变就自动存（刷新不丢）；任一 key 写入失败则横幅提示（记录仍在内存，可重试或先导出）
  const [saveFailed, setSaveFailed] = useState(false)
  const [saveTick, setSaveTick] = useState(0)
  useEffect(() => {
    const ok = [saveWorkouts(workouts), saveMeals(meals), saveRoutines(routines), saveWater(water), saveActivities(activities), saveSettings(settings), saveMetrics(metrics)].every(Boolean)
    setSaveFailed(!ok)
  }, [workouts, meals, routines, water, activities, settings, metrics, saveTick])

  // 上次运行有数据损坏被留底时，首次挂载给用户一句交代（takeLoadWarnings 取走即清）
  const [loadNotice, setLoadNotice] = useState<string | null>(null)
  useEffect(() => {
    const warnings = takeLoadWarnings()
    if (warnings.length > 0) setLoadNotice(`上次有部分数据未通过校验，原始内容已自动留底在本机，本次加载了可用部分：${warnings.join('、')}`)
  }, [])

  // 记录开始：今天第一次填表时打点，用于计算训练时长
  function beginWorkout() {
    setWorkoutStart((prev) => prev ?? Date.now())
  }

  // 同一天再记：动作追加进当天的 workout（与体重"同日更新"语义一致），而不是新建一条
  function addWorkout(w: Workout) {
    const appended = workouts.some((x) => x.date === w.date)
    // 训练时长：仅「今天首次新建」且有明细时记录；补记过去日不带时长。异常长（>5小时）视为挂起忽略
    const isTodaySave = w.date === todayStr()
    const durationSec = (isTodaySave && workoutStart && w.exercises.length > 0) ? Math.min(18000, Math.max(30, Math.round((Date.now() - workoutStart) / 1000))) : undefined
    // updatedAt 只在同日追加时写；新建不写（与类型注释一致，避免「记录于=更新于」的冗余显示）
    const now = Date.now()
    const withDuration: Workout = (!appended && durationSec) ? { ...w, durationSec } : w
    const after = appended
      ? workouts.map((x) => (x.date === w.date ? { ...x, exercises: [...x.exercises, ...w.exercises], note: x.note ?? w.note, updatedAt: now } : x))
      : [withDuration, ...workouts].sort((x, y) => y.date.localeCompare(x.date))
    const earned: CelebrationItem[] = newlyEarned(workouts, after)
    earned.push(...newlySetPRs(workouts, after))
    // 周目标达成：每周只庆祝一次（localStorage 记录已庆祝的周）
    if (weekGoalJustReached(workouts, after, settings.weeklyGoalDays)) {
      const key = weekKey()
      let done = new Set<string>()
      try {
        done = new Set<string>(JSON.parse(localStorage.getItem('fitness-app:celebratedWeeks') ?? '[]'))
      } catch {
        done = new Set<string>()
      }
      if (!done.has(key)) {
        done.add(key)
        try {
          localStorage.setItem('fitness-app:celebratedWeeks', JSON.stringify([...done].slice(-26)))
        } catch {
          /* 配额满等：庆祝仍可弹，只是不记忆 */
        }
        earned.push({ emoji: '🎯', title: '本周目标达成', desc: `本周练满 ${settings.weeklyGoalDays} 天` })
      }
    }
    setWorkouts(after)
    if (earned.length > 0) setAchQueue((q) => [...q, ...earned])
    if (isTodaySave) setWorkoutStart(null) // 补记过去日不清空今天尚未结束的计时
    setLastAdded({ at: w.createdAt, appended, count: w.exercises.length, date: w.date })
    // 记今天跳今天页；补记过去日跳历史页（今天页看不到那条）
    go(w.date === todayStr() ? 'today' : 'history')
  }
  // 一键打卡：不填明细先占住今天的训练日（周目标/连续天数照常计数），之后可再补记动作
  function checkInToday() {
    addWorkout({ id: uid(), date: todayStr(), createdAt: Date.now(), exercises: [] })
  }
  function deleteWorkout(id: string) {
    setWorkouts((prev) => prev.filter((w) => w.id !== id))
  }
  // 只删一天里的某个动作（按稳定 id，双击不会误删相邻动作）；最后一个动作删掉时整天记录一起消失
  function removeExercise(workoutId: string, exerciseId: string) {
    setWorkouts((prev) =>
      prev
        .map((w) => (w.id === workoutId ? { ...w, exercises: w.exercises.filter((ex) => ex.id !== exerciseId) } : w))
        // 只清理本次刚被删空的目标那条；其他空明细的纯打卡记录保留
        .filter((w) => w.id !== workoutId || w.exercises.length > 0),
    )
  }
  // 修改历史训练里某动作的组数据（修正错录，不用删除重录）
  function updateExerciseSets(workoutId: string, exerciseId: string, sets: { reps: number; weight?: number }[]) {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId
          ? { ...w, exercises: w.exercises.map((ex) => (ex.id === exerciseId ? { ...ex, sets } : ex)), updatedAt: Date.now() }
          : w,
      ),
    )
  }

  // 修改某天训练的备注
  function updateWorkoutNote(workoutId: string, note: string) {
    setWorkouts((prev) => prev.map((w) => (w.id === workoutId ? { ...w, note: note.trim() || undefined, updatedAt: Date.now() } : w)))
  }

  function addMeal(m: MealEntry) {
    setMeals((prev) => {
      const earned = newlyEarnedMeals(prev, [m, ...prev], workouts)
      if (earned.length > 0) setAchQueue((q) => [...q, ...earned])
      return [m, ...prev]
    })
  }
  function handleUpsertRoutine(name: string, exercises: { name: string; sets: Routine['exercises'][number]['sets'] }[]) {
    setRoutines((prev) => upsertRoutine(prev, name, exercises))
  }
  function handleDeleteRoutine(id: string) {
    setRoutines((prev) => deleteRoutine(prev, id))
  }
  function changeWater(date: string, delta: number) {
    setWater((prev) => {
      const existing = prev.find((w) => w.date === date)
      const glasses = Math.max(0, Math.min(30, (existing?.glasses ?? 0) + delta))
      const row: WaterEntry = { id: existing?.id ?? uid(), date, glasses, updatedAt: Date.now() }
      return [row, ...prev.filter((w) => w.date !== date)]
    })
  }
  function addActivity(a: ActivityEntry) {
    setActivities((prev) => [a, ...prev])
  }
  function deleteActivity(id: string) {
    setActivities((prev) => prev.filter((x) => x.id !== id))
  }
  function updateSettings(patch: Partial<AppSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }))
  }
  // 把某天的饮食复制到另一天（新 id）
  function copyMealsDay(srcDate: string, targetDate: string) {
    setMeals((prev) => {
      const clones = prev.filter((m) => m.date === srcDate).map((m) => ({ ...m, id: uid(), date: targetDate, createdAt: Date.now() }))
      // 覆盖目标日原有饮食（确认态已提示）
      return [...clones, ...prev.filter((m) => m.date !== targetDate)]
    })
  }
  function deleteMeal(id: string) {
    setMeals((prev) => prev.filter((m) => m.id !== id))
  }

  // 身体指标：同日期+同类型再记为更新（每种类型一天一条）
  function saveMetric(type: MetricType, date: string, value: number) {
    setMetrics((prev) => {
      const entry: MetricEntry = {
        id: prev.find((m) => m.date === date && m.type === type)?.id ?? uid(),
        date,
        type,
        value,
        createdAt: Date.now(),
      }
      return [...prev.filter((m) => !(m.date === date && m.type === type)), entry]
    })
  }
  function deleteMetric(id: string) {
    setMetrics((prev) => prev.filter((m) => m.id !== id))
  }
  // 导入前快照当前数据（仅结构化数据，不含照片）：选好文件即写，不等确认；误导入后可从 preImportBackup 找回
  function snapshotForImport(): boolean {
    try {
      localStorage.setItem(
        'fitness-app:preImportBackup',
        JSON.stringify({ app: 'fitness-app', version: 1, exportedAt: new Date().toISOString(),
          workouts, metrics, meals, routines, water, activities, settings }),
      )
      return true
    } catch {
      return false // 配额满等：快照失败要告诉用户（导入面板会给警告）
    }
  }

  // 备份恢复：整体替换本地数据（useEffect 会立刻持久化）；照片写入 IndexedDB 并返回恢复结果
  function importBackup(data: BackupData) {
    setWorkouts(data.workouts)
    setMetrics(data.metrics ?? [])
    setMeals(data.meals)
    setRoutines(data.routines)
    setWater(data.water ?? [])
    setActivities(data.activities ?? [])
    if (data.settings) setSettings(data.settings) // 老备份无 settings 时保留当前设置
    return data.photos?.length ? restorePhotos(data.photos) : Promise.resolve(undefined)
  }

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col pt-[env(safe-area-inset-top)]">
        {loadNotice && (
          <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2 text-[12px] text-muted">
            <span className="min-w-0 flex-1">{loadNotice}</span>
            <button onClick={() => setLoadNotice(null)} className="shrink-0 px-2 py-1 -m-1 text-[12px] text-muted-weak hover:text-clay">知道了</button>
          </div>
        )}
        {saveFailed && (
          <div className="flex flex-wrap items-center gap-2 border-b border-clay/30 bg-clay/10 px-4 py-2 text-[12px] text-ink">
            <span className="min-w-40 flex-1">存储写入失败，最近的更改还没保存到本机。记录还在页面上，可重试或先导出备份。</span>
            <button onClick={() => setSaveTick((t) => t + 1)} className="shrink-0 px-2.5 py-1 rounded-lg bg-clay text-white">重试保存</button>
            <button onClick={() => go('history')} className="shrink-0 px-2.5 py-1 rounded-lg border border-clay/40 text-clay">去导出备份</button>
          </div>
        )}
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          <div hidden={tab !== 'today'}>
            <TodayTab
              workouts={workouts}
              lastAdded={lastAdded}
              weeklyGoalDays={settings.weeklyGoalDays}
              hasCelebration={achQueue.length > 0}
              onCheckIn={checkInToday}
              onGoRecord={() => go('record')}
              onGoHistory={() => go('history')}
            />
          </div>
          {mountedTabs.has('record') && (
            <div hidden={tab !== 'record'}>
              <Suspense fallback={<p className="py-16 text-center text-[13px] text-muted">加载中…</p>}>
                <RecordTab
                  onSave={addWorkout}
                  onBeginWorkout={beginWorkout}
                  workouts={workouts}
                  routines={routines}
                  onUpsertRoutine={handleUpsertRoutine}
                  onDeleteRoutine={handleDeleteRoutine}
                  restTimer={restTimer}
                />
              </Suspense>
            </div>
          )}
          {mountedTabs.has('diet') && (
            <div hidden={tab !== 'diet'}>
              <Suspense fallback={<p className="py-16 text-center text-[13px] text-muted">加载中…</p>}>
                <DietTab meals={meals} water={water} workouts={workouts} metrics={metrics} settings={settings} activities={activities} onAdd={addMeal} onDelete={deleteMeal} onChangeWater={changeWater} onAddActivity={addActivity} onDeleteActivity={deleteActivity} onUpdateSettings={updateSettings} onCopyDay={copyMealsDay} />
              </Suspense>
            </div>
          )}
          {mountedTabs.has('body') && (
            <div hidden={tab !== 'body'}>
              <Suspense fallback={<p className="py-16 text-center text-[13px] text-muted">加载中…</p>}>
                <BodyTab
                  metrics={metrics}
                  settings={settings}
                  onSaveMetric={saveMetric}
                  onDeleteMetric={deleteMetric}
                  onUpdateSettings={updateSettings}
                />
              </Suspense>
            </div>
          )}
          {mountedTabs.has('stats') && (
            <div hidden={tab !== 'stats'}>
              <Suspense fallback={<p className="py-16 text-center text-[13px] text-muted">加载中…</p>}>
                <StatsTab workouts={workouts} meals={meals} settings={settings} activities={activities} onUpdateSettings={updateSettings} />
              </Suspense>
            </div>
          )}
          {mountedTabs.has('history') && (
            <div hidden={tab !== 'history'}>
              <Suspense fallback={<p className="py-16 text-center text-[13px] text-muted">加载中…</p>}>
                <HistoryTab workouts={workouts} meals={meals} metrics={metrics} routines={routines} water={water} activities={activities} onDelete={deleteWorkout} onRemoveExercise={removeExercise} onUpdateSets={updateExerciseSets} onUpdateNote={updateWorkoutNote} onBack={() => go('today')} onImport={importBackup} onSnapshot={snapshotForImport} lastAdded={lastAdded} hasCelebration={achQueue.length > 0} />
              </Suspense>
            </div>
          )}
        </main>

        <nav className="flex border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]">
          <TabButton active={tab === 'record'} onClick={() => go('record')} label="记录" icon={<RecordIcon />} />
          <TabButton active={tab === 'diet'} onClick={() => go('diet')} label="饮食" icon={<DietIcon />} />
          <TabButton active={tab === 'today' || tab === 'history'} onClick={() => go('today')} label="打卡" icon={<TodayIcon />} />
          <TabButton active={tab === 'body'} onClick={() => go('body')} label="身体" icon={<BodyIcon />} />
          <TabButton active={tab === 'stats'} onClick={() => go('stats')} label="统计" icon={<StatsIcon />} />
        </nav>
      {achQueue.length > 0 && <Celebration queue={achQueue} onClose={() => setAchQueue([])} />}
      </div>
    </PhoneFrame>
  )
}

function TabButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] transition ${active ? 'text-clay font-medium' : 'text-muted'}`}
    >
      <span className={`rounded-xl px-2.5 py-1 leading-none transition ${active ? 'bg-clay/15' : ''}`}>{icon}</span>
      {label}
    </button>
  )
}
