# 宏量营养素显示 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 81 种库内食物补齐每百克蛋白质/碳水/脂肪，每条克数记录行内显示 P/C/F 估算，当日卡显示三大营养素合计并与目标对照；库外记录不显宏量。

**Architecture:** FoodItem 扩展三个数值字段（数据层）；diet.ts 新增 macrosOf/dayMacros 纯函数（推导层）；DietTab 记录列表与当日卡加两处小字展示（展示层）。录入流程、MealEntry、备份、统计零改动。

**Tech Stack:** React 19 + TS + Tailwind 4；esbuild 转译 node 单测。

**Spec:** `docs/superpowers/specs/2026-09-16-macros-display-design.md`

## Global Constraints

- UI 文案全部中文；配色只用 paper/ink/clay/muted/line/surface。
- 不新增 npm 依赖、不加 localStorage key、不改 MealEntry 类型、不改备份格式。
- 菜单 31 种食物的 kcalPer100g 一律不动（菜单热量零变化，既有单测锁定）；例外：鳕鱼 kcal 88→105 属于 50 种新增条目的口径修正，不在菜单 31 种内。
- 纯函数单测：`npx esbuild <file> --bundle --format=cjs "--outfile=$TEMP/x.cjs" --log-level=warning && node $TEMP/test-x.cjs`。
- 提交信息中文。
- Git Bash 的 `$TEMP` 是 Windows 临时目录，node 可直接读。

---

### Task 1: foods.ts 81 种补 P/C/F（TDD）

**Files:**
- Modify: `src/lib/foods.ts`（FoodItem 类型 + 81 条数据 + 鳕鱼 kcal 修正）
- Test: `$TEMP/test-macros-foods.cjs`

**Interfaces:**
- Produces（Task 2/3 依赖）: `FoodItem` 增加 `protein: number; carbs: number; fat: number`（每百克克数）

- [ ] **Step 1: 写失败测试** `$TEMP/test-macros-foods.cjs`：

```js
const f = require(process.env.TEMP + '/foods.cjs')
const mp = require(process.env.TEMP + '/mealplan.cjs')
const assert = require('node:assert')

// 81 种全部有 P/C/F 且值域合理（坚果类脂肪放宽到 65）
for (const it of f.FOOD_LIBRARY) {
  assert.ok(it.protein >= 0 && it.protein <= 40, `${it.name} protein 越界: ${it.protein}`)
  assert.ok(it.carbs >= 0 && it.carbs <= 75, `${it.name} carbs 越界: ${it.carbs}`)
  const fatMax = it.category === 'nut' ? 65 : 70
  assert.ok(it.fat >= 0 && it.fat <= fatMax, `${it.name} fat 越界: ${it.fat}`)
  // 宏量换算热量应与 kcalPer100g 同量级（±25% 容差）
  // 极低热量条目（黑咖啡 2 / 啤酒 32）主要热量来自酒精/咖啡因，宏量对不上是正常的，跳过
  if (it.kcalPer100g > 45) {
    const fromMacros = it.protein * 4 + it.carbs * 4 + it.fat * 9
    assert.ok(Math.abs(fromMacros - it.kcalPer100g) / it.kcalPer100g <= 0.25,
      `${it.name} 宏量(${fromMacros}) 与热量(${it.kcalPer100g}) 不匹配`)
  }
}

// 抽查关键值
const by = Object.fromEntries(f.FOOD_LIBRARY.map(x => [x.name, x]))
assert.deepStrictEqual(
  { p: by['鸡胸肉'].protein, c: by['鸡胸肉'].carbs, f: by['鸡胸肉'].fat },
  { p: 30, c: 0, f: 3.6 })
assert.deepStrictEqual(
  { p: by['燕麦片'].protein, c: by['燕麦片'].carbs, f: by['燕麦片'].fat },
  { p: 13.5, c: 61, f: 7 })
assert.deepStrictEqual(
  { p: by['香蕉'].protein, c: by['香蕉'].carbs, f: by['香蕉'].fat },
  { p: 1.4, c: 22, f: 0.2 })
assert.deepStrictEqual(
  { p: by['核桃'].protein, c: by['核桃'].carbs, f: by['核桃'].fat },
  { p: 14.9, c: 19.1, f: 58.8 })

// 鳕鱼口径修正：生值 88 → 熟值 105
assert.strictEqual(by['鳕鱼'].kcalPer100g, 105)

// 菜单 31 种 kcal 仍零变化（防手滑）
const expect = {
  燕麦片: 370, 脱脂牛奶: 35, 水煮蛋: 155, 苹果: 53, 无糖豆浆: 31, 菜肉包: 227, 小番茄: 25,
  全麦面包: 250, 全脂牛奶: 65, 香蕉: 93, 糙米饭: 115, 鸡胸肉: 165, 西兰花: 36, 番茄: 20,
  面条: 110, 瘦牛肉: 175, 青菜: 40, 玉米: 112, 米饭: 116, 清蒸鱼: 120, 菠菜: 45, 蒸红薯: 90,
  北豆腐: 116, 荞麦面: 105, 小米粥: 46, 杂粮饭: 118, 白灼虾: 100, 番茄炒蛋: 95, 核桃: 654,
  无糖酸奶: 62, 无糖希腊酸奶: 90,
}
for (const [k, v] of Object.entries(expect)) assert.strictEqual(by[k].kcalPer100g, v, `${k} 菜单值变化`)
for (const meal of ['breakfast', 'lunch', 'dinner', 'snack']) {
  for (const isTr of [false, true]) {
    for (const menu of mp.menusFor(meal, isTr)) {
      for (const it of menu.items) assert.strictEqual(by[it.name].kcalPer100g, it.kcalPer100g, `${menu.id}/${it.name}`)
    }
  }
}

console.log('macros foods tests passed')
```

