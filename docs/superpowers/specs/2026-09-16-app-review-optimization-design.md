# 应用审查优化（五批）设计

日期：2026-09-16
状态：已获用户批准
依据：三审查者（UI/功能/产品技术）综合报告，从用户一天使用动线组织。

## 批次 1：安全与正确性

1. **loadWorkouts 逐条校验+救援副本**（storage.ts）：解析后先 `Array.isArray` + `isValidWorkout`（已存在）过滤；解析失败时把原始字符串另存 `fitness-app:workouts.rescue`（单个 key，多次失败覆盖最新一份），返回 `[]`。App 加载失败时不得自动覆盖——loadWorkouts 内部 rescue 已保证坏数据不覆盖好数据。
2. **导入快照**（App.tsx/HistoryTab.tsx）：confirmImport 前把当前数据导出写入 localStorage `fitness-app:preImportBackup`（仅数据 JSON 字符串，不含照片）；确认面板文案显示「本机现有 X 天记录 → 将变为备份中的 Y 天」（X/Y 由 workouts 日期跨度估算，简单用条数+首末日期即可：「本机 N 条训练 / M 条饮食」更直白，用条数）。
3. **备份版本前向兼容**（parseBackup）：顶层 `app !== 'fitness-app'` 拒绝；`version > 1` 返回警告字段（parseBackup 返回结构不动，用 console.warn + 在导入确认面板显示一句「此备份来自更新版本，部分数据可能无法导入」——用 try 解析后检查并把警告字符串透传成本地常量即可；最小实现：导出 `backupWarning(text): string | null` 给 UI 调用）。
4. **删死代码**：progress.ts workoutTonnage、goals.ts elapsedWeekdays（全仓库无引用，删除前 grep 确认）。
5. **tsconfig strict**：tsconfig.app.json 加 `"strict": true`（已实测零报错），不加 noUncheckedIndexedAccess。

## 批次 2：iOS/视觉基座

6. **iOS meta**（index.html）：`lang="zh-CN"`、`<title>健身打卡</title>`、`viewport-fit=cover`、theme-color #F1ECE0、apple-mobile-web-app-capable/status-bar-style/apple-mobile-web-app-title「健身打卡」；index.css body 背景 var(--color-paper)。
7. **安全区**：App.tsx 外层容器加 `pt-[env(safe-area-inset-top)]`、底部导航加 `pb-[env(safe-area-inset-bottom)]`（配合现有 px/py，用 padding 追加而非替换）。
8. **输入框 16px**：所有 input/textarea 的 text-[13px]/text-[14px] 在输入场景统一 text-base（聚焦不再放大）；记录行只读文字不动。
9. **对比度**：index.css `--color-muted: #6F6659`；新增 `--color-muted-weak: #7C7366`；全 App 替换文字用的 text-muted/60 /70 /80：正文辅助一律不再叠透明度（muted 新值已达 4.5:1），最弱说明文字用 muted-weak。clay 不动（白字 on clay 已达标）。line 色不用于文字，不动。
10. **触控热区**：记录勾选 ✓（h-6→视觉 h-7 + -m-2.5 p-2.5 热区约 44px）、喝水 ±、周目标 ±、日期/月份 ‹›、休息 ±15s、删照片——统一负 margin 扩热区，视觉尺寸尽量不变（周目标 w-5 h-5 这种视觉也过小的，提到 h-7 w-7）。
11. **底部导航**：历史页激活态 `active={tab==='today' || tab==='history'}`；5 个 emoji 换内联 SVG（1.5px stroke，24px，active=clay/inactive=muted），新建 components/icons.tsx 导出五个图标组件。
12. **空态引导**：身体页无记录时加「记录第一笔体重后，这里会出现趋势曲线和 BMI/代谢数据」；饮食页无任何 meal 记录时早餐卡上加「输入食物名 → 选建议 → 填克数，自动算热量」；历史空态文案变可点按钮跳记录页。

## 批次 3：记录页体验

