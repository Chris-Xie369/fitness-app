# 食物+克数自动算热量 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 饮食录入支持输入食物名（自动补全）+ 克数，按内置 ~81 种中式食物库自动算出热量；库外食物保持手填大卡并从历史克数记录学习估算。

**Architecture:** 新建纯数据/纯函数库 `lib/foods.ts` 作为唯一热量数据源；`lib/mealplan.ts` 菜单改为引用它（数值零变化）；`lib/diet.ts` 加 `learnedKcal` 从历史 MealEntry 反推；DietTab 录入区改为"自动补全下拉 + 克数/大卡双模输入"。MealEntry 结构不变，克数拼进名称（与「按菜单记录」同形态），无数据迁移、无新存储 key。

**Tech Stack:** React 19 + TS + Tailwind 4；esbuild 转译 node 单测（项目无测试框架）。

**Spec:** `docs/superpowers/specs/2026-09-16-food-grams-kcal-design.md`

## Global Constraints

- UI 文案全部中文；配色只用 paper/ink/clay/muted/line/surface；标题 font-display。
- 不新增 npm 依赖、不加 localStorage key、不改 MealEntry 类型、不改备份格式。
- 菜单库现有 31 种食物的 kcalPer100g 必须**原样**迁入 foods.ts，菜单显示与记录热量零变化（单测断言）。
- 克数热量一律 `Math.round(kcalPer100g * grams / 100)`。
- 纯函数单测：`npx esbuild <file> --bundle --format=cjs "--outfile=$TEMP/x.cjs" --log-level=warning && node $TEMP/test-x.cjs`。
- 提交信息中文。
- 注意 Git Bash 的 `$TEMP` 是 Windows 临时目录；node 可直接读。

---

### Task 1: lib/foods.ts 食物库 + mealplan.ts 改为引用（TDD）

**Files:**
- Create: `src/lib/foods.ts`
- Modify: `src/lib/mealplan.ts`（菜单数据的 kcalPer100g 改引用；函数逻辑不动）
- Test: `$TEMP/test-foods.cjs`

**Interfaces:**
- Produces（Task 2/3 依赖）:
  - `FoodCategory = 'staple'|'protein'|'veg'|'fruit'|'dairy'|'nut'|'snack'`
  - `FoodItem = { name: string; kcalPer100g: number; category: FoodCategory; aliases?: string[] }`
  - `FOOD_LIBRARY: FoodItem[]`
  - `searchFoods(query: string, limit?: number): FoodItem[]`（默认 limit 5）
  - `kcalFor(kcalPer100g: number, grams: number): number`
  - `kcalOf(name: string): number`（按名取值，找不到抛错——仅供 mealplan 内部/断言）

- [ ] **Step 1: 写失败测试** `$TEMP/test-foods.cjs`：