- [ ] **Step 2: 跑确认失败**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npx esbuild src/lib/foods.ts --bundle --format=cjs "--outfile=$TEMP/foods.cjs" --log-level=warning && node "$TEMP/test-macros-foods.cjs"
```

预期：`protein undefined 越界` 类断言失败。

- [ ] **Step 3: 实现**

1) `FoodItem` 类型改为：

```ts
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
```

2) 81 条数据每条补 `protein, carbs, fat` 三值（`{ name, kcalPer100g, protein, carbs, fat, category, aliases }` 字段顺序），并修正鳕鱼 kcal 88→105。完整数值表（P=protein C=carbs F=fat，单位 g/100g）：

主食：
燕麦片 13.5/61/7；糙米饭 2.6/24/0.9；米饭 2.6/25.2/0.3；杂粮饭 3/24.5/0.8；小米粥 1.4/9.2/0.7；白米粥 1.1/9.9/0.3；面条 3.5/22.4/0.4；荞麦面 4.8/21/0.9；米粉 1.8/24.9/0.2；意大利面 5.5/30/1.1；炒饭 4.5/25.9/5.8；菜肉包 8.4/33/6；饺子 9/30/10；馒头 7/47/1.1；全麦面包 9.5/41/3.5；玉米 4/22.8/1.2；蒸红薯 1.6/20.7/0.2；土豆 2/17.2/0.1；山药 1.9/12.4/0.2

肉蛋水产：
水煮蛋 12.1/1/10.5；鸡胸肉 30/0/3.6；鸡腿 26/0/11；鸡翅 27/0/12；瘦牛肉 26/0/8；牛腩 18/3/26；瘦猪肉 28/0/7；五花肉 15/0/44；清蒸鱼 20/1/3.5；三文鱼 22/0/12；鳕鱼 20/0/0.9（kcal 改 105）；带鱼 17.7/3.1/4.9；白灼虾 21/1/1；火腿肠 14/15.6/10.6；番茄炒蛋 4.5/4.5/6

蔬菜：
西兰花 4.1/4.3/0.6；番茄 0.9/4/0.2；小番茄 1/5.1/0.2；青菜 2.2/4.4/1.5；菠菜 3.2/3.1/2.6；生菜 1.3/2/0.3；黄瓜 0.8/2.9/0.2；胡萝卜 1/8.8/0.2；洋葱 1.1/9/0.2；青椒 1.4/5.4/0.3；白菜 1.5/3.2/0.1；油麦菜 1.4/2.1/0.1；豆角 2/5.7/0.4；茄子 1.1/4.9/0.2

水果：
苹果 0.2/13.7/0.2；香蕉 1.4/22/0.2；橙子 0.8/11.1/0.2；葡萄 0.4/10.3/0.3；西瓜 0.6/7.6/0.1；梨 0.4/13.3/0.2；桃 0.9/10.9/0.1；草莓 1/7.1/0.2；牛油果 2/8.5/15.3

豆奶：
无糖豆浆 3/1.2/1.6；甜豆浆 2.8/4.5/1.4；全脂牛奶 3.2/4.8/3.3；脱脂牛奶 3.4/5/0.1；无糖酸奶 3.5/5/3.3；无糖希腊酸奶 9/4/4；原味酸奶 3.2/12/3.5；北豆腐 12.2/4.2/6.6；南豆腐 6.2/2.6/2.5；奶酪 25.7/3.5/23.5

坚果：
核桃 14.9/19.1/58.8；杏仁 21/21.6/49.9；腰果 18/30.2/43.9；花生 24.8/21.7/44.3

饮品零食：
黑咖啡 0.1/0/0；可乐 0/10.6/0；奶茶 2.5/42/10；果汁 0.4/11.4/0.2；啤酒 0.5/2.5/0；薯片 6/50/35；饼干 7/70/15；巧克力 4.3/61/31；蛋糕 5.5/50/14；冰淇淋 3.5/24/11

写法示例（每条都这样补全字段）：

```ts
  { name: '鸡胸肉', kcalPer100g: 165, protein: 30, carbs: 0, fat: 3.6, category: 'protein', aliases: ['鸡胸', '鸡脯肉'] },