13. **渐进超负荷建议**（新纯函数 lib/progression.ts）：
    - `nextSuggestion(prevSets: {reps,weight}[], bodyweightLast?: number): {label, apply:{reps,weight}[]} | null`
    - 规则（新手线性进步，单位 kg，体重类动作例外）：全部组都完成且最低 reps ≥ 10 → 建议重量 +2.5（体重类动作：+1 次）；最低 reps 5-9 → 建议每组 +1 次、重量不变；<5 → null。动作是否体重类暂不细分（无器械信息），简单规则：weight=0 的组按次数进步，其余按上述。
    - RecordTab "上次"行旁出现「可试 X」胶囊按钮，点击把建议填入所有组的 reps/weight 输入框。
    - node 单测覆盖三档分支。
14. **常见动作库**：lib/exercises.ts 增加 COMMON_EXERCISES: {name, tip?}[] 约 30 个（胸/背/腿/肩/臂/核心常见自由重量+固定器械），RecordTab 无历史动作时胶囊区显示常见动作（点选填入名字）。
15. **历史编辑补全**（HistoryTab）：动作行加可见「改」字按钮（现在整行可点无提示）；编辑态加「+ 加一组」和每组 ✕；删除误导文案"想删整组请用列表右侧的 ✕"（改为"编辑中可直接删组"）。
16. **备注可改**：当天历史卡备注显示处可点进入编辑（复用编辑态，加 note textarea，保存到 workout.note）。
17. **术语小注**：RecordTab 1RM 首次出现处加 title/小字「1RM：最多只能举起 1 次的重量，用来衡量进步」；StatsTab 进步曲线标题旁同款；DietTab 宏量行首次出现加「P=蛋白 C=碳水 F=脂肪」小字（计划页宏量卡下也加）。
18. **休息计时**：useRestTimer 运行中请求 Screen Wake Lock（visibilitychange 重新请求，结束释放，失败静默）；结束时保留「休息结束 ✓」3 秒再切回预设（替代直接消失）。

## 批次 4：饮食反馈

19. **按菜单记录防重复**：MealPlanView 的已记状态从数据推导——`loggedCount(meals, date, menu)`：当天该餐中包含菜单全部条目名称前缀（`${item.name} ` 开头或相等）的记录批数。简化判定：按 createdAt 聚集（同毫秒批次，logMenu 本来就同毫秒写入）→ 显示「今日已记录 N 次」；按钮不再禁用、文案「再记一次」；loggedKeys/4 秒状态机删除（数据推导替代）。
20. **计划页已吃/还剩**：MealPlanView 目标卡加一行「今天已吃 X · 还能吃 Y kcal」（props 传入 eaten/target，DietTab 用 dayKcal 计算）。
21. **宏量进度条**：记录视图当日合计行改为三格横条（蛋白/碳水/脂肪：当前值 + 范围 + clay 进度条，超出范围变 ink 满格）；无 targetInfo 时仅数字。
22. **未计入提示**：宏量区显示「N 条记录无营养数据，未计入」（N = 当天 macrosOf 返回 null 的 meal 条数）。

## 批次 5：统计/身体

23. **统计页首屏**：本周回顾卡移到第一；三格概览删「本周训练」（与回顾重复）保留累计打卡/累计完成；周回顾卡拆两张（目标环+洞察 / 五指标网格 2 列排版避免 62px 五列挤压）。
24. **训练量洞察句**：weekly.ts 或 stats 派生加近 8 周组数趋势句（连续上升/低于近 4 周均值 20%），放柱图上方。
25. **体重速度校验**：BodyTab 趋势卡加「近 4 周 ±Xkg（≈Ykg/周，目标 Z）」（首末体重差/周数，goal=lose/gain 时才显示对比）。
26. **饮食成就**：achievements.ts 加 1 个「饮食记录 7 天」（近 7 天都有 meal 记录即解锁）；庆祝弹层接入 addMeal 后的检查（App.tsx）。

## 全局约束

- 暖纸 token 不变；中文文案；无新依赖（vitest 不在本批，测试继续 esbuild+node）；不改 MealEntry/Workout 结构；新 localStorage key 仅 rescue/preImportBackup 两个且不进备份。
- 每批：TDD（纯函数）→ tsc/build → 浏览器验证 → 审查 → 提交推送。
- 已明确不做：自动训练计划、餐别热量分配、深色模式、月度视图、Web Push、云同步、食物库扩张。
