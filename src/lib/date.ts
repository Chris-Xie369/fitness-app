// 本地日历日期的唯一归属模块：日期键格式化、周一、天数差都在这里，其它文件只调用不复制。
// 一律按本地日期分量计算；「天数整数」用 Date.UTC 编码分量，DST 的 23/25 小时日也不会算错。

const WEEKDAYS = '日一二三四五六'
const MS_PER_UTC_DAY = 86400000

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseDateKey(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayStr(now = new Date()): string {
  return dateKey(now)
}

export function dayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_UTC_DAY)
}

export function daysBetween(from: Date, to: Date): number {
  return dayNumber(to) - dayNumber(from)
}

export function mondayOf(d: Date): Date {
  const day = d.getDay()
  const offset = day === 0 ? -6 : 1 - day
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset)
}

export function addDays(d: Date, deltaDays: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + deltaDays)
}

// 日期标签：今天/昨天显示相对说法，其余「M月D日 周X」
export function dayLabel(date: string, now = new Date()): string {
  const dt = parseDateKey(date)
  const base = `${dt.getMonth() + 1}月${dt.getDate()}日 周${WEEKDAYS[dt.getDay()]}`
  if (date === dateKey(now)) return `今天 · ${base}`
  if (date === dateKey(addDays(now, -1))) return `昨天 · ${base}`
  return base
}

// 前后推 n 天，返回 'YYYY-MM-DD'
export function shiftDate(date: string, deltaDays: number): string {
  return dateKey(addDays(parseDateKey(date), deltaDays))
}