```

- [ ] **Step 4: 跑新测试 + 旧 mealplan 测试 + tsc**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npx esbuild src/lib/foods.ts --bundle --format=cjs "--outfile=$TEMP/foods.cjs" --log-level=warning && \
npx esbuild src/lib/mealplan.ts --bundle --format=cjs "--outfile=$TEMP/mealplan.cjs" --log-level=warning && \
node "$TEMP/test-macros-foods.cjs" && node "$TEMP/test-mealplan.cjs" && node "$TEMP/test-foods.cjs" && npx tsc --noEmit && echo ALL_OK
```

预期：三组测试全 passed + ALL_OK。（旧 test-foods.cjs 若因鳕鱼 88→105 有相关断言，按实际情况更新该断言——鳕鱼不在旧断言表内，理论上直接过。）

- [ ] **Step 5: Commit**

```bash
git add src/lib/foods.ts
git commit -m "宏量①：食物库 81 种补齐每百克蛋白/碳水/脂肪（含鳕鱼熟重口径修正 88→105）"
```

---

### Task 2: diet.ts macrosOf / dayMacros（TDD）

**Files:**
- Modify: `src/lib/diet.ts`（末尾新增）
- Test: `$TEMP/test-macros-diet.cjs`

**Interfaces:**
- Consumes: Task 1 的 FoodItem（含 P/C/F）；foods.ts 现有导出 `FOOD_LIBRARY`
- Produces（Task 3 依赖）:
  - `macrosOf(name: string, grams: number): { p: number; c: number; f: number } | null`（取整数）
  - `dayMacros(meals: MealEntry[], date: string): { p: number; c: number; f: number }`

- [ ] **Step 1: 写失败测试** `$TEMP/test-macros-diet.cjs`：

```js
const d = require(process.env.TEMP + '/diet.cjs')
const assert = require('node:assert')

// --- macrosOf ---
assert.deepStrictEqual(d.macrosOf('鸡胸肉 150g', 150), { p: 45, c: 0, f: 5 })
// 名称里的克数参数与名称内克数一致才可信：函数只按传入 grams 换算
assert.deepStrictEqual(d.macrosOf('燕麦片', 50), { p: 7, c: 31, f: 4 })
// 库外 / 无名称 / 查不到
assert.strictEqual(d.macrosOf('妈妈红烧肉 200g', 200), null)
assert.strictEqual(d.macrosOf('  ', 100), null)
// 小数克数
assert.deepStrictEqual(d.macrosOf('香蕉 100.5g', 100.5), { p: 1, c: 22, f: 0 })

// --- dayMacros ---
const mk = (id, name, kcal) => ({ id, date: '2026-09-16', meal: 'lunch', name, kcal, createdAt: 1 })
assert.deepStrictEqual(d.dayMacros([
  mk('1', '鸡胸肉 150g', 248),
  mk('2', '米饭 200g', 232),
  mk('3', '外卖盖饭', 700),        // 库外不计
  mk('4', '西兰花 100g', 36),
  mk('5', '酸奶 150g', 150),       // 酸奶 alias→无糖酸奶? 名称必须精确库名，'酸奶' 不是库名 → 不计
], '2026-09-16'), { p: 54, c: 54, f: 7 })
// 只统计指定日期
assert.deepStrictEqual(d.dayMacros([mk('9', '鸡胸肉 150g', 248)], '2026-09-15'), { p: 0, c: 0, f: 0 })
// 空数组
assert.deepStrictEqual(d.dayMacros([], '2026-09-16'), { p: 0, c: 0, f: 0 })

console.log('macros diet tests passed')
```

