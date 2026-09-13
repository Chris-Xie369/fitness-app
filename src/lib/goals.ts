import { mondayOf } from './stats'

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 今天到本周一累计天数（含今天，1-7）
export function elapsedWeekdays(now = new Date()): number {
  const monday = mondayOf(now)
  return Math.min(7, Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - monday.getTime()) / 86400000) + 1)
}

// 环形进度（SVG）参数
export function ringGeometry(progress: number, radius = 15): { circumference: number; offset: number } {
  const circumference = 2 * Math.PI * radius
  return { circumference, offset: circumference * (1 - Math.min(1, Math.max(0, progress))) }
}

// 最近 7 天每天的杯数（含 0），升序
export function last7Glasses(
  water: { date: string; glasses: number }[],
  today: string,
): { date: string; label: string; glasses: number }[] {
  const map = new Map(water.map((w) => [w.date, w.glasses]))
  const [y, m, d] = today.split('-').map(Number)
  const out: { date: string; label: string; glasses: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const day = new Date(y, m - 1, d - i)
    const key = dateKey(day)
    out.push({ date: key, label: ['日', '一', '二', '三', '四', '五', '六'][day.getDay()], glasses: map.get(key) ?? 0 })
  }
  return out
}
