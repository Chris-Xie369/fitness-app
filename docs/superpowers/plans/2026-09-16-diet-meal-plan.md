# 饮食计划功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DietTab 新增「记录 | 计划」视图切换：动态计算的每日营养目标卡（热量+三大营养素）+ 每餐 2-3 套可缩放中式菜单，支持一键记录。

**Architecture:** 纯函数库 `lib/mealplan.ts`（菜单数据 + 宏量公式 + 克数缩放）→ `components/MealPlanView.tsx` 渲染 → DietTab 加 view 状态切换；菜单选择持久化到 `settings.mealChoice`；一键记录复用现有 `onAdd` 逐条写 MealEntry。

**Tech Stack:** React 19 + TS + Tailwind 4（@theme paper/ink/clay/muted/line）+ esbuild 转译 node 单测。

**Spec:** `docs/superpowers/specs/2026-09-16-diet-meal-plan-design.md`

## Global Constraints

- UI 文案全部中文；配色只用已有 token：paper/ink/clay/muted/line/surface；标题用 `font-display`。
- 不新增任何 npm 依赖。
- 克数一律按 5g 步进取整；热量用取整后克数重算（`Math.round(kcalPer100g * grams / 100)`）。
- 纯函数单测方式：`npx esbuild <file> --bundle --format=cjs --outfile=$TEMP/x.cjs` 后 `node $TEMP/test-x.cjs`（项目无测试框架，惯例如此）。
- 提交信息用中文（参照 git log 现有风格）。
- AppSettings 新字段必须同步三处：`types.ts`、`storage.ts` 的 `loadSettings`、`storage.ts` 的 `parseBackup`（项目惯例，漏了备份往返会丢）。

---

### Task 1: lib/mealplan.ts —— 菜单库 + 宏量公式 + 克数缩放

**Files:**
- Create: `src/lib/mealplan.ts`
- Test: `$TEMP/test-mealplan.cjs`（临时测试脚本，不入库）

**Interfaces:**
- Consumes: `DietGoal`（`./nutrition`，type-only）、`MealType`（`../types`，type-only）
- Produces（Task 3 依赖这些签名）:
  - `BASE_KCAL: 2000`
  - `MenuItem = { name: string; baseGrams: number; kcalPer100g: number; hint?: string }`
  - `MealMenu = { id: string; theme: string; items: MenuItem[] }`
  - `MacroRange = { low: number; high: number }`
  - `MacroTargets = { protein: MacroRange; fat: MacroRange; carbs: MacroRange }`
  - `ScaledItem = { name: string; grams: number; kcal: number; hint?: string }`
  - `macroTargets(weightKg: number, goal: DietGoal, dayTargetKcal: number): MacroTargets`
  - `scaleMenu(menu: MealMenu, dayTargetKcal: number): { items: ScaledItem[]; totalKcal: number }`
  - `menusFor(meal: MealType, isTrainingDay: boolean): MealMenu[]`

- [ ] **Step 1: 写失败测试**

写入 `$TEMP/test-mealplan.cjs`：