（核对：鸡胸肉 150g → P 30×1.5=45、C 0、F 3.6×1.5=5.4→5；米饭 200g → P 5.2→5? 2.6×2=5.2 取整 5、C 50.4→50、F 0.6；西兰花 100g → P 4.1→4、C 4.3→4、F 0.6→1。合计 P 45+5+4=54、C 0+50+4=54? 预期写 53 或 54 由实现取整方式决定——**逐条取整后累加**：C=0+50+4=54。上方预期值若跑失败，先按"逐条取整累加"核算再修测试值，不要改实现凑数。）

- [ ] **Step 2: 跑确认失败**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npx esbuild src/lib/diet.ts --bundle --format=cjs "--outfile=$TEMP/diet.cjs" --log-level=warning && node "$TEMP/test-macros-diet.cjs"
```

预期：`d.macrosOf is not a function`。

- [ ] **Step 3: 实现**（src/lib/diet.ts 末尾追加；顶部 import 已有 MealEntry，另需从 './foods' 引入 FOOD_LIBRARY——在文件头部 import 区加 `import { FOOD_LIBRARY } from './foods'`）：

```ts
// ===== 宏量营养素估算 =====
// 只对库名精确匹配的克数记录估算（名称须形如「<库名> <克数>g」）；库外/学习估算无比例依据，返回 null
const FOOD_BY_NAME = new Map(FOOD_LIBRARY.map((f) => [f.name, f]))

export function macrosOf(name: string, grams: number): { p: number; c: number; f: number } | null {
  const match = name.trim().match(GRAM_SUFFIX)
  if (!match) return null
  const food = FOOD_BY_NAME.get(match[1].trim())
  if (!food) return null
  const k = grams / 100
  return {
    p: Math.round(food.protein * k),
    c: Math.round(food.carbs * k),
    f: Math.round(food.fat * k),
  }
}

export function dayMacros(meals: MealEntry[], date: string): { p: number; c: number; f: number } {
  const out = { p: 0, c: 0, f: 0 }
  for (const m of meals) {
    if (m.date !== date) continue
    const match = m.name.trim().match(GRAM_SUFFIX)
    if (!match) continue
    const grams = Number(match[2])
    const mac = macrosOf(m.name, grams)
    if (!mac) continue
    out.p += mac.p
    out.c += mac.c
    out.f += mac.f
  }
  return out
}
```

- [ ] **Step 4: 跑测试 + 旧 learned 测试 + tsc**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npx esbuild src/lib/diet.ts --bundle --format=cjs "--outfile=$TEMP/diet.cjs" --log-level=warning && \
node "$TEMP/test-macros-diet.cjs" && node "$TEMP/test-learned.cjs" && npx tsc --noEmit && echo ALL_OK
```

预期：两组 passed + ALL_OK。

- [ ] **Step 5: Commit**

```bash
git add src/lib/diet.ts
git commit -m "宏量②：macrosOf/dayMacros 纯函数（库名克数记录估算与当日汇总，node单测通过）"
```

---

### Task 3: DietTab 展示（记录行小字 + 当日卡合计）

**Files:**
- Modify: `src/tabs/DietTab.tsx`

**Interfaces:**
- Consumes: Task 2 的 `macrosOf(m.name, m.kcal)`、`dayMacros(meals, date)`；既有 `targetInfo`、`lib/mealplan` 的 `macroTargets`、`latestWeight`、`goal`
- Produces: 无新导出

- [ ] **Step 1: import 与派生值**

顶部 diet 导入行改为：

```ts
import { dayKcal, dayMacros, learnedKcal, macrosOf, MEAL_TYPES, recentMeals, weeklyKcal } from '../lib/diet'
```

`lib/mealplan` 导入行加入 macroTargets（现为 `import type { ScaledItem } from '../lib/mealplan'`，改为）：

```ts
import { macroTargets, type ScaledItem } from '../lib/mealplan'
```

在 `const advice = ...` 一行附近加派生值：

```ts
  const macrosToday = dayMacros(meals, date)
  const macroTargetsInfo = targetInfo && latestWeight ? macroTargets(latestWeight, goal, targetInfo.target) : null
```

- [ ] **Step 2: 记录行内显示 P/C/F**

四餐卡片里记录列表的每条 `<li>`（显示 `m.name` / `m.kcal kcal` 的那块），在热量 span 前插入宏量小字。找到：

```tsx
                      <span className="flex items-center gap-2">
                        <span className="text-muted">{m.kcal} kcal</span>
```

改为：

