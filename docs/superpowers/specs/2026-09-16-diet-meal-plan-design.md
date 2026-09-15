# 饮食计划（DietTab「记录 | 计划」视图切换）设计

日期：2026-09-16
状态：已获用户批准

## 背景与目标

DietTab 目前只有记录功能（三餐热量、喝水、快捷录入、复制前一天）与每日热量目标卡（nutrition.ts：Mifflin BMR × PAL × 目标速度 + 训练日 +200）。缺少"该吃什么"的指导。

本功能参考用户认可的 Fitness Dashboard Artifact 样式：🎯 每日营养目标卡（热量+蛋白质/碳水/脂肪范围）+ 每餐具体中式菜单（食物+克数+做法提示）。

### 已确认的产品决策

1. **动态计算**：复用 nutrition.ts 热量目标；新增宏量营养素公式；菜单克数随当日目标热量缩放。体重/目标变化，计划跟着变。
2. **营养素只显示目标，不追踪**：MealEntry 结构不变（仍只有 name/kcal），避免录入负担大改。
3. **一键记录**：每餐菜单可一键批量写入当天饮食记录（逐条 MealEntry，单条可删、进备份）。
4. **每餐 2-3 套备选**：可"换一套"轮换，选择本地持久化。
5. **训练日差异**：克数缩放 + 加餐自动换「练后蛋白」主题模板。
6. **方案 A**：DietTab 顶部「记录 | 计划」视图切换（复用 HistoryTab view 切换模式），记录视图原样保留。

## 架构与文件

- 新增 `src/lib/mealplan.ts`：纯函数 + 菜单数据，无 React 依赖，可 esbuild 转译后 node 单测
- 新增 `src/components/MealPlanView.tsx`：计划视图 UI
- 改 `src/tabs/DietTab.tsx`：顶部加 `view: 'log' | 'plan'` 分段切换
- 改 `src/types.ts` / `src/lib/goals.ts` / `src/storage.ts` / `src/lib/backup.ts`：AppSettings 增加 `mealChoice` 字段，同步 loadSettings 与 parseBackup 白名单

## 数据模型

```ts
type MenuItem = { name: string; baseGrams: number; kcalPer100g: number; hint?: string }
type MealMenu = { id: string; theme: string; items: MenuItem[] }
// MENU_LIBRARY：早/午/晚各 3 套中式模板；加餐 2 套「练后蛋白」（训练日）+ 2 套日常
// 全部以 2000 kcal 为基准热量定义基准克数
```

### 营养目标公式 `macroTargets(weightKg, goal, dayTargetKcal)`

- 蛋白质系数：减脂 2.0 / 维持 1.6 / 增肌 1.8 g/kg，显示 ±10% 范围（如 120-145g）
- 脂肪：日热量 × 25% ÷ 9（g）
- 碳水：剩余热量 ÷ 4（g）
- 饮水量：复用现有 `settings.waterGoal` 显示

### 克数缩放 `scaleMenu(menu, dayTargetKcal)`

- `scale = dayTarget / 2000`，clamp [0.6, 1.4]
- 克数按 5g 步进取整；热量用取整后克数重算（保证显示与一键记录写入一致）
- 餐卡右上角显示合计 `~450 大卡`

## 数据流与交互

- **日期联动**：计划跟随 DietTab 已有日期切换条；`isTrainingDay` = 该日有无训练记录，决定 +200 与加餐模板
- **换一套**：每餐独立轮换，选中序号存 `settings.mealChoice[mealType]`，刷新/换日保留
- **按菜单记录**：每个食物按 名称+取整克数+重算热量 逐条写入 MealEntry；toast「已记录早餐 5 项 · 约 450 kcal」；重复按重复记录（与现有追加语义一致，toast 不阻止）
- **目标卡纯展示**：不读实际记录、不做达成条

## 边界与错误处理

- 缺体重：目标卡只显示热量目标 + 「去身体页补全体重后生成完整营养目标」引导；菜单仍可用
- 未设置饮食目标（新用户）：复用现有目标设置引导
- 热量目标触发安全下限 / scale 被 clamp：公式内聚在纯函数内，单测覆盖，UI 不特殊处理

## 测试方案（沿用项目质量流程）

- `mealplan.ts` esbuild 转译到 Temp，node 单测（跨 Asia/Shanghai / UTC / America/New_York）：
  - macroTargets：三种目标 × 不同体重
  - scaleMenu：热量守恒（Σ ≈ 目标 ±5%）、5g 取整、clamp 边界
  - 训练日加餐换模板、换一套循环回绕
- 实现完成后多智能体对抗审查（finders 3 维度 + 逐条 verify）
- 浏览器预览验证：mobile 375、视图切换、一键记录后切回记录视图核对条目与热量