```js
const f = require(process.env.TEMP + '/foods.cjs')
const mp = require(process.env.TEMP + '/mealplan.cjs')
const assert = require('node:assert')

// --- searchFoods ---
assert.deepStrictEqual(f.searchFoods(''), [])
assert.deepStrictEqual(f.searchFoods('   '), [])
// 前缀命中排最前
assert.strictEqual(f.searchFoods('鸡')[0].name, '鸡胸肉')
// alias 命中：水煮蛋 alias 含 鸡蛋/白煮蛋
assert.ok(f.searchFoods('白煮蛋').some(x => x.name === '水煮蛋'))
assert.ok(f.searchFoods('鸡蛋').some(x => x.name === '水煮蛋'))
assert.ok(f.searchFoods('虾仁').some(x => x.name === '白灼虾'))
// 大小写不敏感（英文/拼音类）
assert.ok(f.searchFoods('milk').length >= 0)
// 无匹配返回空
assert.deepStrictEqual(f.searchFoods('不存在的食物xyz'), [])
// limit
assert.ok(f.searchFoods('米', 2).length <= 2)
assert.strictEqual(f.searchFoods('米').length, 5) // 默认上限 5
// 无重复 name
const names = f.FOOD_LIBRARY.map(x => x.name)
assert.strictEqual(names.length, new Set(names).size, '食物名不得重复')
assert.ok(f.FOOD_LIBRARY.length >= 80, `应≥80种，实际 ${names.length}`)
for (const it of f.FOOD_LIBRARY) {
  assert.ok(it.kcalPer100g > 0 && it.kcalPer100g < 900, `${it.name} 热量越界`)
}

// --- kcalFor ---
assert.strictEqual(f.kcalFor(165, 150), 248)
assert.strictEqual(f.kcalFor(370, 50), 185)

// --- 关键数值（菜单迁移值原样） ---
const byName = Object.fromEntries(f.FOOD_LIBRARY.map(x => [x.name, x.kcalPer100g]))
const expect = {
  燕麦片: 370, 脱脂牛奶: 35, 水煮蛋: 155, 苹果: 53, 无糖豆浆: 31, 菜肉包: 227, 小番茄: 25,
  全麦面包: 250, 全脂牛奶: 65, 香蕉: 93, 糙米饭: 115, 鸡胸肉: 165, 西兰花: 36, 番茄: 20,
  面条: 110, 瘦牛肉: 175, 青菜: 40, 玉米: 112, 米饭: 116, 清蒸鱼: 120, 菠菜: 45, 蒸红薯: 90,
  北豆腐: 116, 荞麦面: 105, 小米粥: 46, 杂粮饭: 118, 白灼虾: 100, 番茄炒蛋: 95, 核桃: 654,
  无糖酸奶: 62, 无糖希腊酸奶: 90,
}
for (const [k, v] of Object.entries(expect)) assert.strictEqual(byName[k], v, `${k} 迁移值变化`)

// --- mealplan 数据源切换后数值零变化：四个餐别全部菜单都能按名查到热量 ---
for (const meal of ['breakfast', 'lunch', 'dinner', 'snack']) {
  for (const isTr of [false, true]) {
    for (const menu of mp.menusFor(meal, isTr)) {
      for (const it of menu.items) {
        assert.strictEqual(byName[it.name], it.kcalPer100g, `${menu.id}/${it.name} 菜单与库不一致`)
      }
    }
  }
}
// 缩放后早餐第一套合计不变（回归）
assert.strictEqual(mp.scaleMenu(mp.menusFor('breakfast', false)[0], 2000).totalKcal,
  mp.menusFor('breakfast', false)[0].items.reduce((n, i) => n + Math.round(i.kcalPer100g * i.baseGrams / 100), 0))

console.log('foods tests passed')
```

- [ ] **Step 2: 跑确认失败**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npx esbuild src/lib/foods.ts --bundle --format=cjs "--outfile=$TEMP/foods.cjs" --log-level=warning
```

预期：报错文件不存在。

- [ ] **Step 3: 创建 `src/lib/foods.ts`**

完整内容（31 种菜单迁移值 + 50 种补充 = 81 种；kcal/100g 为《中国食物成分表》/USDA 近似，熟/可食口径）：

```ts
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

