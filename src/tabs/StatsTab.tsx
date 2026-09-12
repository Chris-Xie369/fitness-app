import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Workout } from '../types'
import { exerciseRanking, heatmap, overview, weeklyTotals } from '../lib/stats'
import { todayStr } from '../lib/streak'
import { ZeroBar } from '../components/ZeroBar'

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

export function StatsTab({ workouts }: { workouts: Workout[] }) {
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
  const rawWeeks = weeklyTotals(workouts)
  const weeks = rawWeeks.map((w, i) => (i === rawWeeks.length - 1 ? { ...w, label: '本周' } : w))
  const hasRecentSets = rawWeeks.some((w) => w.sets > 0)
  const ranking = exerciseRanking(workouts).slice(0, 5)
  const maxSets = ranking[0]?.sets ?? 1
  const cells = heatmap(workouts)
  const today = todayStr()

  return (
    <div className="px-7 pt-16 pb-10">
      <h1 className="font-display text-[28px] text-ink text-center">统计</h1>

      {/* 概览数字 */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        <Stat value={ov.totalDays} unit="天" label="累计打卡" />
        <Stat value={ov.weekDays} unit="天" label="本周训练" />
        <Stat value={ov.totalSets} unit="组" label="累计完成" />
      </div>

      {/* 近 8 周训练量：近 8 周完全没练时给文字，不显示空坐标轴 */}
      <div className="mt-5 rounded-2xl bg-surface border border-line p-4">
        <p className="font-display text-[13px] italic text-muted mb-2">近 8 周 · 每周组数</p>
        {hasRecentSets ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeks} margin={{ top: 5, right: 8, bottom: 0, left: -28 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: muted }} axisLine={{ stroke: line }} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: muted }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'rgba(140,130,117,0.08)' }} content={<WeekTooltip />} />
              <Bar dataKey="sets" maxBarSize={22} isAnimationActive={false} shape={<ZeroBar fill={clay} zeroFill={line} />} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-10 text-center text-[13px] text-muted">近 8 周还没有训练记录</p>
        )}
      </div>

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
