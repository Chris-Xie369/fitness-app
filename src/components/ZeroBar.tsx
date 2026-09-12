// Recharts 柱状图自定义 shape：值为 0 时画 2px 底槽表示"这一期没练/没记"，
// 避免柱子凭空消失让人以为图表坏了。用法：<Bar shape={<ZeroBar fill={clay} zeroFill={line} />} />
export function ZeroBar(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: { sets?: number; kcal?: number }
  fill?: string
  zeroFill?: string
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload, fill, zeroFill } = props
  const value = payload?.sets ?? payload?.kcal ?? 0
  if (value === 0) return <rect x={x} y={y - 2} width={width} height={2} rx={1} fill={zeroFill} />
  return <rect x={x} y={y} width={width} height={height} rx={3} fill={fill} />
}