```js
const m = require(process.env.TEMP + '/mealplan.cjs')
const assert = require('node:assert')

// --- macroTargets ---
// 70kg 减脂 @2000：蛋白质 70*2.0=140 → [125,155]；脂肪 2000*0.25/9≈55.6 → [50,60]；碳水 (2000-560-500)/4=235 → [210,260]
const t1 = m.macroTargets(70, 'lose', 2000)
assert.deepStrictEqual(t1.protein, { low: 125, high: 155 })
assert.deepStrictEqual(t1.fat, { low: 50, high: 60 })
assert.deepStrictEqual(t1.carbs, { low: 210, high: 260 })
// 维持系数 1.6：70kg → 112g
assert.deepStrictEqual(m.macroTargets(70, 'maintain', 2000).protein, { low: 100, high: 125 })
// 增肌系数 1.8：60kg → 108g
assert.deepStrictEqual(m.macroTargets(60, 'gain', 2500).protein, { low: 95, high: 120 })
// 范围取整都是 5 的倍数
for (const r of Object.values(m.macroTargets(83, 'lose', 1730))) {
  assert.ok(r.low % 5 === 0 && r.high % 5 === 0 && r.low <= r.high)
}

// --- 菜单库结构 ---
const b = m.menusFor('breakfast', false)
assert.strictEqual(b.length, 3)
assert.strictEqual(m.menusFor('lunch', false).length, 3)
assert.strictEqual(m.menusFor('dinner', false).length, 3)
assert.strictEqual(m.menusFor('snack', false).length, 2)
assert.strictEqual(m.menusFor('snack', true).length, 2)
assert.notStrictEqual(m.menusFor('snack', true)[0].id, m.menusFor('snack', false)[0].id)
for (const menu of [...b, ...m.menusFor('lunch', false), ...m.menusFor('dinner', false), ...m.menusFor('snack', false), ...m.menusFor('snack', true)]) {
  assert.ok(menu.id && menu.theme && menu.items.length >= 2)
  for (const it of menu.items) {
    assert.ok(it.baseGrams % 5 === 0 && it.baseGrams >= 5, `${menu.id}/${it.name} 基准克数须为 5 的倍数`)
    assert.ok(it.kcalPer100g > 0 && it.kcalPer100g < 900)
  }
}

// --- scaleMenu ---
// 基准热量 2000 → 克数不变
const s0 = m.scaleMenu(b[0], 2000)
assert.deepStrictEqual(s0.items.map((i) => i.grams), b[0].items.map((i) => i.baseGrams))
// 克数始终 5 的倍数且 ≥5；热量 = round(kcalPer100g*grams/100)
for (const kcal of [1300, 1730, 2000, 2400, 3000]) {
  const s = m.scaleMenu(b[0], kcal)
  for (const [i, it] of s.items.entries()) {
    assert.ok(it.grams % 5 === 0 && it.grams >= 5)
    assert.strictEqual(it.kcal, Math.round(b[0].items[i].kcalPer100g * it.grams / 100))
  }
  assert.strictEqual(s.totalKcal, s.items.reduce((n, i) => n + i.kcal, 0))
}
// clamp：1300 → scale 0.65；3000 → clamp 1.4（燕麦 50g → 70g）
assert.strictEqual(m.scaleMenu(b[0], 1300).items[0].grams, 35)
assert.strictEqual(m.scaleMenu(b[0], 3000).items[0].grams, 70)
// 缩放近似守恒：总热量 ≈ 基准总热量 × scale（±3%，取整误差）
for (const [kcal, scale] of [[1500, 0.75], [2600, 1.3]]) {
  for (const menu of m.menusFor('lunch', false)) {
    const baseTotal = m.scaleMenu(menu, 2000).totalKcal
    const scaled = m.scaleMenu(menu, kcal).totalKcal
    assert.ok(Math.abs(scaled - baseTotal * scale) / (baseTotal * scale) < 0.03, `${menu.id} @${kcal}`)
  }
}

console.log('mealplan tests passed')
```

- [ ] **Step 2: 运行确认失败**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npx esbuild src/lib/mealplan.ts --bundle --format=cjs "--outfile=$TEMP/mealplan.cjs" --log-level=warning && node "$TEMP/test-mealplan.cjs"
```

预期：esbuild 报错 `Could not resolve "./mealplan"` 或文件不存在 —— 失败即正确。

- [ ] **Step 3: 实现 src/lib/mealplan.ts**

```ts
import type { MealType } from '../types'
import type { DietGoal } from './nutrition'

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
  return { low: Math.max(5, Math.round((mid * 0.9) / 5) * 5), high: Math.round((mid * 1.1) / 5) * 5 }
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
      { name: '燕麦片', baseGrams: 50, kcalPer100g: 370, hint: '牛奶冲泡或微波2分钟' },
      { name: '脱脂牛奶', baseGrams: 250, kcalPer100g: 35, hint: '冲燕麦或直接饮' },
      { name: '水煮蛋', baseGrams: 110, kcalPer100g: 155, hint: '2个，冷水下锅水沸后8分钟' },
      { name: '苹果', baseGrams: 150, kcalPer100g: 53, hint: '1个，直接食用' },
    ],
  },
  {
    id: 'b-soy-bun',
    theme: '豆浆包子',
    items: [
      { name: '无糖豆浆', baseGrams: 300, kcalPer100g: 31, hint: '无糖更佳' },
      { name: '菜肉包', baseGrams: 160, kcalPer100g: 227, hint: '2个，蒸热即可' },
      { name: '小番茄', baseGrams: 150, kcalPer100g: 25, hint: '直接食用' },
    ],
  },
  {
    id: 'b-toast-egg',
    theme: '全麦鸡蛋',
    items: [
      { name: '全麦面包', baseGrams: 80, kcalPer100g: 250, hint: '烤一下更香' },
      { name: '水煮蛋', baseGrams: 55, kcalPer100g: 155, hint: '1个，冷水下锅水沸后8分钟' },
      { name: '全脂牛奶', baseGrams: 250, kcalPer100g: 65, hint: '直接饮用' },
      { name: '香蕉', baseGrams: 120, kcalPer100g: 93, hint: '1根，直接食用' },
    ],
  },
]