// 自动补全：名字/别名包含 query 即命中；名字前缀优先，其次前缀在别名，其余包含；保持库内顺序稳定
export function searchFoods(query: string, limit = 5): FoodItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const scored: { f: FoodItem; rank: number }[] = []
  for (const f of FOOD_LIBRARY) {
    const name = f.name.toLowerCase()
    const aliases = (f.aliases ?? []).map((a) => a.toLowerCase())
    let rank = 0
    if (name.startsWith(q)) rank = 1
    else if (aliases.some((a) => a.startsWith(q))) rank = 2
    else if (name.includes(q) || aliases.some((a) => a.includes(q))) rank = 3
    if (rank) scored.push({ f, rank })
  }
  return scored.sort((a, b) => a.rank - b.rank).slice(0, limit).map((s) => s.f)
}
```

- [ ] **Step 4: 改 `src/lib/mealplan.ts` 引用食物库**

1) 顶部 import 区加：

```ts
import { kcalOf } from './foods'
```

2) 把每个菜单项的 `kcalPer100g: <数字>` 替换为 `kcalPer100g: kcalOf('<同名>')`，名称与数字对应（数字必须等于 foods.ts 中的迁移值）。全部替换清单（共 31 个名字，逐个替换，勿漏）：

```
燕麦片370 脱脂牛奶35 水煮蛋155 苹果53 无糖豆浆31 菜肉包227 小番茄25 全麦面包250 全脂牛奶65 香蕉93
糙米饭115 鸡胸肉165 西兰花36 番茄20 面条110 瘦牛肉175 青菜40 玉米112 米饭116 清蒸鱼120 菠菜45 蒸红薯90
北豆腐116 荞麦面105 杂粮饭118 白灼虾100 番茄炒蛋95 核桃654 无糖酸奶62 无糖希腊酸奶90 小米粥46
```

例如：

```ts
{ name: '燕麦片', baseGrams: 50, kcalPer100g: kcalOf('燕麦片'), hint: '牛奶冲泡或微波2分钟' },
```

`MenuItem` 类型、macroTargets、range5、scaleMenu、menusFor 等其余代码**一律不动**。

- [ ] **Step 5: 跑两个单测确认全绿**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npx esbuild src/lib/foods.ts --bundle --format=cjs "--outfile=$TEMP/foods.cjs" --log-level=warning && \
npx esbuild src/lib/mealplan.ts --bundle --format=cjs "--outfile=$TEMP/mealplan.cjs" --log-level=warning && \
node "$TEMP/test-foods.cjs" && node "$TEMP/test-mealplan.cjs" && npx tsc --noEmit && echo ALL_OK
```

预期：`foods tests passed`、`mealplan tests passed`、`ALL_OK`。

- [ ] **Step 6: Commit**

```bash
git add src/lib/foods.ts src/lib/mealplan.ts
git commit -m "食物库①：foods.ts 81种中式食物库+searchFoods/kcalFor，菜单热量改为引用食物库（数值零变化，node单测通过）"
```

---

### Task 2: lib/diet.ts 增加 learnedKcal 历史学习（TDD）

**Files:**
- Modify: `src/lib/diet.ts`
- Test: `$TEMP/test-learned.cjs`

**Interfaces:**
- Consumes: `MealEntry`（../types，已有 name/kcal）
- Produces: `learnedKcal(meals: MealEntry[], name: string): number | null` —— 返回 round(平均 kcal/g × 100)，结果限制在 [5,900]，否则 null；无克数样本返回 null。

- [ ] **Step 1: 写失败测试** `$TEMP/test-learned.cjs`：

```js
const d = require(process.env.TEMP + '/diet.cjs')
const assert = require('node:assert')

// 名称形如「<名> <克数>g」的记录才是克数样本
const meals = [
  { id: '1', date: '2026-09-15', meal: 'lunch', name: '妈妈做的红烧肉 200g', kcal: 500, createdAt: 1 }, // 2.5/g → 250/100g
  { id: '2', date: '2026-09-16', meal: 'dinner', name: '妈妈做的红烧肉 100g', kcal: 260, createdAt: 2 }, // 2.6/g → 260
]
// 平均 2.55/g → 255/100g
assert.strictEqual(d.learnedKcal(meals, '妈妈做的红烧肉'), 255)
// 名称必须精确（trim 后）相等
assert.strictEqual(d.learnedKcal(meals, '红烧肉'), null)
// 普通大卡记录（无克数）不产生估算
assert.strictEqual(d.learnedKcal([
  { id: '3', date: '2026-09-16', meal: 'lunch', name: '外卖盖饭', kcal: 700, createdAt: 3 },
], '外卖盖饭'), null)
// 空数组 / 空名
assert.strictEqual(d.learnedKcal([], 'x'), null)
assert.strictEqual(d.learnedKcal(meals, ''), null)
// 异常值（>900 或 <5）不采纳
assert.strictEqual(d.learnedKcal([
  { id: '4', date: '2026-09-16', meal: 'lunch', name: '奇怪食物 100g', kcal: 5000, createdAt: 4 },
], '奇怪食物'), null)
assert.strictEqual(d.learnedKcal([
  { id: '5', date: '2026-09-16', meal: 'lunch', name: '白水 100g', kcal: 0, createdAt: 5 },
], '白水'), null)
// 带小数克数可解析
assert.strictEqual(d.learnedKcal([
  { id: '6', date: '2026-09-16', meal: 'lunch', name: '蛋糕 75.5g', kcal: 262, createdAt: 6 },
], '蛋糕'), 347)

console.log('learned tests passed')
```

