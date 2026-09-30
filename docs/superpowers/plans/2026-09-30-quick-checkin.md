# 一键打卡 实施计划（2026-09-30）

设计文档：`docs/superpowers/specs/2026-09-30-quick-checkin-design.md`

## 任务分解（顺序执行，全部小步直达）

### 任务 1：App.tsx — 接线与隐患修复
- 新增 `checkInToday()`：复用 `addWorkout` 创建 `{ id: uid(), date: todayStr(), createdAt: Date.now(), exercises: [] }`
- `removeExercise` 过滤改为 `.filter((w) => w.id !== workoutId || w.exercises.length > 0)`（只删刚被删空的目标，保住其他纯打卡记录）
- TodayTab 传新 prop `onCheckIn={checkInToday}`
- 验证：`npm run build`

### 任务 2：TodayTab.tsx — 双按钮与纯打卡摘要
- props 增加 `onCheckIn: () => void`
- 未打卡：主按钮「一键打卡」（clay 实心，样式沿用现有主 CTA class）+ 次按钮「记录今天的训练」（描边，样式沿用现「查看全部历史」的描边 class）
- 已打卡：仅显示「再记一次」（clay，现有样式）
- 摘要行：纯打卡日（exercises.length===0）显示「今天已打卡 · 明细未记录 · 补记 ›」（补记=onGoRecord）；有明细维持现状
- 验证：`npm run build` + 预览实测打卡→环+1→toast→再记一次

### 任务 3：HistoryTab.tsx — 纯打卡展示
- 列表摘要行：`w.exercises.length === 0` 时显示「纯打卡 · 记录于 {fmtTime}」（不显示 0 动作 0 组，无 updatedAt 分支）
- 详情卡：`exercises.length === 0` 时卡体显示「这一天只打了卡，没有动作明细」+ 备注（若有）；删除按钮保留
- 验证：预览实测历史页纯打卡文案 + 删除整天

### 任务 4：回归与测试
- `npm test` 现有用例全过（无新增 lib 纯函数，按 CLAUDE.md 无需新单测）
- 预览实测清单：一键打卡（环+1、toast）→ 再记一次补明细同日合并 → 历史纯打卡文案 → 删除整天 → 有明细日删动作不误伤纯打卡记录
- `resize desktop` 复位视口

### 任务 5：独立审查 → 提交上线
- 独立审查（pre-push 规矩），确认项：空 exercises 对庆祝管线/统计/备份的影响、removeExercise 修复正确性、文案规范（今天/当天、kcal 不涉及、打卡语义）、暖纸 token
- 修复确认项 → `npm run build` → 提交（中文 message）→ push → CF bundle hash 验证

## 风险点

- `newlyEarned` 在首次记录时弹「首次训练」庆祝——纯打卡作为首条记录也会弹，语义可接受
- `weekGoalJustReached` 以日期集合判断，纯打卡自然计入（设计口径）
