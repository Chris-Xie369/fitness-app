// 内置食物热量库（kcal/100g，熟重/可食部近似值）。lib/mealplan.ts 的菜单也引用本库，保持单一数据源。
// 值为常见参考近似，用于个人记录估算，不做精确营养声称。

export type FoodCategory = 'staple' | 'protein' | 'veg' | 'fruit' | 'dairy' | 'nut' | 'snack'

export type FoodItem = {
  name: string
  kcalPer100g: number
  category: FoodCategory
  aliases?: string[]
}

export const FOOD_LIBRARY: FoodItem[] = [
  // —— 主食 ——（含菜单迁移）
  { name: '燕麦片', kcalPer100g: 370, category: 'staple' },
  { name: '糙米饭', kcalPer100g: 115, category: 'staple', aliases: ['糙米'] },
  { name: '米饭', kcalPer100g: 116, category: 'staple', aliases: ['白米饭', '白饭'] },
  { name: '杂粮饭', kcalPer100g: 118, category: 'staple' },
  { name: '小米粥', kcalPer100g: 46, category: 'staple', aliases: ['小米稀饭'] },
  { name: '白米粥', kcalPer100g: 46, category: 'staple', aliases: ['大米粥', '白粥', '稀饭'] },
  { name: '面条', kcalPer100g: 110, category: 'staple', aliases: ['汤面', '挂面熟'] },
  { name: '荞麦面', kcalPer100g: 105, category: 'staple' },
  { name: '米粉', kcalPer100g: 109, category: 'staple', aliases: ['米线'] },
  { name: '意大利面', kcalPer100g: 158, category: 'staple', aliases: ['意面', 'pasta'] },
  { name: '炒饭', kcalPer100g: 174, category: 'staple', aliases: ['蛋炒饭'] },
  { name: '菜肉包', kcalPer100g: 227, category: 'staple', aliases: ['包子', '肉包'] },
  { name: '饺子', kcalPer100g: 250, category: 'staple', aliases: ['水饺', '猪肉饺子'] },
  { name: '馒头', kcalPer100g: 223, category: 'staple' },
  { name: '全麦面包', kcalPer100g: 250, category: 'staple', aliases: ['全麦吐司'] },
  { name: '玉米', kcalPer100g: 112, category: 'staple', aliases: ['甜玉米'] },
  { name: '蒸红薯', kcalPer100g: 90, category: 'staple', aliases: ['红薯', '地瓜'] },
  { name: '土豆', kcalPer100g: 77, category: 'staple', aliases: ['马铃薯', '蒸土豆'] },
  { name: '山药', kcalPer100g: 57, category: 'staple', aliases: ['淮山'] },
  // —— 肉蛋水产 ——
  { name: '水煮蛋', kcalPer100g: 155, category: 'protein', aliases: ['鸡蛋', '煮鸡蛋', '白煮蛋', '蛋'] },
  { name: '鸡胸肉', kcalPer100g: 165, category: 'protein', aliases: ['鸡胸', '鸡脯肉'] },
  { name: '鸡腿', kcalPer100g: 181, category: 'protein', aliases: ['鸡腿肉'] },
  { name: '鸡翅', kcalPer100g: 194, category: 'protein', aliases: ['鸡中翅'] },
  { name: '瘦牛肉', kcalPer100g: 175, category: 'protein', aliases: ['牛肉', '卤牛肉'] },
  { name: '牛腩', kcalPer100g: 283, category: 'protein', aliases: ['炖牛腩'] },
  { name: '瘦猪肉', kcalPer100g: 143, category: 'protein', aliases: ['猪里脊', '里脊'] },
  { name: '五花肉', kcalPer100g: 395, category: 'protein', aliases: ['猪五花'] },
  { name: '清蒸鱼', kcalPer100g: 120, category: 'protein', aliases: ['鱼', '蒸鱼', '鲈鱼'] },
  { name: '三文鱼', kcalPer100g: 208, category: 'protein', aliases: ['鲑鱼'] },
  { name: '鳕鱼', kcalPer100g: 88, category: 'protein' },
  { name: '带鱼', kcalPer100g: 127, category: 'protein' },
  { name: '白灼虾', kcalPer100g: 100, category: 'protein', aliases: ['虾', '虾仁', '基围虾', '明虾'] },
  { name: '火腿肠', kcalPer100g: 212, category: 'protein', aliases: ['香肠'] },
  // —— 蔬菜 ——
  { name: '西兰花', kcalPer100g: 36, category: 'veg', aliases: ['西蓝花'] },
  { name: '番茄', kcalPer100g: 20, category: 'veg', aliases: ['西红柿'] },
  { name: '小番茄', kcalPer100g: 25, category: 'veg', aliases: ['圣女果'] },
  { name: '青菜', kcalPer100g: 40, category: 'veg', aliases: ['小白菜', '上海青'] },
  { name: '菠菜', kcalPer100g: 45, category: 'veg' },
  { name: '生菜', kcalPer100g: 13, category: 'veg' },
  { name: '黄瓜', kcalPer100g: 16, category: 'veg', aliases: ['青瓜'] },
  { name: '胡萝卜', kcalPer100g: 39, category: 'veg', aliases: ['红萝卜'] },
  { name: '洋葱', kcalPer100g: 40, category: 'veg' },
  { name: '青椒', kcalPer100g: 22, category: 'veg', aliases: ['菜椒'] },
  { name: '白菜', kcalPer100g: 17, category: 'veg', aliases: ['大白菜'] },
  { name: '油麦菜', kcalPer100g: 12, category: 'veg' },
  { name: '豆角', kcalPer100g: 30, category: 'veg', aliases: ['四季豆'] },
  { name: '茄子', kcalPer100g: 21, category: 'veg' },
  // —— 水果 ——
  { name: '苹果', kcalPer100g: 53, category: 'fruit' },
  { name: '香蕉', kcalPer100g: 93, category: 'fruit' },
  { name: '橙子', kcalPer100g: 48, category: 'fruit', aliases: ['橙'] },
  { name: '葡萄', kcalPer100g: 45, category: 'fruit' },
  { name: '西瓜', kcalPer100g: 30, category: 'fruit' },
  { name: '梨', kcalPer100g: 51, category: 'fruit', aliases: ['雪梨'] },
  { name: '桃', kcalPer100g: 42, category: 'fruit', aliases: ['桃子', '水蜜桃'] },
  { name: '草莓', kcalPer100g: 32, category: 'fruit' },
  { name: '牛油果', kcalPer100g: 171, category: 'fruit', aliases: ['鳄梨'] },
  // —— 豆奶 ——
  { name: '无糖豆浆', kcalPer100g: 31, category: 'dairy', aliases: ['豆浆'] },
  { name: '甜豆浆', kcalPer100g: 42, category: 'dairy' },
  { name: '全脂牛奶', kcalPer100g: 65, category: 'dairy', aliases: ['牛奶', 'milk'] },
  { name: '脱脂牛奶', kcalPer100g: 35, category: 'dairy' },
  { name: '无糖酸奶', kcalPer100g: 62, category: 'dairy', aliases: ['酸奶'] },
  { name: '无糖希腊酸奶', kcalPer100g: 90, category: 'dairy', aliases: ['希腊酸奶'] },
  { name: '原味酸奶', kcalPer100g: 97, category: 'dairy', aliases: ['风味酸奶', '含糖酸奶'] },
  { name: '北豆腐', kcalPer100g: 116, category: 'dairy', aliases: ['老豆腐', '豆腐'] },
  { name: '南豆腐', kcalPer100g: 60, category: 'dairy', aliases: ['嫩豆腐'] },
  { name: '奶酪', kcalPer100g: 328, category: 'dairy', aliases: ['芝士'] },
  // 番茄炒蛋是成品菜，归 protein
  { name: '番茄炒蛋', kcalPer100g: 95, category: 'protein' },
  // —— 坚果 ——
  { name: '核桃', kcalPer100g: 654, category: 'nut' },
  { name: '杏仁', kcalPer100g: 578, category: 'nut' },
  { name: '腰果', kcalPer100g: 559, category: 'nut' },
  { name: '花生', kcalPer100g: 574, category: 'nut', aliases: ['花生米'] },
  // —— 饮品零食 ——
  { name: '黑咖啡', kcalPer100g: 2, category: 'snack', aliases: ['美式咖啡', '咖啡'] },
  { name: '可乐', kcalPer100g: 43, category: 'snack', aliases: ['碳酸饮料'] },
  { name: '奶茶', kcalPer100g: 280, category: 'snack' },
  { name: '果汁', kcalPer100g: 48, category: 'snack', aliases: ['橙汁'] },
  { name: '啤酒', kcalPer100g: 32, category: 'snack' },
  { name: '薯片', kcalPer100g: 536, category: 'snack' },
  { name: '饼干', kcalPer100g: 450, category: 'snack' },
  { name: '巧克力', kcalPer100g: 546, category: 'snack' },
  { name: '蛋糕', kcalPer100g: 347, category: 'snack' },
  { name: '冰淇淋', kcalPer100g: 207, category: 'snack' },
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