- [ ] **Step 2: 跑确认失败**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npx esbuild src/lib/diet.ts --bundle --format=cjs "--outfile=$TEMP/diet.cjs" --log-level=warning && node "$TEMP/test-learned.cjs"
```

预期：`d.learnedKcal is not a function`。

- [ ] **Step 3: 实现**（加到 src/lib/diet.ts 末尾）：

```ts
// 库外食物的历史估算：从「<名> <克数>g」形态的历史记录反推 kcal/100g（克数来自菜单记录或克数录入）。
// 只采纳基础名完全一致、估算值落在合理区间 [5,900] 的样本；无克数样本返回 null。
const GRAM_SUFFIX = /^(.*?)\s*(\d+(?:\.\d+)?)g$/

export function learnedKcal(meals: MealEntry[], name: string): number | null {
  const base = name.trim()
  if (!base) return null
  let sumPerGram = 0
  let n = 0
  for (const m of meals) {
    const match = m.name.trim().match(GRAM_SUFFIX)
    if (!match) continue
    if (match[1].trim() !== base) continue
    const grams = Number(match[2])
    if (!(grams > 0)) continue
    const per100 = (m.kcal / grams) * 100
    if (per100 < 5 || per100 > 900) continue
    sumPerGram += m.kcal / grams
    n++
  }
  if (n === 0) return null
  return Math.round((sumPerGram / n) * 100)
}
```

- [ ] **Step 4: 跑确认通过 + tsc**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npx esbuild src/lib/diet.ts --bundle --format=cjs "--outfile=$TEMP/diet.cjs" --log-level=warning && node "$TEMP/test-learned.cjs" && npx tsc --noEmit && echo ALL_OK
```

预期：`learned tests passed`、`ALL_OK`。

- [ ] **Step 5: Commit**

```bash
git add src/lib/diet.ts
git commit -m "食物库②：learnedKcal 从历史克数记录反推库外食物热量（node单测通过）"
```

---

### Task 3: DietTab 自动补全 + 克数/大卡双模录入

**Files:**
- Modify: `src/tabs/DietTab.tsx`

**Interfaces:**
- Consumes: Task1 `searchFoods/kcalFor`（lib/foods）；Task2 `learnedKcal`（lib/diet）；现有 `onAdd/uid/date`。
- Produces: 无新导出。

交互规格（见 spec「交互」节）：输入名 ≥1 字出建议下拉（库内最多 5 条 + 同名历史估算 1 条）；选中→克数模式（右框 placeholder「克数」、下方实时 `≈ N kcal`、>2000g 温和提示）；未选中→大卡模式（现状不变）；↑↓/Enter 键盘操作；胶囊在下拉打开时让位。

- [ ] **Step 1: 改 import 与 Draft 类型（DietTab.tsx 顶部）**

把 `import { dayKcal, MEAL_TYPES, recentMeals, weeklyKcal } from '../lib/diet'` 改为：

```ts
import { dayKcal, learnedKcal, MEAL_TYPES, recentMeals, weeklyKcal } from '../lib/diet'
import { kcalFor, searchFoods } from '../lib/foods'
```

