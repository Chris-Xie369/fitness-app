// 图表等非 className 场景读取主题色的唯一入口；颜色值只在 index.css 的 @theme 里定义一次。
export type ThemeColor = 'paper' | 'surface' | 'ink' | 'muted' | 'muted-weak' | 'line' | 'clay'

export function themeColor(name: ThemeColor): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim()
}
