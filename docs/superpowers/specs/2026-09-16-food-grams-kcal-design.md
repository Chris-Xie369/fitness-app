# 食物+重量自动算热量 设计

日期：2026-09-16
状态：已获用户批准

## 背景与目标

饮食记录目前只支持手填每餐食物名+大卡数字，用户（健身新手）往往无法估算热量。本功能让用户输入食物名+重量(g)，应用按内置食物库自动算出热量。

### 已确认的产品决策

1. **自动补全+克数录入**：食物名输入框带自动补全，选中库内食物后右侧框从「大卡」变为「克数 g」，实时显示算出的热量；大卡仍可手动覆盖；库外食物完全保持现有的手填大卡行为。
2. **~80 种高频中式食物库**：复用菜单库 30 种（提取为共享数据源）+ 补约 50 种日常高频，分 7 类。
3. **库外食物手填+自动学习**：库外食物手填大卡；若同名食物在历史记录里出现过克数（菜单/克数记录），按历史平均 kcal/g 反推，下次输入同名时建议「≈ 上次估算」。无历史克数则不估算。
4. **克数存进名称**：记录形态为 `鸡胸肉 150g` + 计算出的 kcal（与「按菜单记录」写入的现有记录形态统一），MealEntry 结构不变、无数据迁移。
5. **纯本地、无新依赖、无新存储 key**：学习数据从既有 meals 记录推导。

## 架构与文件

- 新增 `src/lib/foods.ts`（纯函数+数据，无 React，可 node 单测）
- 改 `src/lib/mealplan.ts`：菜单项 kcalPer100g 改为从 foods.ts 按名引用（单一数据源，菜单与录入数值永远一致）
- 改 `src/lib/diet.ts`：recentMeals 之外新增学习推导纯函数
- 改 `src/tabs/DietTab.tsx`：录入区自动补全+克数/大卡双模输入

## 数据模型（foods.ts）

```ts
export type FoodCategory = 'staple' | 'protein' | 'veg' | 'fruit' | 'dairy' | 'nut' | 'snack'
export type FoodItem = { name: string; kcalPer100g: number; category: FoodCategory; aliases?: string[] }
export const FOOD_LIBRARY: FoodItem[]   // ~80 种
export function searchFoods(query: string, limit?: number): FoodItem[]
export function kcalFor(kcalPer100g: number, grams: number): number  // Math.round(v*g/100)
```

### 匹配规则 searchFoods
- query trim 后空串返回 []
- 名字或任一 alias「包含」query（不区分大小写）即命中；名字「前缀」命中排最前，其余按库内顺序
- 去重、截断到 limit（默认 5）

### 数值口径
- 值取《中国食物成分表》/USDA 近似，与菜单库同一套口径；肉/饭/面等熟食统一用熟值
- 菜单库现有 30 种的 kcalPer100g 原样迁入 FOOD_LIBRARY（数值一个不改），mealplan 改为引用，保证菜单显示/记录热量零变化

## 学习推导（diet.ts）

```ts
// 从历史 MealEntry 推导某食物名（库外）的估算 kcal/100g：
// 只采纳名称形如「<名> <克数>g」的记录（菜单写入/克数录入产生），按历史平均 kcal/g 反推
export function learnedKcal(meals: MealEntry[], name: string): number | null
```
- 用正则 `/^(.*?)\s*(\d+(?:\.\d+)?)g$/` 解析名称，基础名一致（trim）才采纳
- 样本 ≥1 即返回 round(平均 kcalPerGram*100)；无克数样本返回 null

## 交互（DietTab 录入区）

每餐一行，现状：`[食物名] [大卡] [＋]` + 最近食物胶囊。改为：

- 食物名输入 ≥1 字：下方浮出建议下拉（库内 searchFoods 最多 5 条，每条显示「鸡胸肉 · 165/100g」）；点击某条 = 选中
- 选中库内食物（或输入名精确等于某库内食物名）：右侧输入框切到「克数」模式（placeholder「克数」），输入克数时其下方/框内实时显示 `≈ 248 kcal`；点 ＋ 写入 `${name} ${grams}g` + kcalFor
- 库外食物（未选中、名字不匹配）：右侧框保持「大卡」，行为与现在完全一致
- 库外食物若 learnedKcal 有值：建议下拉末尾加一条「<名> · ≈<学到值>/100g（上次估算）」，选中后同库内克数流程，用学到的值计算
- 手动覆盖：库内食物在克数模式下，＋按钮始终用「克数算出的 kcal」；若用户清空食物名使其不再匹配，回退大卡模式
- 下拉键盘：↑↓ 移动高亮、Enter 选中（不触发添加）；无下拉时 Enter 仍为添加
- 最近食物胶囊保留：输入框为空时显示（现状），开始输入（有下拉）时隐藏让位

### 校验（沿用 canAdd）
- 克数模式：克数为有限数且 >0 才可加；克数 >2000 时仍可添加，但在建议行位置显示一句温和提示「克数偏大，确认单位是克？」（不阻断，兼容大份汤面/火锅）
- 大卡模式：沿用现有规则（round 后 >0、≤10000）
- 补记过去日同样生效（与 date 无关）

## 边界与错误处理

- 自动补全在小屏（375px）：下拉绝对定位浮于卡片内，宽度对齐食物名输入框，不引起整页跳动
- 选中库内食物后又修改名字不再匹配：自动退回大卡模式，已填克数忽略
- learnedKcal 反推值异常（>900 或 <5）：不展示为建议（数据明显脏时不误导）
- 菜单 30 种在 FOOD_LIBRARY 中必须全部可按名查到——单测断言，防止迁移漏项

## 测试方案

- `foods.ts` esbuild → node 单测：searchFoods（空串/前缀优先/alias/大小写/无匹配/limit）；kcalFor 取整；**菜单 30 种名全部能在 FOOD_LIBRARY 查到且 kcalPer100g 与 mealplan 引用值一致**
- `diet.ts` learnedKcal：克数记录反推、混合非克数记录、样本不足、异常值
- mealplan 既有单测全量重跑（数据源切换后数值必须不变）
- 浏览器预览（mobile 375）：输入「鸡胸」出建议→选→填 150→显 ≈248→＋→记录出现「鸡胸肉 150g」248；库外食物手填大卡不变；学习：先经菜单记录某食物，再手输同名看到「上次估算」
- 实现完成后多智能体对抗审查（子代理配额恢复后；当前受限时控制器做等价静态审查+预览）