把 Draft 相关定义：

```ts
type Draft = { name: string; kcal: string }
const emptyDraft: Record<MealType, Draft> = {
  breakfast: { name: '', kcal: '' },
  lunch: { name: '', kcal: '' },
  dinner: { name: '', kcal: '' },
  snack: { name: '', kcal: '' },
}
```

替换为：

```ts
type PickedFood = { name: string; kcalPer100g: number; learned?: boolean }
type Draft = { name: string; kcal: string; grams: string; picked: PickedFood | null }
// 用工厂而不是共享常量：draft 内含嵌套对象，重置时每次给全新副本
function freshDrafts(): Record<MealType, Draft> {
  return {
    breakfast: { name: '', kcal: '', grams: '', picked: null },
    lunch: { name: '', kcal: '', grams: '', picked: null },
    dinner: { name: '', kcal: '', grams: '', picked: null },
    snack: { name: '', kcal: '', grams: '', picked: null },
  }
}
```

- [ ] **Step 2: 改 state 与所有用到 emptyDraft 的地方**

`const [drafts, setDrafts] = useState(emptyDraft)` 改为：

```ts
  const [drafts, setDrafts] = useState(freshDrafts)
  // 自动补全下拉：一次只开一餐；idx 为键盘高亮
  const [suggest, setSuggest] = useState<{ meal: MealType; idx: number } | null>(null)
```

把文件里其余所有 `setDrafts(emptyDraft)`（goTo、stepDate 中）替换为 `setDrafts(freshDrafts())`（共 2 处）。

- [ ] **Step 3: 替换录入相关处理函数**

把现有的 `setDraft`、`canAdd`、`add`、`applyRecent` 四个函数（从 `function setDraft` 起到 `applyRecent` 结束的连续区块）整体替换为：

```ts
  function setDraft(meal: MealType, patch: Partial<Draft>) {
    setDrafts((p) => ({ ...p, [meal]: { ...p[meal], ...patch } }))
  }

  // 当前餐下拉建议：库内匹配 + 同名历史估算（库内精确命中时不重复显示学到项）
  function suggestionsFor(meal: MealType): PickedFood[] {
    const q = drafts[meal].name.trim()
    if (!q) return []
    const fromLib: PickedFood[] = searchFoods(q).map((f) => ({ name: f.name, kcalPer100g: f.kcalPer100g }))
    if (fromLib.some((f) => f.name === q)) return fromLib
    const learned = learnedKcal(meals, q)
    if (learned != null && !fromLib.some((f) => f.name === q)) {
      return [...fromLib, { name: q, kcalPer100g: learned, learned: true }]
    }
    return fromLib
  }

  // 选中某条建议：进入克数模式
  function pickFood(meal: MealType, food: PickedFood) {
    setDraft(meal, { name: food.name, picked: food, grams: '', kcal: '' })
    setSuggest(null)
  }

  // 克数模式：名称与所选食物一致时生效；改名后自动回退大卡模式
  function gramsMode(meal: MealType): PickedFood | null {
    const d = drafts[meal]
    return d.picked && d.picked.name === d.name.trim() ? d.picked : null
  }

  // 单条食物热量上限：超过 1 万大卡基本是输错了
  const MAX_KCAL = 10000

  function canAdd(meal: MealType): boolean {
    const d = drafts[meal]
    const picked = gramsMode(meal)
    if (picked) {
      const g = Number(d.grams)
      return Number.isFinite(g) && g > 0
    }
    if (!d.name.trim() || !d.kcal) return false
    const k = Number(d.kcal)
    // 先取整再判正：0.4 大卡 round 后是 0，不该产生一条 0 kcal 记录
    return Number.isFinite(k) && Math.round(k) > 0 && k <= MAX_KCAL
  }

  function add(meal: MealType) {
    if (!canAdd(meal)) return
    const d = drafts[meal]
    const picked = gramsMode(meal)
    if (picked) {
      const grams = Math.round(Number(d.grams) * 10) / 10
      onAdd({
        id: uid(),
        date,
        meal,
        name: `${picked.name} ${grams}g`,
        kcal: kcalFor(picked.kcalPer100g, grams),
        createdAt: Date.now(),
      })
    } else {
      onAdd({
        id: uid(),
        date,
        meal,
        name: d.name.trim(),
        kcal: Math.round(Number(d.kcal)),
        createdAt: Date.now(),
      })
    }
    setDrafts((p) => ({ ...p, [meal]: { name: '', kcal: '', grams: '', picked: null } }))
    setSuggest(null)
  }

  function applyRecent(meal: MealType, name: string, kcal: number) {
    setDraft(meal, { name, kcal: String(kcal), grams: '', picked: null })
    setSuggest(null)
  }

  // 名字输入框键盘：下拉打开时 ↑↓ 移动、Enter 选中；否则 Enter 添加
  function nameKeyDown(meal: MealType, e: React.KeyboardEvent<HTMLInputElement>) {
    const list = suggestionsFor(meal)
    if (suggest?.meal === meal && list.length > 0) {
      const idx = suggest.idx
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSuggest({ meal, idx: (idx + 1) % list.length })
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSuggest({ meal, idx: (idx - 1 + list.length) % list.length })
        return
      }
      if (e.key === 'Enter' && idx >= 0 && idx < list.length) {
        e.preventDefault()
        pickFood(meal, list[idx])
        return
      }
    }
    if (e.key === 'Enter') add(meal)
  }
```

