import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BodyEntry } from '../types'
import { todayStr } from '../lib/streak'

const uid = () => globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(36).slice(2)}`

// 从 CSS 变量读颜色，让图表跟着主题走（你改的 clay 等会自动同步到曲线）
function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

export function BodyTab({ body, onSave, onDelete }: { body: BodyEntry[]; onSave: (e: BodyEntry) => void; onDelete: (id: string) => void }) {
  const today = todayStr()
  const todayEntry = body.find((e) => e.date === today)
  const [weight, setWeight] = useState(todayEntry ? String(todayEntry.weightKg) : '')

  const clay = token('--color-clay', '#B8553A')
  const ink = token('--color-ink', '#211C16')
  const muted = token('--color-muted', '#8C8275')
  const line = token('--color-line', '#E2DBCD')
  const surface = token('--color-surface', '#FBF8F1')

  function handleSave() {
    const kg = Number(weight)
    if (!weight || Number.isNaN(kg) || kg <= 0) return
    onSave({ id: todayEntry?.id ?? uid(), date: today, weightKg: kg })
  }

  // body 已按日期升序，最新 = 最后一条，最早 = 第一条
  const latest = body.length > 0 ? body[body.length - 1] : null
  const first = body.length > 0 ? body[0] : null
  const change = latest && first ? latest.weightKg - first.weightKg : 0

  // 图表数据：日期显示成 M/D
  const chartData = body.map((e) => {
    const [, m, d] = e.date.split('-').map(Number)
    return { date: `${m}/${d}`, weight: e.weightKg }
  })

  return (
    <div className="px-7 pt-16 pb-10">
      <h1 className="font-display text-[28px] text-ink text-center">身体</h1>
      <p className="text-[13px] text-muted mt-1 text-center">记录体重，看趋势</p>

      {/* 录入 */}
      <div className="mt-6 flex gap-2">
        <input
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          inputMode="decimal"
          placeholder="今天体重 (kg)"
          className="flex-1 px-4 py-3 rounded-xl border border-line bg-paper text-ink placeholder:text-muted/70 focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
        />
        <button
          onClick={handleSave}
          className="px-5 py-3 rounded-xl bg-clay text-white font-medium hover:bg-clay/90 active:scale-[0.98] transition"
        >
          {todayEntry ? '更新' : '记录'}
        </button>
      </div>

      {/* 当前体重 + 累计变化 */}
      {latest && (
        <div className="mt-6 rounded-2xl bg-surface border border-line p-6 text-center">
          <p className="font-display text-[15px] text-muted">当前体重</p>
          <p className="font-display text-[56px] leading-none mt-1 text-clay">
            {latest.weightKg}<span className="text-[20px] text-muted"> kg</span>
          </p>
          {body.length >= 2 && (
            <p className="mt-3 text-[14px] text-muted">
              累计变化 <span className="text-ink">{change > 0 ? '+' : ''}{change.toFixed(1)} kg</span>
            </p>
          )}
        </div>
      )}

      {/* 趋势图：至少 2 条才画线 */}
      {body.length >= 2 && (
        <div className="mt-5 rounded-2xl bg-surface border border-line p-4">
          <p className="font-display text-[13px] italic text-muted mb-2">体重趋势</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke={line} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: muted }} axisLine={{ stroke: line }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: muted }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: surface, border: `1px solid ${line}`, borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: muted }}
                itemStyle={{ color: ink }}
                formatter={(v) => [`${v} kg`, '体重']}
              />
              <Line type="monotone" dataKey="weight" stroke={clay} strokeWidth={2} dot={{ r: 3, fill: clay }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 记录列表（可删除修正） */}
      {body.length > 0 && (
        <div className="mt-5">
          <p className="font-display text-[13px] italic text-muted mb-2">记录列表</p>
          <ul className="space-y-2">
            {[...body].reverse().map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-xl bg-surface border border-line px-4 py-3">
                <span className="text-[14px] text-ink">{e.weightKg} kg <span className="text-muted">· {e.date}</span></span>
                <button onClick={() => onDelete(e.id)} className="text-muted/50 hover:text-clay text-sm">删除</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {body.length === 0 && (
        <p className="mt-12 text-center text-[14px] text-muted">还没有记录。在上方填一个体重开始 📈</p>
      )}
    </div>
  )
}
