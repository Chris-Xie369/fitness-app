import { ringGeometry } from '../lib/goals'

// 周目标环：纸色轨道 + 达标 clay / 未达标 ink 的进度弧，中间 N/M
export function GoalRing({ value, goal, size = 38 }: { value: number; goal: number; size?: number }) {
  const done = value >= goal
  const r = size / 2 - 4
  const c = size / 2
  const { circumference, offset } = ringGeometry(value / goal, r)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--color-line)" strokeWidth={size / 11} />
      <circle
        cx={c} cy={c} r={r} fill="none"
        stroke={done ? 'var(--color-clay)' : 'var(--color-ink)'}
        strokeWidth={size / 11} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
      />
      <text x={c} y={c} transform={`rotate(90 ${c} ${c})`} textAnchor="middle" dominantBaseline="central" fontSize={size / 3.6} fill="var(--color-ink)">
        {value}/{goal}
      </text>
    </svg>
  )
}
