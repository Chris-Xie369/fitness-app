// 内置食物热量库（kcal/100g）。口径统一：肉/鱼/虾为熟重，米饭面条等主食为熟重，
// 燕麦片等冲调谷物为干重，蔬果为可食部生重。lib/mealplan.ts 的菜单也引用本库，保持单一数据源。
// 值为常见参考近似，用于个人记录估算，不做精确营养声称。

export type FoodCategory = 'staple' | 'protein' | 'veg' | 'fruit' | 'dairy' | 'nut' | 'snack'

export type FoodItem = {
  name: string
  kcalPer100g: number
  category: FoodCategory
  // 每百克克数（g/100g），与热量同口径
  protein: number
  carbs: number
  fat: number
  aliases?: string[]
}

export const FOOD_LIBRARY: FoodItem[] = [
  // —— 主食 ——（含菜单迁移）
  { name: '燕麦片', kcalPer100g: 370, protein: 13.5, carbs: 61, fat: 7, category: 'staple' },
  { name: '糙米饭', kcalPer100g: 115, protein: 2.6, carbs: 24, fat: 0.9, category: 'staple', aliases: ['糙米'] },
  { name: '米饭', kcalPer100g: 116, protein: 2.6, carbs: 25.2, fat: 0.3, category: 'staple', aliases: ['白米饭', '白饭'] },
  { name: '杂粮饭', kcalPer100g: 118, protein: 3, carbs: 24.5, fat: 0.8, category: 'staple' },
  { name: '小米粥', kcalPer100g: 46, protein: 1.4, carbs: 9.2, fat: 0.7, category: 'staple', aliases: ['小米稀饭'] },
  { name: '白米粥', kcalPer100g: 46, protein: 1.1, carbs: 9.9, fat: 0.3, category: 'staple', aliases: ['大米粥', '白粥', '稀饭'] },
  { name: '面条', kcalPer100g: 110, protein: 3.5, carbs: 22.4, fat: 0.4, category: 'staple', aliases: ['汤面', '挂面熟'] },
  { name: '荞麦面', kcalPer100g: 105, protein: 4.8, carbs: 21, fat: 0.9, category: 'staple' },
  { name: '米粉', kcalPer100g: 109, protein: 1.8, carbs: 24.9, fat: 0.2, category: 'staple', aliases: ['米线'] },
  { name: '意大利面', kcalPer100g: 158, protein: 5.5, carbs: 30, fat: 1.1, category: 'staple', aliases: ['意面', 'pasta'] },
  { name: '炒饭', kcalPer100g: 174, protein: 4.5, carbs: 25.9, fat: 5.8, category: 'staple', aliases: ['蛋炒饭'] },
  { name: '菜肉包', kcalPer100g: 227, protein: 8.4, carbs: 33, fat: 6, category: 'staple', aliases: ['包子', '肉包'] },
  { name: '饺子', kcalPer100g: 250, protein: 9, carbs: 30, fat: 10, category: 'staple', aliases: ['水饺', '猪肉饺子'] },
  { name: '馒头', kcalPer100g: 223, protein: 7, carbs: 47, fat: 1.1, category: 'staple' },
  { name: '全麦面包', kcalPer100g: 250, protein: 9.5, carbs: 41, fat: 3.5, category: 'staple', aliases: ['全麦吐司'] },
  { name: '玉米', kcalPer100g: 112, protein: 4, carbs: 22.8, fat: 1.2, category: 'staple', aliases: ['甜玉米'] },
  { name: '蒸红薯', kcalPer100g: 90, protein: 1.6, carbs: 20.7, fat: 0.2, category: 'staple', aliases: ['红薯', '地瓜'] },
  { name: '土豆', kcalPer100g: 77, protein: 2, carbs: 17.2, fat: 0.1, category: 'staple', aliases: ['马铃薯', '蒸土豆'] },
  { name: '山药', kcalPer100g: 57, protein: 1.9, carbs: 12.4, fat: 0.2, category: 'staple', aliases: ['淮山'] },
  // —— 肉蛋水产 ——
  { name: '水煮蛋', kcalPer100g: 155, protein: 12.1, carbs: 1, fat: 10.5, category: 'protein', aliases: ['鸡蛋', '煮鸡蛋', '白煮蛋', '蛋'] },
  { name: '鸡胸肉', kcalPer100g: 165, protein: 30, carbs: 0, fat: 3.6, category: 'protein', aliases: ['鸡胸', '鸡脯肉'] },
  { name: '鸡腿', kcalPer100g: 210, protein: 26, carbs: 0, fat: 11, category: 'protein', aliases: ['鸡腿肉'] },
  { name: '鸡翅', kcalPer100g: 215, protein: 27, carbs: 0, fat: 12, category: 'protein', aliases: ['鸡中翅'] },
  { name: '瘦牛肉', kcalPer100g: 175, protein: 26, carbs: 0, fat: 8, category: 'protein', aliases: ['牛肉', '卤牛肉'] },
  { name: '牛腩', kcalPer100g: 320, protein: 18, carbs: 3, fat: 26, category: 'protein', aliases: ['炖牛腩'] },
  { name: '瘦猪肉', kcalPer100g: 190, protein: 28, carbs: 0, fat: 7, category: 'protein', aliases: ['猪里脊', '里脊'] },
  { name: '五花肉', kcalPer100g: 450, protein: 15, carbs: 0, fat: 44, category: 'protein', aliases: ['猪五花'] },
  { name: '清蒸鱼', kcalPer100g: 120, protein: 20, carbs: 1, fat: 3.5, category: 'protein', aliases: ['鱼', '蒸鱼', '鲈鱼'] },
  { name: '三文鱼', kcalPer100g: 208, protein: 22, carbs: 0, fat: 12, category: 'protein', aliases: ['鲑鱼'] },
  { name: '鳕鱼', kcalPer100g: 105, protein: 20, carbs: 0, fat: 0.9, category: 'protein' },
  { name: '带鱼', kcalPer100g: 127, protein: 17.7, carbs: 3.1, fat: 4.9, category: 'protein' },
  { name: '白灼虾', kcalPer100g: 100, protein: 21, carbs: 1, fat: 1, category: 'protein', aliases: ['虾', '虾仁', '基围虾', '明虾'] },
  { name: '火腿肠', kcalPer100g: 212, protein: 14, carbs: 15.6, fat: 10.6, category: 'protein', aliases: ['香肠'] },
  // —— 蔬菜 ——
  { name: '西兰花', kcalPer100g: 36, protein: 4.1, carbs: 4.3, fat: 0.6, category: 'veg', aliases: ['西蓝花'] },
  { name: '番茄', kcalPer100g: 20, protein: 0.9, carbs: 4, fat: 0.2, category: 'veg', aliases: ['西红柿'] },
  { name: '小番茄', kcalPer100g: 25, protein: 1, carbs: 5.1, fat: 0.2, category: 'veg', aliases: ['圣女果'] },
  { name: '青菜', kcalPer100g: 40, protein: 2.2, carbs: 4.4, fat: 1.5, category: 'veg', aliases: ['小白菜', '上海青'] },
  { name: '菠菜', kcalPer100g: 45, protein: 3.2, carbs: 3.1, fat: 2.6, category: 'veg' },
  { name: '生菜', kcalPer100g: 13, protein: 1.3, carbs: 2, fat: 0.3, category: 'veg' },
  { name: '黄瓜', kcalPer100g: 16, protein: 0.8, carbs: 2.9, fat: 0.2, category: 'veg', aliases: ['青瓜'] },
  { name: '胡萝卜', kcalPer100g: 39, protein: 1, carbs: 8.8, fat: 0.2, category: 'veg', aliases: ['红萝卜'] },
  { name: '洋葱', kcalPer100g: 40, protein: 1.1, carbs: 9, fat: 0.2, category: 'veg' },
  { name: '青椒', kcalPer100g: 22, protein: 1.4, carbs: 5.4, fat: 0.3, category: 'veg', aliases: ['菜椒'] },
  { name: '白菜', kcalPer100g: 17, protein: 1.5, carbs: 3.2, fat: 0.1, category: 'veg', aliases: ['大白菜'] },
  { name: '油麦菜', kcalPer100g: 12, protein: 1.4, carbs: 2.1, fat: 0.1, category: 'veg' },
  { name: '豆角', kcalPer100g: 30, protein: 2, carbs: 5.7, fat: 0.4, category: 'veg', aliases: ['四季豆'] },
  { name: '茄子', kcalPer100g: 21, protein: 1.1, carbs: 4.9, fat: 0.2, category: 'veg' },
  // —— 水果 ——
  { name: '苹果', kcalPer100g: 53, protein: 0.2, carbs: 13.7, fat: 0.2, category: 'fruit' },
  { name: '香蕉', kcalPer100g: 93, protein: 1.4, carbs: 22, fat: 0.2, category: 'fruit' },
  { name: '橙子', kcalPer100g: 48, protein: 0.8, carbs: 11.1, fat: 0.2, category: 'fruit', aliases: ['橙'] },
  { name: '葡萄', kcalPer100g: 45, protein: 0.4, carbs: 10.3, fat: 0.3, category: 'fruit' },
  { name: '西瓜', kcalPer100g: 30, protein: 0.6, carbs: 7.6, fat: 0.1, category: 'fruit' },
  { name: '梨', kcalPer100g: 51, protein: 0.4, carbs: 13.3, fat: 0.2, category: 'fruit', aliases: ['雪梨'] },
  { name: '桃', kcalPer100g: 42, protein: 0.9, carbs: 10.9, fat: 0.1, category: 'fruit', aliases: ['桃子', '水蜜桃'] },
  { name: '草莓', kcalPer100g: 32, protein: 1, carbs: 7.1, fat: 0.2, category: 'fruit' },
  { name: '牛油果', kcalPer100g: 171, protein: 2, carbs: 8.5, fat: 15.3, category: 'fruit', aliases: ['鳄梨'] },
  // —— 豆奶 ——
  { name: '无糖豆浆', kcalPer100g: 31, protein: 3, carbs: 1.2, fat: 1.6, category: 'dairy', aliases: ['豆浆'] },
  { name: '甜豆浆', kcalPer100g: 42, protein: 2.8, carbs: 4.5, fat: 1.4, category: 'dairy' },
  { name: '全脂牛奶', kcalPer100g: 65, protein: 3.2, carbs: 4.8, fat: 3.3, category: 'dairy', aliases: ['牛奶', 'milk'] },
  { name: '脱脂牛奶', kcalPer100g: 35, protein: 3.4, carbs: 5, fat: 0.1, category: 'dairy' },
  { name: '无糖酸奶', kcalPer100g: 62, protein: 3.5, carbs: 5, fat: 3.3, category: 'dairy', aliases: ['酸奶'] },
  { name: '无糖希腊酸奶', kcalPer100g: 90, protein: 9, carbs: 4, fat: 4, category: 'dairy', aliases: ['希腊酸奶'] },
  { name: '原味酸奶', kcalPer100g: 97, protein: 3.2, carbs: 12, fat: 3.5, category: 'dairy', aliases: ['风味酸奶', '含糖酸奶'] },
  { name: '北豆腐', kcalPer100g: 116, protein: 12.2, carbs: 4.2, fat: 6.6, category: 'dairy', aliases: ['老豆腐', '豆腐'] },
  { name: '南豆腐', kcalPer100g: 60, protein: 6.2, carbs: 2.6, fat: 2.5, category: 'dairy', aliases: ['嫩豆腐'] },
  { name: '奶酪', kcalPer100g: 328, protein: 25.7, carbs: 3.5, fat: 23.5, category: 'dairy', aliases: ['芝士'] },
  // 番茄炒蛋是成品菜，归 protein
  { name: '番茄炒蛋', kcalPer100g: 95, protein: 4.5, carbs: 4.5, fat: 6, category: 'protein' },
  // —— 坚果 ——
  { name: '核桃', kcalPer100g: 654, protein: 14.9, carbs: 19.1, fat: 58.8, category: 'nut' },
  { name: '杏仁', kcalPer100g: 578, protein: 21, carbs: 21.6, fat: 49.9, category: 'nut' },
  { name: '腰果', kcalPer100g: 559, protein: 18, carbs: 30.2, fat: 43.9, category: 'nut' },
  { name: '花生', kcalPer100g: 574, protein: 24.8, carbs: 21.7, fat: 44.3, category: 'nut', aliases: ['花生米'] },
  // —— 饮品零食 ——
  { name: '黑咖啡', kcalPer100g: 2, protein: 0.1, carbs: 0, fat: 0, category: 'snack', aliases: ['美式咖啡', '咖啡'] },
  { name: '可乐', kcalPer100g: 43, protein: 0, carbs: 10.6, fat: 0, category: 'snack', aliases: ['碳酸饮料'] },
  { name: '奶茶', kcalPer100g: 280, protein: 2.5, carbs: 42, fat: 10, category: 'snack' },
  { name: '果汁', kcalPer100g: 48, protein: 0.4, carbs: 11.4, fat: 0.2, category: 'snack', aliases: ['橙汁'] },
  { name: '啤酒', kcalPer100g: 32, protein: 0.5, carbs: 2.5, fat: 0, category: 'snack' },
  { name: '薯片', kcalPer100g: 536, protein: 6, carbs: 50, fat: 35, category: 'snack' },
  { name: '饼干', kcalPer100g: 450, protein: 7, carbs: 70, fat: 15, category: 'snack' },
  { name: '巧克力', kcalPer100g: 546, protein: 4.3, carbs: 61, fat: 31, category: 'snack' },
  { name: '蛋糕', kcalPer100g: 347, protein: 5.5, carbs: 50, fat: 14, category: 'snack' },
  { name: '冰淇淋', kcalPer100g: 207, protein: 3.5, carbs: 24, fat: 11, category: 'snack' },
]

