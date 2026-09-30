// 底部导航图标：统一 2.4px 描边、26px 视觉尺寸，currentColor 随激活态变色
type IconProps = { className?: string }

const base = 'w-[26px] h-[26px]'

export function TodayIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className ?? ''}`} aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  )
}

export function RecordIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className ?? ''}`} aria-hidden>
      <path d="M12 3v4" />
      <path d="m7 8 1 12h8l1-12" />
      <path d="M10 12v5M14 12v5" />
    </svg>
  )
}

export function DietIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className ?? ''}`} aria-hidden>
      {/* 双圆餐盘：盘+菜盘同心圆，与统计图同为几何风 */}
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.6" />
    </svg>
  )
}

export function BodyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className ?? ''}`} aria-hidden>
      {/* 顶视方形体重秤：圆角站面+顶部显示屏，对应体重/体脂/围度记录 */}
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <rect x="9.4" y="7.8" width="5.2" height="3.6" rx="1" />
    </svg>
  )
}

export function StatsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className ?? ''}`} aria-hidden>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </svg>
  )
}
