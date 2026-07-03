import { useEffect, useState } from 'react'
import { PhoneFrame } from './components/PhoneFrame'
import { TodayTab } from './tabs/TodayTab'
import { RecordTab } from './tabs/RecordTab'
import { HistoryTab } from './tabs/HistoryTab'
import { loadWorkouts, saveWorkouts } from './storage'
import type { Workout } from './types'

type Tab = 'today' | 'record' | 'history'

export default function App() {
  // 所有训练（单一数据源）。惰性初始化：首次渲染从 localStorage 读一次
  const [workouts, setWorkouts] = useState<Workout[]>(() => loadWorkouts())
  const [tab, setTab] = useState<Tab>('today')

  // workouts 一变就自动存（刷新不丢）
  useEffect(() => saveWorkouts(workouts), [workouts])

  function addWorkout(w: Workout) {
    setWorkouts((prev) => [w, ...prev])
    setTab('today') // 保存后跳回今天页，看到刚打的卡
  }
  function deleteWorkout(id: string) {
    setWorkouts((prev) => prev.filter((w) => w.id !== id))
  }

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col">
        <main className="flex-1 overflow-y-auto">
          {tab === 'today' && <TodayTab workouts={workouts} onGoRecord={() => setTab('record')} />}
          {tab === 'record' && <RecordTab onSave={addWorkout} />}
          {tab === 'history' && <HistoryTab workouts={workouts} onDelete={deleteWorkout} />}
        </main>

        <nav className="flex border-t border-line bg-paper">
          <TabButton active={tab === 'today'} onClick={() => setTab('today')} label="今天" icon="🏠" />
          <TabButton active={tab === 'record'} onClick={() => setTab('record')} label="记录" icon="✍️" />
          <TabButton active={tab === 'history'} onClick={() => setTab('history')} label="历史" icon="📅" />
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
