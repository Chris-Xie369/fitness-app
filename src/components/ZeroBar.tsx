// Recharts 柱状图自定义 shape：值为 0 时画 2px 底槽表示"这一期没练/没记"，
// 避免柱子凭空消失让人以为图表坏了。用法：<Bar shape={<ZeroBar fill={clay} zeroFill={line} />} />
// selectedDate + selectedFill：饮食图点柱子选日期时，给选中柱换高亮色
// 透明全高 rect 是点击热区：零值的 2px 底槽在手机上点不中（空日子恰是补记目标）
export function ZeroBar(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: { sets?: number; kcal?: number; date?: string }
  fill?: string
  zeroFill?: string
  selectedFill?: string
  selectedDate?: string
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload, fill, zeroFill, selectedFill, selectedDate } = props
  const value = payload?.sets ?? payload?.kcal ?? 0
  const active = selectedDate && payload?.date === selectedDate
  const slotFill = active && selectedFill ? selectedFill : zeroFill

  if (value === 0) {
    return (
      <g>
        <rect x={x} y={0} width={width} height={y + 2} fill="transparent" />
        <rect x={x} y={y - 2} width={width} height={2} rx={1} fill={slotFill} />
      </g>
    )
  }
  const color = active && selectedFill ? selectedFill : fill
  return <rect x={x} y={y} width={width} height={height} rx={3} fill={color} />
}
