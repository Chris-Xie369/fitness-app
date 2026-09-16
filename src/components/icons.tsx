// 底部导航图标：统一 1.5px 描边、24px 视觉尺寸，currentColor 随激活态变色
type IconProps = { className?: string }

const base = 'w-[22px] h-[22px]'

export function TodayIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className ?? ''}`} aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  )
}

export function RecordIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className ?? ''}`} aria-hidden>
      <path d="M12 3v4" />
      <path d="m7 8 1 12h8l1-12" />
      <path d="M10 12v5M14 12v5" />
    </svg>
  )
}

export function DietIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className ?? ''}`} aria-hidden>
      <path d="M4 11h16a8 8 0 0 1-16 0Z" />
      <path d="M4 11a8 8 0 0 1 16 0" />
      <path d="M8 3.5c-.6 1-.8 2-.5 3M12 3c-.7 1.1-.9 2.2-.6 3.4M16 3.5c-.6 1-.8 2-.5 3" />
    </svg>
  )
}

export function BodyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className ?? ''}`} aria-hidden>
      <circle cx="12" cy="5" r="2.2" />
      <path d="M12 7.5v6" />
      <path d="M12 10 7 12.5M12 10l5 2.5" />
      <path d="M12 13.5 8 21M12 13.5 16 21" />
    </svg>
  )
}

export function StatsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className ?? ''}`} aria-hidden>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </svg>
  )
}
