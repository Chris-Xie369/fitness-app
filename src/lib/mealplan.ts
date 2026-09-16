import type { MealType } from '../types'
import type { DietGoal } from './nutrition'
import { kcalOf } from './foods'

// 菜单以 2000 kcal 为基准热量定义基准克数，展示/记录时按当日目标缩放
export const BASE_KCAL = 2000

export type MenuItem = { name: string; baseGrams: number; kcalPer100g: number; hint?: string }
export type MealMenu = { id: string; theme: string; items: MenuItem[] }
export type MacroRange = { low: number; high: number }
export type MacroTargets = { protein: MacroRange; fat: MacroRange; carbs: MacroRange }
export type ScaledItem = { name: string; grams: number; kcal: number; hint?: string }

// ===== 宏量营养素目标 =====
// 蛋白质系数 g/kg：减脂保肌肉 2.0、维持 1.6、增肌 1.8；脂肪取热量 25%；碳水吃剩余热量
const PROTEIN_COEFF: Record<DietGoal, number> = { lose: 2.0, maintain: 1.6, gain: 1.8 }

// ±10% 取范围，按 5g 取整（和克数缩放同一套取整语言）
function range5(mid: number): MacroRange {
  const low = Math.max(5, Math.round((mid * 0.9) / 5) * 5)
  return { low, high: Math.max(low, Math.round((mid * 1.1) / 5) * 5) }
}

export function macroTargets(weightKg: number, goal: DietGoal, dayTargetKcal: number): MacroTargets {
  const proteinMid = weightKg * PROTEIN_COEFF[goal]
  const fatMid = (dayTargetKcal * 0.25) / 9
  const carbMid = Math.max(0, dayTargetKcal - proteinMid * 4 - fatMid * 9) / 4
  return { protein: range5(proteinMid), fat: range5(fatMid), carbs: range5(carbMid) }
}

// ===== 克数缩放 =====
// scale clamp [0.6, 1.4]：极端目标（如安全下限 1200）不会配出离谱克数
export function scaleMenu(menu: MealMenu, dayTargetKcal: number): { items: ScaledItem[]; totalKcal: number } {
  const scale = Math.min(1.4, Math.max(0.6, dayTargetKcal / BASE_KCAL))
  const items: ScaledItem[] = menu.items.map((it) => {
    const grams = Math.max(5, Math.round((it.baseGrams * scale) / 5) * 5)
    return { name: it.name, grams, kcal: Math.round((it.kcalPer100g * grams) / 100), hint: it.hint }
  })
  return { items, totalKcal: items.reduce((n, i) => n + i.kcal, 0) }
}

// ===== 菜单库 =====
// kcal/100g 为《中国食物成分表》级别的常见近似值；功能是计划建议而非精确计量
const BREAKFAST: MealMenu[] = [
  {
    id: 'b-oat-milk',
    theme: '燕麦牛奶',
    items: [
      { name: '燕麦片', baseGrams: 50, kcalPer100g: kcalOf('燕麦片'), hint: '牛奶冲泡或微波2分钟' },
      { name: '脱脂牛奶', baseGrams: 250, kcalPer100g: kcalOf('脱脂牛奶'), hint: '冲燕麦或直接饮' },
      { name: '水煮蛋', baseGrams: 110, kcalPer100g: kcalOf('水煮蛋'), hint: '冷水下锅，水沸后8分钟' },
      { name: '苹果', baseGrams: 150, kcalPer100g: kcalOf('苹果'), hint: '直接食用' },
    ],
  },
  {
    id: 'b-soy-bun',
    theme: '豆浆包子',
    items: [
      { name: '无糖豆浆', baseGrams: 300, kcalPer100g: kcalOf('无糖豆浆'), hint: '温热饮用' },
      { name: '菜肉包', baseGrams: 160, kcalPer100g: kcalOf('菜肉包'), hint: '蒸热即可' },
      { name: '小番茄', baseGrams: 150, kcalPer100g: kcalOf('小番茄'), hint: '直接食用' },
    ],
  },
  {
    id: 'b-toast-egg',
    theme: '全麦鸡蛋',
    items: [
      { name: '全麦面包', baseGrams: 80, kcalPer100g: kcalOf('全麦面包'), hint: '烤一下更香' },
      { name: '水煮蛋', baseGrams: 55, kcalPer100g: kcalOf('水煮蛋'), hint: '冷水下锅，水沸后8分钟' },
      { name: '全脂牛奶', baseGrams: 250, kcalPer100g: kcalOf('全脂牛奶'), hint: '直接饮用' },
      { name: '香蕉', baseGrams: 120, kcalPer100g: kcalOf('香蕉'), hint: '直接食用' },
    ],
  },
]