const LUNCH: MealMenu[] = [
  {
    id: 'l-rice-chicken',
    theme: '糙米鸡胸',
    items: [
      { name: '糙米饭', baseGrams: 250, kcalPer100g: 115, hint: '熟重，提前浸泡2小时再煮' },
      { name: '鸡胸肉', baseGrams: 150, kcalPer100g: 165, hint: '少油煎或水煮撕丝' },
      { name: '西兰花', baseGrams: 200, kcalPer100g: 36, hint: '焯水2分钟' },
      { name: '番茄', baseGrams: 150, kcalPer100g: 20, hint: '直接食用' },
    ],
  },
  {
    id: 'l-beef-noodle',
    theme: '牛肉汤面',
    items: [
      { name: '面条', baseGrams: 250, kcalPer100g: 110, hint: '熟重，煮至无硬芯' },
      { name: '瘦牛肉', baseGrams: 100, kcalPer100g: 175, hint: '卤或快炒' },
      { name: '青菜', baseGrams: 150, kcalPer100g: 40, hint: '快炒少油' },
      { name: '玉米', baseGrams: 100, kcalPer100g: 112, hint: '蒸/煮15分钟' },
    ],
  },
  {
    id: 'l-fish-rice',
    theme: '清蒸鱼饭',
    items: [
      { name: '米饭', baseGrams: 200, kcalPer100g: 116, hint: '熟重' },
      { name: '清蒸鱼', baseGrams: 180, kcalPer100g: 120, hint: '水沸后蒸8-10分钟' },
      { name: '菠菜', baseGrams: 150, kcalPer100g: 45, hint: '蒜蓉快炒' },
      { name: '蒸红薯', baseGrams: 100, kcalPer100g: 90, hint: '蒸20分钟' },
    ],
  },
]

const DINNER: MealMenu[] = [
  {
    id: 'd-corn-chicken',
    theme: '玉米鸡丁',
    items: [
      { name: '玉米', baseGrams: 200, kcalPer100g: 112, hint: '蒸/煮15分钟' },
      { name: '鸡胸肉', baseGrams: 100, kcalPer100g: 165, hint: '切丁少油炒' },
      { name: '西兰花', baseGrams: 150, kcalPer100g: 36, hint: '焯水2分钟' },
      { name: '小米粥', baseGrams: 250, kcalPer100g: 46, hint: '煮30分钟' },
    ],
  },
  {
    id: 'd-soba',
    theme: '荞麦汤面',
    items: [
      { name: '荞麦面', baseGrams: 200, kcalPer100g: 105, hint: '熟重，煮后过凉水更劲道' },
      { name: '水煮蛋', baseGrams: 55, kcalPer100g: 155, hint: '1个' },
      { name: '北豆腐', baseGrams: 100, kcalPer100g: 116, hint: '煎或炖' },
      { name: '香蕉', baseGrams: 120, kcalPer100g: 93, hint: '餐后1根' },
    ],
  },
  {
    id: 'd-shrimp-rice',
    theme: '鲜虾杂粮饭',
    items: [
      { name: '杂粮饭', baseGrams: 180, kcalPer100g: 118, hint: '熟重，提前浸泡' },
      { name: '白灼虾', baseGrams: 120, kcalPer100g: 100, hint: '水沸后3分钟' },
      { name: '番茄炒蛋', baseGrams: 150, kcalPer100g: 95, hint: '少油' },
      { name: '菠菜', baseGrams: 150, kcalPer100g: 45, hint: '蒜蓉快炒' },
    ],
  },
]

