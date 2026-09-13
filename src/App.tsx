import { useEffect, useRef, useState } from 'react'
import { PhoneFrame } from './components/PhoneFrame'
import { TodayTab } from './tabs/TodayTab'
import { RecordTab } from './tabs/RecordTab'
import { DietTab } from './tabs/DietTab'
import { BodyTab } from './tabs/BodyTab'
import { StatsTab } from './tabs/StatsTab'
import { HistoryTab } from './tabs/HistoryTab'
import { Celebration } from './components/Celebration'
import { newlyEarned } from './lib/achievements'
import { newlySetPRs, weekGoalJustReached, weekKey, type CelebrationItem } from './lib/feedback'
import { deleteRoutine, upsertRoutine } from './lib/routines'
import { restorePhotos } from './lib/photos'
import { useRestTimer } from './hooks/useRestTimer'
import { loadMeals, loadMetrics, loadRoutines, loadSettings, loadWater, loadWorkouts, saveMeals, saveMetrics, saveRoutines, saveSettings, saveWater, saveWorkouts } from './storage'
import type { BackupData } from './storage'
import { todayStr } from './lib/streak'
import type { AppSettings, MealEntry, MetricEntry, MetricType, Routine, WaterEntry, Workout } from './types'

const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(36).slice(2)}`

type Tab = 'today' | 'record' | 'diet' | 'body' | 'stats' | 'history'
type LastAdded = { at: number; appended: boolean; count: number; date: string }

export default function App() {
  const [workouts, setWorkouts] = useState<Workout[]>(() => loadWorkouts())
  const [meals, setMeals] = useState<MealEntry[]>(() => loadMeals())
  const [routines, setRoutines] = useState<Routine[]>(() => loadRoutines())
  const [water, setWater] = useState<WaterEntry[]>(() => loadWater())
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [metrics, setMetrics] = useState<MetricEntry[]>(() => loadMetrics())
  const [tab, setTab] = useState<Tab>('today')
  const [lastAdded, setLastAdded] = useState<LastAdded | null>(null)
  const [achQueue, setAchQueue] = useState<CelebrationItem[]>([])
  const [workoutStart, setWorkoutStart] = useState<number | null>(null)
  const restTimer = useRestTimer(90)
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [tab])

  // 状态一变就自动存（刷新不丢）
  useEffect(() => saveWorkouts(workouts), [workouts])
  useEffect(() => saveMeals(meals), [meals])
  useEffect(() => saveRoutines(routines), [routines])
  useEffect(() => saveWater(water), [water])
  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => saveMetrics(metrics), [metrics])

  // 记录开始：今天第一次填表时打点，用于计算训练时长
  function beginWorkout() {
    setWorkoutStart((prev) => prev ?? Date.now())
  }

  // 同一天再记：动作追加进当天的 workout（与体重"同日更新"语义一致），而不是新建一条
  function addWorkout(w: Workout) {
    const appended = workouts.some((x) => x.date === w.date)
    // 训练时长：仅「今天首次新建」时记录；补记过去日不带时长。异常长（>5小时）视为挂起忽略
    const isTodaySave = w.date === todayStr()
    const durationSec = (isTodaySave && workoutStart) ? Math.min(18000, Math.max(30, Math.round((Date.now() - workoutStart) / 1000))) : undefined
    const withDuration: Workout = (!appended && durationSec) ? { ...w, durationSec } : w
    const after = appended
      ? workouts.map((x) => (x.date === w.date ? { ...x, exercises: [...x.exercises, ...w.exercises], note: x.note ?? w.note } : x))
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
    setTab(w.date === todayStr() ? 'today' : 'history')
  }
  function deleteWorkout(id: string) {
    setWorkouts((prev) => prev.filter((w) => w.id !== id))
  }
  // 只删一天里的某个动作（按稳定 id，双击不会误删相邻动作）；最后一个动作删掉时整天记录一起消失
  function removeExercise(workoutId: string, exerciseId: string) {
    setWorkouts((prev) =>
      prev
        .map((w) => (w.id === workoutId ? { ...w, exercises: w.exercises.filter((ex) => ex.id !== exerciseId) } : w))
        .filter((w) => w.exercises.length > 0),
    )
  }
  // 修改历史训练里某动作的组数据（修正错录，不用删除重录）
  function updateExerciseSets(workoutId: string, exerciseId: string, sets: { reps: number; weight?: number }[]) {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId
          ? { ...w, exercises: w.exercises.map((ex) => (ex.id === exerciseId ? { ...ex, sets } : ex)) }
          : w,
      ),
    )
  }

  function addMeal(m: MealEntry) {
    setMeals((prev) => [m, ...prev])
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
  // 备份恢复：整体替换本地数据（useEffect 会立刻持久化）；照片写入 IndexedDB 并返回恢复结果
  function importBackup(data: BackupData) {
    setWorkouts(data.workouts)
    setMetrics(data.metrics ?? [])
    setMeals(data.meals)
    setRoutines(data.routines)
    setWater(data.water ?? [])
    if (data.settings) setSettings(data.settings) // 老备份无 settings 时保留当前设置
    return data.photos?.length ? restorePhotos(data.photos) : Promise.resolve(undefined)
  }

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col">
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          {tab === 'today' && (
            <TodayTab
              workouts={workouts}
              lastAdded={lastAdded}
              hasCelebration={achQueue.length > 0}
              onGoRecord={() => setTab('record')}
              onGoHistory={() => setTab('history')}
            />
          )}
          {tab === 'record' && (
            <RecordTab
              onSave={addWorkout}
              onBeginWorkout={beginWorkout}
              workouts={workouts}
              routines={routines}
              onUpsertRoutine={handleUpsertRoutine}
              onDeleteRoutine={handleDeleteRoutine}
              restTimer={restTimer}
            />
          )}
          {tab === 'diet' && <DietTab meals={meals} water={water} settings={settings} onAdd={addMeal} onDelete={deleteMeal} onChangeWater={changeWater} onUpdateSettings={updateSettings} onCopyDay={copyMealsDay} />}
          {tab === 'body' && (
            <BodyTab
              metrics={metrics}
              settings={settings}
              onSaveMetric={saveMetric}
              onDeleteMetric={deleteMetric}
              onUpdateSettings={updateSettings}
            />
          )}
          {tab === 'stats' && <StatsTab workouts={workouts} meals={meals} settings={settings} onUpdateSettings={updateSettings} />}
          {tab === 'history' && (
            <HistoryTab workouts={workouts} onDelete={deleteWorkout} onRemoveExercise={removeExercise} onUpdateSets={updateExerciseSets} onBack={() => setTab('today')} onImport={importBackup} lastAdded={lastAdded} hasCelebration={achQueue.length > 0} />
          )}
        </main>

        <nav className="flex border-t border-line bg-paper">
          <TabButton active={tab === 'today'} onClick={() => setTab('today')} label="今天" icon="🏠" />
          <TabButton active={tab === 'record'} onClick={() => setTab('record')} label="记录" icon="✍️" />
          <TabButton active={tab === 'diet'} onClick={() => setTab('diet')} label="饮食" icon="🍚" />
          <TabButton active={tab === 'body'} onClick={() => setTab('body')} label="身体" icon="⚖️" />
          <TabButton active={tab === 'stats'} onClick={() => setTab('stats')} label="统计" icon="📊" />
        </nav>
      {achQueue.length > 0 && <Celebration queue={achQueue} onClose={() => setAchQueue([])} />}
      </div>
    </PhoneFrame>
  )
}

function TabButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] transition ${active ? 'text-clay' : 'text-muted'}`}
    >
      <span className="text-[18px] leading-none">{icon}</span>
      {label}
      <span className={`h-1 w-1 rounded-full ${active ? 'bg-clay' : 'bg-transparent'}`} />
    </button>
  )
}