const LUNCH: MealMenu[] = [
  {
    id: 'l-rice-chicken',
    theme: '糙米鸡胸',
    items: [
      { name: '糙米饭', baseGrams: 250, kcalPer100g: kcalOf('糙米饭'), hint: '熟重，提前浸泡2小时再煮' },
      { name: '鸡胸肉', baseGrams: 150, kcalPer100g: kcalOf('鸡胸肉'), hint: '熟重，少油煎或水煮撕丝' },
      { name: '西兰花', baseGrams: 200, kcalPer100g: kcalOf('西兰花'), hint: '焯水2分钟' },
      { name: '番茄', baseGrams: 150, kcalPer100g: kcalOf('番茄'), hint: '直接食用' },
    ],
  },
  {
    id: 'l-beef-noodle',
    theme: '牛肉汤面',
    items: [
      { name: '面条', baseGrams: 250, kcalPer100g: kcalOf('面条'), hint: '熟重，煮至无硬芯' },
      { name: '瘦牛肉', baseGrams: 100, kcalPer100g: kcalOf('瘦牛肉'), hint: '熟重，卤或快炒' },
      { name: '青菜', baseGrams: 150, kcalPer100g: kcalOf('青菜'), hint: '快炒少油' },
      { name: '玉米', baseGrams: 100, kcalPer100g: kcalOf('玉米'), hint: '蒸/煮15分钟' },
    ],
  },
  {
    id: 'l-fish-rice',
    theme: '清蒸鱼饭',
    items: [
      { name: '米饭', baseGrams: 200, kcalPer100g: kcalOf('米饭'), hint: '熟重' },
      { name: '清蒸鱼', baseGrams: 180, kcalPer100g: kcalOf('清蒸鱼'), hint: '净肉，水沸后蒸8-10分钟' },
      { name: '菠菜', baseGrams: 150, kcalPer100g: kcalOf('菠菜'), hint: '蒜蓉快炒' },
      { name: '蒸红薯', baseGrams: 100, kcalPer100g: kcalOf('蒸红薯'), hint: '蒸20分钟' },
    ],
  },
]

const DINNER: MealMenu[] = [
  {
    id: 'd-corn-chicken',
    theme: '玉米鸡丁',
    items: [
      { name: '玉米', baseGrams: 200, kcalPer100g: kcalOf('玉米'), hint: '蒸/煮15分钟' },
      { name: '鸡胸肉', baseGrams: 100, kcalPer100g: kcalOf('鸡胸肉'), hint: '熟重，切丁少油炒' },
      { name: '西兰花', baseGrams: 150, kcalPer100g: kcalOf('西兰花'), hint: '焯水2分钟' },
      { name: '小米粥', baseGrams: 250, kcalPer100g: kcalOf('小米粥'), hint: '煮30分钟' },
    ],
  },
  {
    id: 'd-soba',
    theme: '荞麦汤面',
    items: [
      { name: '荞麦面', baseGrams: 200, kcalPer100g: kcalOf('荞麦面'), hint: '熟重，煮后过凉水更劲道' },
      { name: '水煮蛋', baseGrams: 55, kcalPer100g: kcalOf('水煮蛋') },
      { name: '北豆腐', baseGrams: 100, kcalPer100g: kcalOf('北豆腐'), hint: '煎或炖' },
      { name: '香蕉', baseGrams: 120, kcalPer100g: kcalOf('香蕉'), hint: '餐后食用' },
    ],
  },
  {
    id: 'd-shrimp-rice',
    theme: '鲜虾杂粮饭',
    items: [
      { name: '杂粮饭', baseGrams: 180, kcalPer100g: kcalOf('杂粮饭'), hint: '熟重，提前浸泡' },
      { name: '白灼虾', baseGrams: 120, kcalPer100g: kcalOf('白灼虾'), hint: '净虾仁，水沸后3分钟' },
      { name: '番茄炒蛋', baseGrams: 150, kcalPer100g: kcalOf('番茄炒蛋'), hint: '少油' },
      { name: '菠菜', baseGrams: 150, kcalPer100g: kcalOf('菠菜'), hint: '蒜蓉快炒' },
    ],
  },
]

// 加餐：日常两套；训练日换「练后蛋白」主题（练后尽快补充，目标 20g 以上蛋白）
const SNACK_DAILY: MealMenu[] = [
  {
    id: 's-nut-apple',
    theme: '坚果水果',
    items: [
      { name: '苹果', baseGrams: 150, kcalPer100g: kcalOf('苹果'), hint: '直接食用' },
      { name: '核桃', baseGrams: 15, kcalPer100g: kcalOf('核桃'), hint: '上午加餐佳' },
    ],
  },
  {
    id: 's-yogurt-oat',
    theme: '酸奶燕麦',
    items: [
      { name: '无糖酸奶', baseGrams: 150, kcalPer100g: kcalOf('无糖酸奶'), hint: '直接食用' },
      { name: '燕麦片', baseGrams: 20, kcalPer100g: kcalOf('燕麦片'), hint: '拌入酸奶' },
    ],
  },
]

const SNACK_TRAINING: MealMenu[] = [
  {
    id: 's-shake',
    theme: '练后奶昔',
    items: [
      { name: '全脂牛奶', baseGrams: 250, kcalPer100g: kcalOf('全脂牛奶'), hint: '练后尽快饮用' },
      { name: '香蕉', baseGrams: 120, kcalPer100g: kcalOf('香蕉'), hint: '快碳补糖原' },
      { name: '水煮蛋', baseGrams: 110, kcalPer100g: kcalOf('水煮蛋'), hint: '冷水下锅，水沸后8分钟' },
    ],
  },
  {
    id: 's-yogurt-banana',
    theme: '练后酸奶',
    items: [
      { name: '无糖希腊酸奶', baseGrams: 250, kcalPer100g: kcalOf('无糖希腊酸奶'), hint: '练后尽快食用' },
      { name: '香蕉', baseGrams: 120, kcalPer100g: kcalOf('香蕉'), hint: '快碳补糖原' },
    ],
  },
]

// 训练日加餐用练后模板；其余餐别与是否训练无关（克数缩放已覆盖 +200）
export function menusFor(meal: MealType, isTrainingDay: boolean): MealMenu[] {
  if (meal === 'snack') return isTrainingDay ? SNACK_TRAINING : SNACK_DAILY
  if (meal === 'breakfast') return BREAKFAST
  if (meal === 'lunch') return LUNCH
  return DINNER
}
