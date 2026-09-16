// 环形进度（SVG）参数
export function ringGeometry(progress: number, radius = 15): { circumference: number; offset: number } {
  const circumference = 2 * Math.PI * radius
  return { circumference, offset: circumference * (1 - Math.min(1, Math.max(0, progress))) }
}