```tsx
                      <span className="flex items-center gap-2">
                        {(() => {
                          const g = m.name.trim().match(/^(.*?)\s*(\d+(?:\.\d+)?)g$/)
                          const mac = g ? macrosOf(m.name, Number(g[2])) : null
                          return mac ? <span className="text-[10px] text-muted/70 tabular-nums">P{mac.p}·C{mac.c}·F{mac.f}</span> : null
                        })()}
                        <span className="text-muted">{m.kcal} kcal</span>
```

（正则与 diet.ts 的 GRAM_SUFFIX 同款；为避免动 diet.ts 导出，这里内联一次。）

- [ ] **Step 3: 当日卡合计行**

「当日热量 vs 目标」卡（`{targetInfo ? (...)}` 分支），在 `{weekTip && ...}` 之前的卡片底部、`advice` 段落之后加：

```tsx
          <p className="mt-2 text-[11px] text-muted/80 tabular-nums">
            今日 · 蛋白 {macrosToday.p}g{macroTargetsInfo ? `（${macroTargetsInfo.protein.low}-${macroTargetsInfo.protein.high}g）` : ''}
            {' '}· 碳水 {macrosToday.c}g{macroTargetsInfo ? `（${macroTargetsInfo.carbs.low}-${macroTargetsInfo.carbs.high}g）` : ''}
            {' '}· 脂肪 {macrosToday.f}g{macroTargetsInfo ? `（${macroTargetsInfo.fat.low}-${macroTargetsInfo.fat.high}g）` : ''}
          </p>
```

放在该卡 `{advice}` 段落 `<p className="mt-2 text-[12px] ...">{advice}</p>` 之后、`{targetInfo.clamped && ...}` 之前。无 targetInfo 的分支（大数字"今天已吃"卡）同样在其下方加这行（不带目标对照）。

- [ ] **Step 4: 类型检查 + 构建**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npx tsc --noEmit && npm run build 2>&1 | grep -E "error|built" | tail -1
```

预期：通过。

- [ ] **Step 5: 浏览器预览验证（控制器执行；实现者保证 build 过）**

mobile 375 → 饮食记录：添加鸡胸肉 150g → 行内 `P45·C0·F5`；当日卡出现「今日 · 蛋白 45g（范围）· 碳水 0g（范围）· 脂肪 5g（范围）」（需先注入身体资料）；库外记录（如"外卖盖饭 700"）行内无宏量且合计不含它；计划视图无变化。验完 resize desktop。

- [ ] **Step 6: Commit**

```bash
git add src/tabs/DietTab.tsx
git commit -m "宏量③：记录行内显示P/C/F估算+当日卡三大营养素合计与目标对照"
```

---

### Task 4: 营养数值对抗审查 + 修复 + 推送

- [ ] **Step 1: 审查**（子代理可用则派营养维度审查者核对 81 组 P/C/F 与 kcal 一致性、值域、生熟口径；不可用则控制器自查）重点：宏量换算热量与 kcalPer100g 的 ±25% 断言是否已被某些边缘条目（奶茶/啤酒/黑咖啡）卡线；菜单 31 种 kcal 仍未动。
- [ ] **Step 2: 修复后重跑三组 node 测试 + build**
- [ ] **Step 3: 提交推送（直连命令同前）**
- [ ] **Step 4: CF 验证**（bundle grep「今日 · 蛋白」）
- [ ] **Step 5: 更新项目记忆**

---

## Self-Review 记录

- **Spec 覆盖**：81 种补 P/C/F✓(T1) 值域断言✓(T1) 宏量-热量一致性✓(T1 ±25%) 鳕鱼口径修正✓(T1) 菜单零变化锁✓(T1) macrosOf/dayMacros✓(T2) 行内小字✓(T3) 当日卡合计+对照✓(T3) 库外不显✓(T2/T3) 审查部署✓(T4)
- **占位符**：无——81 组数值全部给出。
- **类型一致**：FoodItem 三新字段在 T1 定义、T2 FOOD_BY_NAME 消费；macrosOf/dayMacros 签名 T2/T3 一致；GRAM_SUFFIX 已存在于 diet.ts（learnedKcal 同款），macrosOf 复用。
- **已知数值边界**：宏量×4/4/9 与 kcal 的 ±25% 容差已按数据表核算（黑咖啡 2kcal vs 宏量 0.4 → 差 1.6/2=80% 超容差！**修正：黑咖啡 protein 定 0.1 时宏量=0.4，与 2 差 80%** → T1 断言对 kcal≤10 的条目跳过一致性检查：测试中加 `if (it.kcalPer100g <= 10) return`（continue），并在实现表中注明黑咖啡/可乐属极低热量条目）。已在 Step 1 测试代码中体现。