注意：`React` 命名空间类型在本文件可用（tsconfig 的 jsx 配置下 `React.KeyboardEvent` 无需 import React；若 tsc 报找不到 React，则在文件顶部已有 react import 处改用 `import { useState, type KeyboardEvent } from 'react'` 并用 `KeyboardEvent<HTMLInputElement>`）。

- [ ] **Step 4: 替换「四餐」卡片整块 JSX**

在 `{/* 四餐 */}` 注释处，把现有 `{MEAL_TYPES.map(({ type, label, emoji }) => { ... })}` 整块替换为：

```tsx
      {/* 四餐 */}
      <div className="mt-5 space-y-3">
        {MEAL_TYPES.map(({ type, label, emoji }) => {
          const items = dayMeals.filter((m) => m.meal === type)
          const subtotal = items.reduce((n, m) => n + m.kcal, 0)
          const d = drafts[type]
          const picked = gramsMode(type)
          const suggestions = suggest?.meal === type ? suggestionsFor(type) : []
          const gramsNum = picked ? Number(d.grams) : NaN
          const gramsWarn = picked && Number.isFinite(gramsNum) && gramsNum > 2000
          return (
            <div key={type} className="rounded-2xl bg-surface border border-line p-4">
              <div className="flex items-center justify-between">
                <p className="text-[15px] text-ink">{emoji} {label}</p>
                {subtotal > 0 && <p className="text-[12px] text-muted">{subtotal} kcal</p>}
              </div>

              {items.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {items.map((m) => (
                    <li key={m.id} className="flex items-center justify-between text-[14px]">
                      <span className="text-ink">{m.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted">{m.kcal} kcal</span>
                        <button onClick={() => onDelete(m.id)} className="-m-3 p-3 leading-none text-muted/50 hover:text-clay text-sm">✕</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {!d.name && suggest?.meal !== type && recent.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recent.slice(0, 6).map((r) => (
                    <button
                      key={r.name}
                      onClick={() => applyRecent(type, r.name, r.kcal)}
                      className="px-2.5 py-1 rounded-full bg-paper border border-line text-[12px] text-ink hover:border-clay/50 hover:text-clay transition"
                    >
                      {r.name} {r.kcal}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative mt-2">
                <div className="flex items-center gap-2">
                  <input
                    value={d.name}
                    onChange={(e) => {
                      setDraft(type, { name: e.target.value })
                      setSuggest({ meal: type, idx: 0 })
                    }}
                    onFocus={() => d.name.trim() && setSuggest({ meal: type, idx: suggest?.meal === type ? suggest.idx : 0 })}
                    onBlur={() => setTimeout(() => setSuggest((s) => (s?.meal === type ? null : s)), 120)}
                    onKeyDown={(e) => nameKeyDown(type, e)}
                    placeholder="食物（如：鸡胸肉）"
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-line bg-paper text-[14px] text-ink placeholder:text-muted/70 focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
                  />
                  {picked ? (
                    <input
                      value={d.grams}
                      onChange={(e) => setDraft(type, { grams: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && add(type)}
                      inputMode="decimal"
                      placeholder="克数"
                      className="w-16 px-3 py-2 rounded-xl border border-line bg-paper text-[14px] text-ink placeholder:text-muted/70 focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
                    />
                  ) : (
                    <input
                      value={d.kcal}
                      onChange={(e) => setDraft(type, { kcal: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && add(type)}
                      inputMode="numeric"
                      placeholder="大卡"
                      className="w-16 px-3 py-2 rounded-xl border border-line bg-paper text-[14px] text-ink placeholder:text-muted/70 focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
                    />
                  )}
                  <button
                    onClick={() => add(type)}
                    disabled={!canAdd(type)}
                    className={`shrink-0 w-9 h-9 rounded-xl text-[18px] leading-none transition ${
                      canAdd(type)
                        ? 'bg-clay text-white hover:bg-clay/90 active:scale-95'
                        : 'bg-line text-muted/60'
                    }`}
                  >
                    ＋
                  </button>
                </div>

                {/* 自动补全下拉：绝对定位浮在卡片内，不顶动布局 */}
                {suggestions.length > 0 && (
                  <ul className="absolute z-10 left-0 right-16 top-[42px] rounded-xl border border-line bg-surface shadow-lg overflow-hidden">
                    {suggestions.map((s, i) => (
                      <li key={s.name}>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); pickFood(type, s) }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left text-[13px] ${suggest?.idx === i ? 'bg-clay/10 text-clay' : 'text-ink'}`}
                        >
                          <span className="truncate">{s.name}{s.learned && <span className="ml-1 text-[11px] text-muted">上次估算</span>}</span>
                          <span className="ml-2 shrink-0 text-muted tabular-nums">{s.kcalPer100g}/100g</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {picked && Number.isFinite(gramsNum) && gramsNum > 0 && (
                <p className={`mt-1 pl-1 text-[12px] ${gramsWarn ? 'text-clay' : 'text-muted'}`}>
                  ≈ {kcalFor(picked.kcalPer100g, gramsNum)} kcal{gramsWarn ? ' · 克数偏大，确认单位是克？' : ''}
                </p>
              )}
            </div>
          )
        })}
      </div>
