import { useEffect, useState } from 'react'
import { PhoneFrame } from './components/PhoneFrame'
import { TodayTab } from './tabs/TodayTab'
import { RecordTab } from './tabs/RecordTab'
import { DietTab } from './tabs/DietTab'
import { BodyTab } from './tabs/BodyTab'
import { StatsTab } from './tabs/StatsTab'
import { HistoryTab } from './tabs/HistoryTab'
import { loadBody, loadMeals, loadWorkouts, saveBody, saveMeals, saveWorkouts } from './storage'
import { todayStr } from './lib/streak'
import type { BodyEntry, MealEntry, Workout } from './types'

type Tab = 'today' | 'record' | 'diet' | 'body' | 'stats' | 'history'
type LastAdded = { at: number; appended: boolean; count: number }

export default function App() {
  const [workouts, setWorkouts] = useState<Workout[]>(() => loadWorkouts())
  const [meals, setMeals] = useState<MealEntry[]>(() => loadMeals())
  const [body, setBody] = useState<BodyEntry[]>(() => loadBody())
  const [tab, setTab] = useState<Tab>('today')
  const [lastAdded, setLastAdded] = useState<LastAdded | null>(null)

  // 状态一变就自动存（刷新不丢）
  useEffect(() => saveWorkouts(workouts), [workouts])
  useEffect(() => saveMeals(meals), [meals])
  useEffect(() => saveBody(body), [body])

  // 同一天再记：动作追加进当天的 workout（与体重"同日更新"语义一致），而不是新建一条
  function addWorkout(w: Workout) {
    const appended = workouts.some((x) => x.date === w.date)
    setWorkouts((prev) => {
      const existing = prev.find((x) => x.date === w.date)
      if (!existing) return [w, ...prev]
      return prev.map((x) =>
        x.id === existing.id ? { ...x, exercises: [...x.exercises, ...w.exercises] } : x,
      )
    })
    setLastAdded({ at: w.createdAt, appended, count: w.exercises.length })
    setTab('today') // 保存后跳回今天页
  }
  function deleteWorkout(id: string) {
    setWorkouts((prev) => prev.filter((w) => w.id !== id))
  }

  function addMeal(m: MealEntry) {
    setMeals((prev) => [m, ...prev])
  }
  function deleteMeal(id: string) {
    setMeals((prev) => prev.filter((m) => m.id !== id))
  }

  // 体重：同一天再记 = 更新（按日期去重），并按日期升序排好（方便画趋势）
  function addOrUpdateBody(entry: BodyEntry) {
    setBody((prev) =>
      [...prev.filter((e) => e.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date))
    )
  }
  function deleteBody(id: string) {
    setBody((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col">
        <main className="flex-1 overflow-y-auto">
          {tab === 'today' && (
            <TodayTab
              workouts={workouts}
              lastAdded={lastAdded}
              onGoRecord={() => setTab('record')}
              onGoHistory={() => setTab('history')}
            />
          )}
          {tab === 'record' && (
            <RecordTab onSave={addWorkout} alreadyToday={workouts.some((w) => w.date === todayStr())} />
          )}
          {tab === 'diet' && <DietTab meals={meals} onAdd={addMeal} onDelete={deleteMeal} />}
          {tab === 'body' && <BodyTab body={body} onSave={addOrUpdateBody} onDelete={deleteBody} />}
          {tab === 'stats' && <StatsTab workouts={workouts} />}
          {tab === 'history' && <HistoryTab workouts={workouts} onDelete={deleteWorkout} onBack={() => setTab('today')} />}
        </main>

        <nav className="flex border-t border-line bg-paper">
          <TabButton active={tab === 'today'} onClick={() => setTab('today')} label="今天" icon="🏠" />
          <TabButton active={tab === 'record'} onClick={() => setTab('record')} label="记录" icon="✍️" />
          <TabButton active={tab === 'diet'} onClick={() => setTab('diet')} label="饮食" icon="🍚" />
          <TabButton active={tab === 'body'} onClick={() => setTab('body')} label="身体" icon="⚖️" />
          <TabButton active={tab === 'stats'} onClick={() => setTab('stats')} label="统计" icon="📊" />
        </nav>
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
