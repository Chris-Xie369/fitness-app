import { useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import type { MealEntry, MealType } from '../types'
import { dayKcal, MEAL_TYPES, weeklyKcal } from '../lib/diet'
import { dayLabel, shiftDate } from '../lib/date'
import { todayStr } from '../lib/streak'
import { ZeroBar } from '../components/ZeroBar'

const uid = () => globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(36).slice(2)}`

function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

type Draft = { name: string; kcal: string }
const emptyDraft: Record<MealType, Draft> = {
  breakfast: { name: '', kcal: '' },
  lunch: { name: '', kcal: '' },
  dinner: { name: '', kcal: '' },
  snack: { name: '', kcal: '' },
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

export function DietTab({ meals, onAdd, onDelete }: { meals: MealEntry[]; onAdd: (m: MealEntry) => void; onDelete: (id: string) => void }) {
  const today = todayStr()
  const [date, setDate] = useState(today)
  const isToday = date === today
  const dayMeals = meals.filter((m) => m.date === date)
  const total = dayKcal(meals, date)
  const week = weeklyKcal(meals)
  const hasWeekData = week.some((d) => d.kcal > 0)
  const [drafts, setDrafts] = useState(emptyDraft)

  const clay = token('--color-clay', '#B8553A')
  const ink = token('--color-ink', '#211C16')
  const muted = token('--color-muted', '#8C8275')
  const line = token('--color-line', '#E2DBCD')

  function goTo(next: string) {
    setDate(next)
    setDrafts(emptyDraft)
  }
  // 函数式更新：快速连点不丢步
  function stepDate(delta: number) {
    setDate((prev) => {
      const next = shiftDate(prev, delta)
      return delta > 0 && next > today ? prev : next
    })
    setDrafts(emptyDraft)
  }

  function setDraft(meal: MealType, field: keyof Draft, value: string) {
    setDrafts((p) => ({ ...p, [meal]: { ...p[meal], [field]: value } }))
  }

  // 单条食物热量上限：超过 1 万大卡基本是输错了
  const MAX_KCAL = 10000

  function canAdd(meal: MealType): boolean {
    const d = drafts[meal]
    if (!d.name.trim() || !d.kcal) return false
    const k = Number(d.kcal)
    // 先取整再判正：0.4 大卡 round 后是 0，不该产生一条 0 kcal 记录
    return Number.isFinite(k) && Math.round(k) > 0 && k <= MAX_KCAL
  }

  function add(meal: MealType) {
    if (!canAdd(meal)) return
    onAdd({
      id: uid(),
      date,
      meal,
      name: drafts[meal].name.trim(),
      kcal: Math.round(Number(drafts[meal].kcal)),
      createdAt: Date.now(),
    })
    setDrafts((p) => ({ ...p, [meal]: { name: '', kcal: '' } }))
  }

  return (
    <div className="px-7 pt-16 pb-10">
      <h1 className="font-display text-[28px] text-ink text-center">饮食</h1>

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
      {!isToday && (
        <div className="mt-2 text-center">
          <button onClick={() => goTo(today)} className="-my-2 py-2 px-3 text-[12px] text-clay hover:underline">回到今天</button>
        </div>
      )}

      {/* 当日总热量 */}
      <div className="mt-4 rounded-2xl bg-surface border border-line p-6 text-center">
        <p className="font-display text-[15px] text-muted">{isToday ? '今天已吃' : '当天已吃'}</p>
        <p className="font-display text-[56px] leading-none mt-1 text-clay">
          {total}<span className="text-[20px] text-muted"> kcal</span>
        </p>
      </div>

      {/* 四餐 */}
      <div className="mt-5 space-y-3">
        {MEAL_TYPES.map(({ type, label, emoji }) => {
          const items = dayMeals.filter((m) => m.meal === type)
          const subtotal = items.reduce((n, m) => n + m.kcal, 0)
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
                        <span className="text-muted">{m.kcal} kcal</span>
                        <button onClick={() => onDelete(m.id)} className="-m-3 p-3 leading-none text-muted/50 hover:text-clay text-sm">✕</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-2 flex items-center gap-2">
                <input
                  value={drafts[type].name}
                  onChange={(e) => setDraft(type, 'name', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && add(type)}
                  placeholder="食物（如：鸡蛋）"
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-line bg-paper text-[14px] text-ink placeholder:text-muted/70 focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
                />
                <input
                  value={drafts[type].kcal}
                  onChange={(e) => setDraft(type, 'kcal', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && add(type)}
                  inputMode="numeric"
                  placeholder="大卡"
                  className="w-16 px-2 py-2 rounded-xl border border-line bg-paper text-[14px] text-ink placeholder:text-muted/70 focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
                />
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
    </div>
  )
}