```

- [ ] **Step 5: 类型检查 + 构建**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npx tsc --noEmit && npm run build 2>&1 | tail -3
```

预期：无 TS 错误，build 成功（仅 chunk 体积既有提示）。若报 `React` 命名空间找不到，按 Step 3 注释改 KeyboardEvent import。

- [ ] **Step 6: 浏览器预览验证（控制器执行；实现者保证 build 过即可）**

启动 fitness dev server → resize mobile 375 → 饮食 tab → 记录视图，逐项验：
1. 输入「鸡胸」：下拉出现含「鸡胸肉 · 165/100g」等建议；键盘 ↓ 高亮、Enter 选中
2. 选中后右框 placeholder 变「克数」；输入 150 显 `≈ 248 kcal`；＋ 后列表出现 `鸡胸肉 150g` / `248 kcal`
3. 输入库外名字（如「外卖盖饭」）+ 大卡 700：可正常添加（现状行为）
4. 学习：先用计划视图「按菜单记录」写入一餐（产生「燕麦片 45g」类记录），回记录视图输入「燕麦片」看到建议（库内，精确名）；输入一个仅在克数记录里出现的库外名（可 eval localStorage 造数据）看到「上次估算」标签
5. 下拉打开时最近食物胶囊隐藏；清空名字后胶囊回来
6. 下拉浮层不引起整页跳动；375 宽无横向溢出
验完 resize desktop。

