import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MealEntry, Workout } from '../types'
import { exerciseRanking, heatmap, overview, weeklyTotals } from '../lib/stats'
import { avgKcalByTraining, kcalTrend } from '../lib/diet'
import { weeklyReport } from '../lib/weekly'
import { estimate1RM, personalRecords } from '../lib/pr'
import { todayStr } from '../lib/streak'
import { ZeroBar } from '../components/ZeroBar'
import { achievements } from '../lib/achievements'

// 从 CSS 变量读颜色，让图表跟着主题走（与 BodyTab 一致）
function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function WeekTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { label: string; days: number; sets: number } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const prefix = d.label === '本周' ? '本周' : `${d.label} 周`
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] text-ink shadow">
      {prefix} · {d.days} 天 · {d.sets} 组
    </div>
  )
}

function KcalTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { date: string; x: string; kcal: number } }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const [, m, day] = d.date.split('-').map(Number)
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] text-ink shadow">
      {m}/{day} · {d.kcal} kcal
    </div>
  )
}

// 热力点颜色：0 组=空槽，其余按组数分 4 档 clay 深浅
function heatColor(sets: number, clay: string, line: string): string {
  if (sets === 0) return line
  const alpha = sets <= 2 ? 0.3 : sets <= 5 ? 0.55 : sets <= 9 ? 0.78 : 1
  const hex = clay.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function StatsTab({ workouts, meals }: { workouts: Workout[]; meals: MealEntry[] }) {
  const clay = token('--color-clay', '#B8553A')
  const muted = token('--color-muted', '#8C8275')
  const line = token('--color-line', '#E2DBCD')
  const ink = token('--color-ink', '#211C16')

  if (workouts.length === 0) {
    return (
      <div className="px-7 pt-16 pb-10">
        <h1 className="font-display text-[28px] text-ink text-center">统计</h1>
        <p className="mt-12 text-center text-[14px] text-muted">还没有训练记录。<br />练几天再回来，这里会长出你的坚持曲线 📊</p>
      </div>
    )
  }

  const ov = overview(workouts)
  const weeks = weeklyTotals(workouts)
  const ranking = exerciseRanking(workouts).slice(0, 5)
  const maxSets = ranking[0]?.sets ?? 1
  const cells = heatmap(workouts)
  const today = todayStr()

  // 饮食板块（没有任何饮食记录时不显示）
  const workoutDates = new Set(workouts.map((w) => w.date))
  const kcal = avgKcalByTraining(meals, workoutDates, 30)
  const trend = kcalTrend(meals, 30).map((d) => ({
    ...d,
    x: d.label === '今' ? '今' : `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8, 10))}`,
  }))
  const hasDiet = meals.length > 0
  const kcalMax = Math.max(kcal.trainAvg, kcal.restAvg, 1)

  // 本周 vs 上周（一次遍历聚合每日热量）
  const kcalByDate = new Map<string, number>()
  for (const m of meals) kcalByDate.set(m.date, (kcalByDate.get(m.date) ?? 0) + m.kcal)
  const report = weeklyReport(workouts, kcalByDate)
  const prs = personalRecords(workouts, 5)
  const weekdayName = '一二三四五六日'[report.elapsedDays - 1]

  return (
    <div className="px-7 pt-16 pb-10">
      <h1 className="font-display text-[28px] text-ink text-center">统计</h1>

      {/* 概览数字 */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        <Stat value={ov.totalDays} unit="天" label="累计打卡" />
        <Stat value={ov.weekDays} unit="天" label="本周训练" />
        <Stat value={ov.totalSets} unit="组" label="累计完成" />
      </div>

      {/* 本周回顾（本周与上周同星期区间对比） */}
      <div className="mt-5 rounded-2xl bg-surface border border-line p-4">
        <p className="font-display text-[13px] italic text-muted mb-3">本周回顾 · 截至周{weekdayName}，对比上周同期</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <WeekCell label="训练天数" cur={report.thisWeek.trainDays} prev={report.lastWeek.trainDays} unit="天" />
          <WeekCell label="完成组数" cur={report.thisWeek.totalSets} prev={report.lastWeek.totalSets} unit="组" />
          <WeekCell
            label={`日均热量${report.thisWeek.kcalDays > 0 ? `（${report.thisWeek.kcalDays} 天）` : ''}`}
            cur={report.thisWeek.kcalDays > 0 ? report.thisWeek.avgKcal : null}
            prev={report.lastWeek.avgKcal}
            prevDays={report.lastWeek.kcalDays}
            unit="kcal"
            neutral
          />
        </div>
      </div>

      {/* 近 8 周训练量 */}
      <div className="mt-5 rounded-2xl bg-surface border border-line p-4">
        <p className="font-display text-[13px] italic text-muted mb-2">近 8 周 · 每周组数</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={weeks} margin={{ top: 5, right: 8, bottom: 0, left: -28 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: muted }} axisLine={{ stroke: line }} tickLine={false} interval={0} />
            <YAxis tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'rgba(140,130,117,0.08)' }} content={<WeekTooltip />} />
            <Bar dataKey="sets" maxBarSize={22} isAnimationActive={false} shape={<ZeroBar fill={clay} zeroFill={line} />} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 饮食：训练日 vs 休息日摄入 */}
      {hasDiet && (
        <div className="mt-5 rounded-2xl bg-surface border border-line p-4">
          <p className="font-display text-[13px] italic text-muted mb-3">近 30 天 · 日均热量</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="font-display text-[24px] leading-none text-clay">{kcal.trainDays > 0 ? kcal.trainAvg : '—'}<span className="text-[12px] text-muted">{kcal.trainDays > 0 ? ' kcal' : ''}</span></p>
              <p className="mt-1 text-[11px] text-muted">训练日（{kcal.trainDays} 天）</p>
              <div className="mt-1.5 h-1.5 rounded-full bg-line overflow-hidden">
                {kcal.trainDays > 0 && <div className="h-full rounded-full bg-clay" style={{ width: `${Math.round((kcal.trainAvg / kcalMax) * 100)}%` }} />}
              </div>
            </div>
            <div>
              <p className="font-display text-[24px] leading-none text-ink">{kcal.restDays > 0 ? kcal.restAvg : '—'}<span className="text-[12px] text-muted">{kcal.restDays > 0 ? ' kcal' : ''}</span></p>
              <p className="mt-1 text-[11px] text-muted">休息日（{kcal.restDays} 天）</p>
              <div className="mt-1.5 h-1.5 rounded-full bg-line overflow-hidden">
                {kcal.restDays > 0 && <div className="h-full rounded-full bg-ink/60" style={{ width: `${Math.round((kcal.restAvg / kcalMax) * 100)}%` }} />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 饮食：近 30 天趋势 */}
      {hasDiet && (
        <div className="mt-5 rounded-2xl bg-surface border border-line p-4">
          <p className="font-display text-[13px] italic text-muted mb-2">近 30 天 · 每日热量</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={trend} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
              <XAxis dataKey="x" tick={{ fontSize: 9, fill: muted }} axisLine={{ stroke: line }} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
              <YAxis tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} width={36} />
              <Tooltip cursor={{ fill: 'rgba(140,130,117,0.08)' }} content={<KcalTooltip />} />
              <Bar dataKey="kcal" maxBarSize={10} isAnimationActive={false} shape={<ZeroBar fill={clay} zeroFill={line} />} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 动作榜 */}
      <div className="mt-5 rounded-2xl bg-surface border border-line p-4">
        <p className="font-display text-[13px] italic text-muted mb-3">动作榜 · Top 5</p>
        <ul className="space-y-2.5">
          {ranking.map((ex) => (
            <li key={ex.name}>
              <div className="flex justify-between text-[13px]">
                <span className="text-ink">{ex.name}</span>
                <span className="text-muted">{ex.sets} 组 · {ex.times} 天</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-line overflow-hidden">
                <div className="h-full rounded-full bg-clay" style={{ width: `${Math.round((ex.sets / maxSets) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* 个人记录（历史最重一组） */}
      {prs.length > 0 && (
        <div className="mt-5 rounded-2xl bg-surface border border-line p-4">
          <p className="font-display text-[13px] italic text-muted mb-2">个人记录 · 历史最重</p>
          <ul className="space-y-1.5">
            {prs.map((pr) => (
              <li key={pr.name} className="flex items-center justify-between text-[14px]">
                <span className="text-ink">{pr.name}</span>
                <span className="text-muted">
                  <span className="text-clay font-medium">{pr.weight}kg</span> × {pr.reps}
                  <span className="ml-1.5 text-[11px]">估1RM {estimate1RM({ reps: pr.reps, weight: pr.weight })}kg</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 打卡热力：左侧星期坐标，12 列 × 周一~周日；今天用描边标出 */}
      <div className="mt-5 rounded-2xl bg-surface border border-line p-4">
        <p className="font-display text-[13px] italic text-muted mb-3">打卡热力 · 近 12 周</p>
        <div className="flex gap-1.5">
          <div className="grid grid-rows-7 gap-[5px]">
            {'一二三四五六日'.split('').map((d) => (
              <span key={d} className="h-2.5 leading-none text-[9px] text-muted">{d}</span>
            ))}
          </div>
          <div className="grid flex-1 grid-flow-col grid-rows-7 gap-[5px] justify-between">
            {cells.map((c) => (
              <span
                key={c.date}
                title={`${c.date} · ${c.sets} 组`}
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: heatColor(c.sets, clay, line),
                  ...(c.date === today ? { boxShadow: `0 0 0 1.5px ${ink}` } : {}),
                }}
              />
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted">
          少
          {[0, 2, 5, 9, 12].map((n) => (
            <span key={n} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: heatColor(n, clay, line) }} />
          ))}
          多
        </div>
      </div>

      {/* 成就里程碑 */}
      <div className="mt-5 rounded-2xl bg-surface border border-line p-4">
        <p className="font-display text-[13px] italic text-muted mb-3">成就 · {achievements(workouts).filter((a) => a.earned).length}/{achievements(workouts).length}</p>
        <div className="grid grid-cols-4 gap-2">
          {achievements(workouts).map((a) => (
            <div
              key={a.id}
              title={a.desc}
              className={`flex flex-col items-center gap-1 rounded-xl py-3 px-1 text-center ${a.earned ? 'bg-paper' : 'opacity-40'}`}
            >
              <span className="text-[22px] leading-none">{a.emoji}</span>
              <span className={`text-[10px] leading-tight ${a.earned ? 'text-ink' : 'text-muted'}`}>{a.title}</span>
              {!a.earned && <span className="text-[9px] text-muted">{a.cur}/{a.target}{a.unit}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ value, unit, label }: { value: number; unit: string; label: string }) {
  return (
    <div className="rounded-2xl bg-surface border border-line py-4 text-center">
      <p className="font-display text-[26px] leading-none text-clay">
        {value}<span className="text-[13px] text-muted">{unit}</span>
      </p>
      <p className="mt-1 text-[11px] text-muted">{label}</p>
    </div>
  )
}


function WeekCell({ label, cur, prev, prevDays = 0, unit, neutral = false }: {
  label: string
  cur: number | null
  prev: number
  prevDays?: number
  unit: string
  neutral?: boolean
}) {
  const arrow = cur == null ? '' : cur > prev ? ' ↑' : cur < prev ? ' ↓' : ' –'
  const diff = (cur ?? 0) - prev
  // 热量箭头用中性色（多吃不一定是好事）；无数据灰色
  const tone = cur == null ? 'text-muted/50' : neutral ? 'text-muted' : diff > 0 ? 'text-clay' : diff < 0 ? 'text-muted' : 'text-muted/60'
  return (
    <div>
      <p className="font-display text-[22px] leading-none text-clay">
        {cur == null ? '—' : cur}<span className="text-[11px] text-muted">{cur == null ? '' : unit}</span>
      </p>
      <p className="mt-1 text-[11px] text-muted leading-tight">{label}</p>
      <p className={`text-[10px] mt-0.5 ${tone}`}>
        {prevDays > 0 ? `上周 ${prev}${arrow}` : cur == null ? '暂无记录' : `上周 0${arrow}`}
      </p>
    </div>
  )
}