// 加餐：日常两套；训练日换「练后蛋白」主题（练后 30-60 分钟内补充）
const SNACK_DAILY: MealMenu[] = [
  {
    id: 's-nut-apple',
    theme: '坚果水果',
    items: [
      { name: '苹果', baseGrams: 150, kcalPer100g: 53, hint: '1个' },
      { name: '核桃', baseGrams: 15, kcalPer100g: 654, hint: '3-4颗，上午加餐佳' },
    ],
  },
  {
    id: 's-yogurt-oat',
    theme: '酸奶燕麦',
    items: [
      { name: '无糖酸奶', baseGrams: 150, kcalPer100g: 62, hint: '直接食用' },
      { name: '燕麦片', baseGrams: 20, kcalPer100g: 370, hint: '拌入酸奶' },
    ],
  },
]

const SNACK_TRAINING: MealMenu[] = [
  {
    id: 's-shake',
    theme: '练后奶昔',
    items: [
      { name: '全脂牛奶', baseGrams: 250, kcalPer100g: 65, hint: '练后30-60分钟内' },
      { name: '香蕉', baseGrams: 120, kcalPer100g: 93, hint: '快碳补糖原' },
    ],
  },
  {
    id: 's-yogurt-banana',
    theme: '练后酸奶',
    items: [
      { name: '无糖酸奶', baseGrams: 200, kcalPer100g: 62, hint: '练后30-60分钟内' },
      { name: '香蕉', baseGrams: 120, kcalPer100g: 93, hint: '快碳补糖原' },
      { name: '核桃', baseGrams: 10, kcalPer100g: 654, hint: '2-3颗' },
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
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npx esbuild src/lib/mealplan.ts --bundle --format=cjs "--outfile=$TEMP/mealplan.cjs" --log-level=warning && node "$TEMP/test-mealplan.cjs"
```

预期输出：`mealplan tests passed`
（该模块不碰 Date/时区，无需跨时区跑；若失败按断言信息修正数值。）

- [ ] **Step 5: Commit**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
git add src/lib/mealplan.ts
git commit -m "饮食计划①：mealplan 菜单库+宏量营养素公式+克数缩放（纯函数，node 单测通过）"
```

---

### Task 2: settings.mealChoice 持久化（types + loadSettings + parseBackup）

**Files:**
- Modify: `src/types.ts:58-68`（AppSettings 加字段）
- Modify: `src/storage.ts:172-190`（loadSettings 白名单）与 `src/storage.ts:336-347`（parseBackup settings 白名单）
- Test: `$TEMP/test-mealchoice.cjs`

**Interfaces:**
- Consumes: Task 1 无依赖（独立任务）
- Produces: `AppSettings.mealChoice?: Partial<Record<MealType, number>>`；`isValidMealChoice(v: unknown): Partial<Record<MealType, number>> | undefined`（storage.ts 导出，Task 3 不直接用它，但测试要 require）

- [ ] **Step 1: 写失败测试**

写入 `$TEMP/test-mealchoice.cjs`：

```js
// localStorage 内存桩：storage.ts 直接读全局 localStorage
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
}
const s = require(process.env.TEMP + '/storage.cjs')
const assert = require('node:assert')

// 空存储 → mealChoice 为 undefined（默认空）
assert.strictEqual(s.loadSettings().mealChoice, undefined)

// 合法值原样保留；脏值被过滤
store.set('fitness-app:settings', JSON.stringify({
  weeklyGoalDays: 3, waterGoal: 8,
  mealChoice: { breakfast: 1, lunch: 0, junk: 2, dinner: -1, snack: 1.5, other: 'x' },
}))
const loaded = s.loadSettings()
assert.deepStrictEqual(loaded.mealChoice, { breakfast: 1, lunch: 0 })

// 全脏 → undefined
store.set('fitness-app:settings', JSON.stringify({ mealChoice: { junk: 1 } }))
assert.strictEqual(s.loadSettings().mealChoice, undefined)

// 备份往返：settings.mealChoice 合法 → 保留（heightCm 让 hasProfile 为 true，否则全空备份返回 null）
const backup = JSON.stringify({
  workouts: [], metrics: [], meals: [], routines: [], water: [],
  settings: { weeklyGoalDays: 3, waterGoal: 8, heightCm: 175, mealChoice: { dinner: 2, bad: 9 } },
})
const parsed = s.parseBackup(backup)
assert.deepStrictEqual(parsed.settings.mealChoice, { dinner: 2 })

console.log('mealChoice tests passed')
```

- [ ] **Step 2: 运行确认失败**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npx esbuild src/storage.ts --bundle --format=cjs "--outfile=$TEMP/storage.cjs" --log-level=warning && node "$TEMP/test-mealchoice.cjs"
```

预期：第一条断言失败（`mealChoice` 未定义 / deepStrictEqual 抛错）。

- [ ] **Step 3: 实现**

`src/types.ts` AppSettings 末尾（`dietPace` 行之后）加：

```ts
  // 饮食计划：每餐选中的菜单序号（换一套的记忆）
  mealChoice?: Partial<Record<MealType, number>>
```

`src/storage.ts`：在 `MEAL_VALUES` 定义（62 行）之后加校验函数：

```ts
// mealChoice 白名单校验：key 必须是合法餐别，值是 0-10 的整数（菜单序号）
export function isValidMealChoice(v: unknown): Partial<Record<MealType, number>> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const out: Partial<Record<MealType, number>> = {}
  for (const [k, val] of Object.entries(v)) {
    if (MEAL_VALUES.includes(k) && typeof val === 'number' && Number.isInteger(val) && val >= 0 && val <= 10) {
      out[k as MealType] = val
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}
```

`loadSettings` 返回对象里 `dietPace` 行之后加一行：

```ts
      mealChoice: isValidMealChoice(x.mealChoice),
```

`parseBackup` 的 settings 对象里 `dietPace` 行之后加一行：

```ts
        mealChoice: isValidMealChoice(rawSettings.mealChoice),
```

- [ ] **Step 4: 运行测试确认通过**

同 Step 2 命令。预期输出：`mealChoice tests passed`

- [ ] **Step 5: 类型检查 + Commit**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npx tsc --noEmit
git add src/types.ts src/storage.ts
git commit -m "饮食计划②：settings.mealChoice 持久化（loadSettings/parseBackup 白名单同步）"
```

预期：`tsc --noEmit` 无输出（通过）。

---

### Task 3: MealPlanView 组件 + DietTab 视图切换 + 一键记录

**Files:**
- Create: `src/components/MealPlanView.tsx`
- Modify: `src/tabs/DietTab.tsx`

**Interfaces:**
- Consumes: Task 1 的 `macroTargets/scaleMenu/menusFor/BASE_KCAL/ScaledItem`；Task 2 的 `settings.mealChoice`；DietTab 现有 `targetInfo/latestWeight/goal/isTrainingDay/onAdd/onUpdateSettings/uid`
- Produces: `MealPlanView` props（见下）；DietTab 新增 `view` 状态（'log' | 'plan'）

MealPlanView props 签名：

```ts
{
  isToday: boolean
  isTrainingDay: boolean
  dayTarget: number | null       // targetInfo?.target ?? null
  goal: DietGoal
  weightKg?: number              // latestWeight，可能 undefined
  waterGoal: number
  mealChoice: Partial<Record<MealType, number>> | undefined
  loggedMeal: MealType | null    // 一键记录后的确认态（4s）
  onChoose: (meal: MealType, index: number) => void
  onLogMenu: (meal: MealType, items: ScaledItem[]) => void
}
```

- [ ] **Step 1: 创建 `src/components/MealPlanView.tsx`**

```tsx
import type { MealType } from '../types'
import type { DietGoal } from '../lib/nutrition'
import { TRAINING_DAY_BONUS } from '../lib/nutrition'
import { MEAL_TYPES } from '../lib/diet'
import { BASE_KCAL, macroTargets, menusFor, scaleMenu, type ScaledItem } from '../lib/mealplan'

export function MealPlanView({
  isToday,
  isTrainingDay,
  dayTarget,
  goal,
  weightKg,
  waterGoal,
  mealChoice,
  loggedMeal,
  onChoose,
  onLogMenu,
}: {
  isToday: boolean
  isTrainingDay: boolean
  dayTarget: number | null
  goal: DietGoal
  weightKg?: number
  waterGoal: number
  mealChoice: Partial<Record<MealType, number>> | undefined
  loggedMeal: MealType | null
  onChoose: (meal: MealType, index: number) => void
  onLogMenu: (meal: MealType, items: ScaledItem[]) => void
}) {
  // 无身体资料时没有热量目标：菜单按 2000 kcal 基准展示，补全资料后自动按目标缩放
  const usingBase = dayTarget == null
  const target = dayTarget ?? BASE_KCAL
  const macros = weightKg ? macroTargets(weightKg, goal, target) : null

  return (
    <div>
      {/* 🎯 每日营养目标（只展示目标范围，不做达成追踪） */}
      <div className="mt-4 rounded-2xl bg-surface border border-line p-4">
        <p className="font-display italic text-muted text-[13px]">🎯 每日营养目标{isTrainingDay ? ` · 训练日 +${TRAINING_DAY_BONUS}` : ''}</p>
        {usingBase ? (
          <p className="mt-2 text-[12px] text-muted leading-relaxed">
            在「身体」页填写体重、身高、性别和出生年后，这里会生成你的专属目标；当前菜单按 {BASE_KCAL} kcal 基准展示
          </p>
        ) : (
          <p className="mt-2 font-display text-[24px] text-clay">{target}<span className="text-[13px] text-muted"> kcal/天</span></p>
        )}
        {macros && !usingBase && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-paper border border-line py-2">
              <p className="text-[11px] text-muted">蛋白质</p>
              <p className="text-[14px] text-ink">{macros.protein.low}-{macros.protein.high}g</p>
            </div>
            <div className="rounded-xl bg-paper border border-line py-2">
              <p className="text-[11px] text-muted">碳水</p>
              <p className="text-[14px] text-ink">{macros.carbs.low}-{macros.carbs.high}g</p>
            </div>
            <div className="rounded-xl bg-paper border border-line py-2">
              <p className="text-[11px] text-muted">脂肪</p>
              <p className="text-[14px] text-ink">{macros.fat.low}-{macros.fat.high}g</p>
            </div>
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted/80">💧 饮水目标 {waterGoal} 杯（记录视图打卡）</p>
      </div>

      {/* 四餐菜单 */}
      <div className="mt-4 space-y-3">
        {MEAL_TYPES.map(({ type, label, emoji }) => {
          const menus = menusFor(type, isTrainingDay)
          const idx = (mealChoice?.[type] ?? 0) % menus.length
          const menu = menus[idx]
          const scaled = scaleMenu(menu, target)
          const logged = loggedMeal === type
          return (
            <div key={type} className="rounded-2xl bg-surface border border-line p-4">
              <div className="flex items-center justify-between">
                <p className="text-[15px] text-ink">{emoji} {label}<span className="ml-1.5 text-[12px] text-muted">{menu.theme}</span></p>
                <p className="text-[12px] text-clay">~{scaled.totalKcal} 大卡</p>
              </div>
              <ul className="mt-2 space-y-1.5">
                {scaled.items.map((it) => (
                  <li key={it.name} className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="text-ink min-w-0">
                      {it.name}
                      {it.hint && <span className="ml-1.5 text-[11px] text-muted/80">{it.hint}</span>}
                    </span>
                    <span className="shrink-0 text-muted tabular-nums">{it.grams}g</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => onChoose(type, (idx + 1) % menus.length)}
                  className="flex-1 py-1.5 rounded-full border border-line text-[12px] text-muted hover:text-clay hover:border-clay/40 transition"
                >
                  ⇄ 换一套
                </button>
                <button
                  onClick={() => onLogMenu(type, scaled.items)}
                  disabled={logged}
                  className={`flex-1 py-1.5 rounded-full text-[12px] transition ${
                    logged ? 'bg-line text-muted/60' : 'bg-clay text-white hover:bg-clay/90 active:scale-95'
                  }`}
                >
                  {logged ? `✓ 已记录 ${scaled.items.length} 项` : '按菜单记录'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-3 px-1 text-[11px] text-muted/70 leading-relaxed">
        菜单克数按{isToday ? '今日' : '当日'}目标 {target} kcal 自动缩放；重复点「按菜单记录」会重复写入，可在记录视图单条删除
      </p>
    </div>
  )
}
```

- [ ] **Step 2: 改造 `src/tabs/DietTab.tsx`**

1) 顶部 import 区（第 10 行 `import { ZeroBar }...` 之后）加：

```ts
import { MealPlanView } from '../components/MealPlanView'
import type { ScaledItem } from '../lib/mealplan'
```

2) state 区（第 61 行 `const [showGoalSetup, ...]` 之后）加：

```ts
  const [view, setView] = useState<'log' | 'plan'>('log')
  const [loggedMeal, setLoggedMeal] = useState<MealType | null>(null)
```

3) `goTo` 和 `stepDate` 里各加一行重置（与 `setCopyConfirm(false)` 并列）：

```ts
    setLoggedMeal(null)
```

4) 在 `copyPrev` 函数之后加两个处理函数：