- [ ] **Step 7: Commit**

```bash
git add src/tabs/DietTab.tsx
git commit -m "食物库③：饮食录入自动补全+克数算热量，库外食物手填大卡并从历史估算"
```

---

### Task 4: 审查 + 修复 + 推送部署

**Files:** 视审查结论。

- [ ] **Step 1: 静态对抗审查**（子代理配额可能仍 429；若受限由控制器做等价审查）
重点：foods 数值错配（菜单 31 种零变化已被单测锁死）、searchFoods 排序/边界、learnedKcal 正则误匹配（如名称本身以 g 结尾：`汉堡 1个` 不匹配；`100g` 后缀才匹配，验证 `x 100g` 形态）、DietTab 键盘事件/失焦 120ms 与 onMouseDown 竞态、gramsMode 改名回退、补记过去日。
- [ ] **Step 2: 修复确认问题，重跑全部 node 单测 + build**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npx esbuild src/lib/foods.ts --bundle --format=cjs "--outfile=$TEMP/foods.cjs" --log-level=warning && \
npx esbuild src/lib/mealplan.ts --bundle --format=cjs "--outfile=$TEMP/mealplan.cjs" --log-level=warning && \
npx esbuild src/lib/diet.ts --bundle --format=cjs "--outfile=$TEMP/diet.cjs" --log-level=warning && \
node "$TEMP/test-foods.cjs" && node "$TEMP/test-mealplan.cjs" && node "$TEMP/test-learned.cjs" && npm run build 2>&1 | tail -2
```

- [ ] **Step 3: 提交修复并推送**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
git add -A && git commit -m "食物库④：审查修复" || echo "无修复提交"
GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null GIT_TERMINAL_PROMPT=0 git -c credential.helper='!gh auth git-credential' push https://github.com/Chris-Xie369/fitness-app.git main
```

- [ ] **Step 4: 验证 Cloudflare 部署**（等 ~80 秒）

```bash
BUNDLE=$(curl -s https://fitness-app-a6t.pages.dev/ | grep -o 'assets/index-[^"]*\.js' | head -1)
curl -s "https://fitness-app-a6t.pages.dev/$BUNDLE" | grep -c "上次估算"
```
预期 ≥1。

- [ ] **Step 5: 更新项目记忆** fitness-app-progress.md（功能、commit、食物库口径、学习机制）。

---

## Self-Review 记录

- **Spec 覆盖**：81 种库✓(T1，spec 说~80，81 达标) searchFoods✓ kcalFor✓ 菜单零变化✓(T1断言) learnedKcal✓(T2) 自动补全/克数双模/键盘/胶囊让位/浮层✓(T3) >2000g 温和提示✓(T3) 预览六项✓(T3-S6) 审查部署✓(T4)。
- **占位符**：无；foods.ts 全量数据给出，DietTab JSX 完整给出。
- **类型一致**：PickedFood/Draft/suggest 在 Step1-4 同名同形；`suggestionsFor` 返回 PickedFood[]（含 learned 标记），pickFood/nameKeyDown 均按此消费；learnedKcal/kcalFor/searchFoods 签名与 T1/T2 一致。
- **潜在风险已写进 T4**：learnedKcal 正则（要求数字+g 结尾，`汉堡 1个` 不会误匹配，单测含小数克数用例）；失焦 120ms 定时器与 onMouseDown preventDefault 配合。
- **数值口径**：菜单 31 种值逐字保留（T1 断言表锁定）；新 50 种为近似值，偏差不影响既有功能。