const NAME_TO_FOOD = new Map(FOOD_LIBRARY.map((f) => [f.name, f]))

// 菜单模块按名取热量；名字拼错立即抛错（编译期无感知的数据完整性保险）
export function kcalOf(name: string): number {
  const f = NAME_TO_FOOD.get(name)
  if (!f) throw new Error(`foods.ts 缺少食物：${name}`)
  return f.kcalPer100g
}

export function kcalFor(kcalPer100g: number, grams: number): number {
  return Math.round((kcalPer100g * grams) / 100)
}

// 自动补全：名字/别名包含 query 即命中；名字前缀与别名精确同级最优先，其次别名前缀，其余包含；保持库内顺序稳定
export function searchFoods(query: string, limit = 5): FoodItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const scored: { f: FoodItem; rank: number }[] = []
  for (const f of FOOD_LIBRARY) {
    const name = f.name.toLowerCase()
    const aliases = (f.aliases ?? []).map((a) => a.toLowerCase())
    let rank = 0
    if (name.startsWith(q) || aliases.some((a) => a === q)) rank = 1
    else if (aliases.some((a) => a.startsWith(q))) rank = 2
    else if (name.includes(q) || aliases.some((a) => a.includes(q))) rank = 3
    if (rank) scored.push({ f, rank })
  }
  return scored.sort((a, b) => a.rank - b.rank).slice(0, limit).map((s) => s.f)
}