```ts
  // 「换一套」：菜单序号持久化到 settings（刷新/换日保留）
  function chooseMenu(meal: MealType, index: number) {
    onUpdateSettings({ mealChoice: { ...settings.mealChoice, [meal]: index } })
  }

  // 「按菜单记录」：逐项写入当天记录（与手动记录同构，单条可删、进备份）
  function logMenu(meal: MealType, items: ScaledItem[]) {
    for (const it of items) {
      onAdd({ id: uid(), date, meal, name: `${it.name} ${it.grams}g`, kcal: it.kcal, createdAt: Date.now() })
    }
    setLoggedMeal(meal)
    setTimeout(() => setLoggedMeal((cur) => (cur === meal ? null : cur)), 4000)
  }
```

5) JSX：`<h1 ...>饮食</h1>` 之后、日期切换块之前，插入视图切换（复用 HistoryTab 的胶囊样式）：

```tsx
      <div className="mt-2 flex justify-center gap-1.5">
        <button onClick={() => setView('log')} className={`px-3 py-1 rounded-full text-[12px] border transition ${view === 'log' ? 'bg-clay text-white border-clay' : 'border-line text-muted'}`}>记录</button>
        <button onClick={() => setView('plan')} className={`px-3 py-1 rounded-full text-[12px] border transition ${view === 'plan' ? 'bg-clay text-white border-clay' : 'border-line text-muted'}`}>计划</button>
      </div>
```

