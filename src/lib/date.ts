// 日期相关的通用小工具（本地时区，按日期分量计算，避开 DST 边界问题）

const WEEKDAYS = '日一二三四五六'

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 日期标签：今天/昨天显示相对说法，其余「M月D日 周X」
export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const base = `${m}月${d}日 周${WEEKDAYS[dt.getDay()]}`
  const today = new Date()
  if (date === dateKey(today)) return `今天 · ${base}`
  const yest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (date === dateKey(yest)) return `昨天 · ${base}`
  return base
}

// 前后推 n 天，返回 'YYYY-MM-DD'
export function shiftDate(date: string, deltaDays: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d + deltaDays)
  return dateKey(dt)
}
