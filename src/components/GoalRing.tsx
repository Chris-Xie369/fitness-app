import { ringGeometry } from '../lib/goals'

// 周目标环：纸色轨道 + 达标 clay / 未达标 ink 的进度弧。
// showText=false 用于旁边已有大数字的场景（今天页），避免同一数据显示两遍
export function GoalRing({ value, goal, size = 38, showText = true }: { value: number; goal: number; size?: number; showText?: boolean }) {
  const done = value >= goal
  const r = size / 2 - 4
  const c = size / 2
  const { circumference, offset } = ringGeometry(value / goal, r)
  return (
    <svg
      width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90"
      {...(showText ? { role: 'img' as const, 'aria-label': `周目标 ${value}/${goal}` } : { 'aria-hidden': true })}
    >
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--color-line)" strokeWidth={size / 11} />
      <circle
        cx={c} cy={c} r={r} fill="none"
        stroke={done ? 'var(--color-clay)' : 'var(--color-ink)'}
        strokeWidth={size / 11} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
      />
      {showText && (
        <text x={c} y={c} transform={`rotate(90 ${c} ${c})`} textAnchor="middle" dominantBaseline="central" fontSize={size / 3.6} fill="var(--color-ink)">
          {value}/{goal}
        </text>
      )}
    </svg>
  )
}