6) 「复制前一天」按钮（193-204 行的第二个 flex 容器）改为只在 log 视图显示；「回到今天」两个视图都保留。把该容器改为：

```tsx
      <div className="mt-2 flex items-center justify-center gap-3">
        {!isToday && (
          <button onClick={() => goTo(today)} className="py-1 px-3 text-[12px] text-clay hover:underline">回到今天</button>
        )}
        {view === 'log' && (
          <button
            onClick={copyPrev}
            disabled={!meals.some((m) => m.date === shiftDate(date, -1))}
            className={`py-1 px-3 text-[12px] rounded-full border transition disabled:opacity-30 ${copyConfirm ? 'border-clay text-clay' : 'border-line text-muted hover:text-clay'}`}
          >
            {copyConfirm ? '再点一次，将覆盖当天饮食' : '⧉ 复制前一天'}
          </button>
        )}
      </div>
```

7) 计划视图渲染：在第 6 步容器之后加：

```tsx
      {view === 'plan' && (
        <MealPlanView
          isToday={isToday}
          isTrainingDay={isTrainingDay}
          dayTarget={targetInfo ? targetInfo.target : null}
          goal={goal}
          weightKg={latestWeight}
          waterGoal={settings.waterGoal}
          mealChoice={settings.mealChoice}
          loggedMeal={loggedMeal}
          onChoose={chooseMenu}
          onLogMenu={logMenu}
        />
      )}
```

8) 记录视图包裹：从「热量目标设置」注释（206 行 `{/* 热量目标设置...`）到文件末尾的「近 7 天热量」卡片（404 行 `</div>` 收尾前），整体包进：

```tsx
      {view === 'log' && (
        <>
          …原有全部内容（热量目标设置卡、当日热量卡、喝水、四餐、近7天柱图）…
        </>
      )}
```

- [ ] **Step 3: 构建 + 类型检查**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npm run build
```

预期：tsc + vite build 通过，无 TS 错误。

- [ ] **Step 4: 浏览器预览验证**

```bash
# dev server（launch.json 在 workspace 根，autoPort）
```

用 preview_start 启动 fitness 配置 → preview_resize mobile(375) → 验证清单：
1. 饮食 tab 顶部出现「记录 | 计划」切换，默认「记录」内容原样
2. 切到「计划」：出现 🎯 目标卡 + 四餐菜单卡（无身体资料的 localStorage 状态下显示基准提示文案）
3. eval 注入完整 profile（体重/身高/性别/出生年）后 reload：目标卡显示 kcal/天 + 三营养素范围
4. 点「换一套」：菜单主题切换；reload 后保持（mealChoice 持久化）
5. 点「按菜单记录」→ 按钮变「✓ 已记录到今天」→ 切回「记录」视图：对应餐别下出现逐条食物（名称含克数），热量合计 ≈ 菜单卡显示值
6. 有训练记录的日期（可 eval 注入一条当日 workout）：加餐变「练后奶昔/练后酸奶」主题，目标卡标注训练日
7. preview_resize desktop 收尾

- [ ] **Step 5: Commit**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
git add src/components/MealPlanView.tsx src/tabs/DietTab.tsx
git commit -m "饮食计划③：DietTab 记录|计划视图切换+四餐菜单卡+一键记录"
```

---

### Task 4: 对抗审查 + 修复 + 推送部署

**Files:**
- Modify: 视审查结论而定

**Interfaces:**
- Consumes: Task 1-3 全部产物
- Produces: 修复提交 + 线上可用功能

- [ ] **Step 1: 跑 code-review（项目质量流程的对抗审查）**

对 `fda8e26..HEAD` 的完整 diff 调 `/code-review` high 档，逐条确认/修复。历史确认率约 50-100%，高危必修。

- [ ] **Step 2: 修复确认的问题，重跑验证**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npx esbuild src/lib/mealplan.ts --bundle --format=cjs "--outfile=$TEMP/mealplan.cjs" --log-level=warning && node "$TEMP/test-mealplan.cjs"
npx esbuild src/storage.ts --bundle --format=cjs "--outfile=$TEMP/storage.cjs" --log-level=warning && node "$TEMP/test-mealchoice.cjs"
npm run build
```

预期：两个测试脚本输出 passed，build 通过。

- [ ] **Step 3: 提交修复并推送**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
git add -A && git commit -m "饮食计划④：对抗审查修复"
GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null GIT_TERMINAL_PROMPT=0 git -c credential.helper='!gh auth git-credential' push https://github.com/Chris-Xie369/fitness-app.git main
```

- [ ] **Step 4: 验证 Cloudflare 部署**

push 后等约 60-90 秒（CF 自动构建）：

```bash
curl -s https://fitness-app-a6t.pages.dev/ | grep -o 'assets/index-[^"]*\.js' | head -1
# 取到新 bundle 名后：
curl -s "https://fitness-app-a6t.pages.dev/assets/index-<新hash>.js" | grep -c "换一套"
```

预期：grep 计数 ≥ 1（新文案已上线）。注意 Netlify 已 Lock，不要动；只验证 CF。

- [ ] **Step 5: 更新项目记忆**

更新 `memory/fitness-app-progress.md`：追加 2026-09-16 饮食计划条目（commit hash、功能要点、审查确认数）。

---

## Self-Review 记录

- **Spec 覆盖**：视图切换✓(T3) 动态目标卡✓(T1+T3) 菜单库+缩放✓(T1) 换一套持久化✓(T2+T3) 一键记录✓(T3) 训练日练后加餐✓(T1 menusFor+T3) 缺资料降级✓(T3 usingBase) 测试流程✓(T1/T2/T4) 部署✓(T4)
- **无占位符**：所有代码完整给出。
- **类型一致性**：`ScaledItem`、`menusFor`、`mealChoice`、`isValidMealChoice` 在任务间签名一致；DietTab 的 `uid`/`targetInfo`/`latestWeight`/`goal`/`isTrainingDay` 均为现有变量（已核对源码）。
- **spec 歧义处理**：spec 说"缺体重时菜单仍可用"但缺体重即无热量目标 → 定为按 BASE_KCAL 基准展示并明示（MealPlanView usingBase 分支）。
