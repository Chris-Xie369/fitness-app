# 两周实测反馈优化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复统计周图误读、首页训练摘要化、tab 改名打卡、记录时间显示、启动默认饮食页、导航图标强化、运动消耗记录与摄入对比。

**Architecture:** 六个独立任务。Task 1 是 bug 复现与修复（TDD）；Task 2-4 是 UI 改动；Task 5 新增 activities 存储（types/storage/backup 三处白名单同步）+ 饮食页录入卡 + 统计对比。

**Tech Stack:** React 19 + TS strict + Tailwind 4；esbuild 转译 node 单测。

**Spec:** `docs/superpowers/specs/2026-09-29-two-week-feedback-design.md`

## Global Constraints

- 文案全部中文；暖纸 token（paper/ink/clay/muted/muted-weak/line/surface）；进度条 h-1.5；hero 数字 tabular-nums。
- 不加 npm 依赖；备份向前兼容（老备份无 activities/updatedAt 字段不报错）。
- 纯函数单测：`npx esbuild src/lib/x.ts --bundle --format=cjs "--outfile=$TEMP/x.cjs" --log-level=warning && node $TEMP/test-x.cjs`。
- 提交信息中文；每任务完成走 tsc + build + 浏览器验证。
- 模拟测试数据一律用**本地日期键**（`d.getFullYear()/getMonth()/getDate()`），不用 toISOString。

---

### Task 1: 统计周图「错位」复现与修复

**Files:**
- Modify: `src/lib/stats.ts`（weeklyTotals 标签）或仅 X 轴展示层 `src/tabs/StatsTab.tsx:185`
- Test: `$TEMP/test-weektotals.cjs`

**Interfaces:**
- Consumes: 现有 `weeklyTotals(workouts, n=8)` 返回 `WeekBucket[]`（label/days/sets）
- Produces: 若需改签名：`WeekBucket` 加 `monday: string` 字段

- [ ] **Step 1: 写复现测试** `$TEMP/test-weektotals.cjs`——模拟用户场景：今天是周二，9/21~9/27 各练一天（除周四）、9/28 也练：

```js
// 以 2026-09-29（周二）为 now
process.env.TZ = 'Asia/Shanghai'
const s = require(process.env.TEMP + '/stats.cjs')
const assert = require('node:assert')
const D = (m, d) => `2026-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
const mk = (date, sets) => ({ id: date, date, createdAt: 1, exercises: [{ id: 'e', name: '卧推', sets: Array.from({ length: sets }, () => ({ reps: 8 })) }] })
// 9/21-9/27 各 10 组（跳过 9/24），9/28 有 11 组
const workouts = [21,22,23,25,26,27].map(d => mk(D(9,d), 10)).concat([mk(D(9,28), 11)])
// weeklyTotals 用 new Date()——测试需要控制 now：weeklyTotals 第二参目前只是 n，不接受 now！
// 若无法注入 now，测试只能验证"结构含 8 桶、label 是周一"。真复现需要 weeklyTotals 接受 now。
console.log('NOTE: weeklyTotals(new Date()) 不可注入时间，计划第 3 步先给它加 now 参数')
const buckets = s.weeklyTotals(workouts)
assert.strictEqual(buckets.length, 8)
console.log(buckets.map(b => `${b.label}=${b.sets}`).join(' '))
EOF
```

- [ ] **Step 2: 跑，看输出**

```bash
cd "D:/Workspace/Claude Desktop/Code/App/fitness-app"
npx esbuild src/lib/stats.ts --bundle --format=cjs "--outfile=$TEMP/stats.cjs" --log-level=warning && node "$TEMP/test-weektotals.cjs"
```

预期：打印 8 桶 label/sets。判断：9/21 桶 = 60（6 天×10）、9/28 桶 = 11。若如此，则**归属正确、是标签误读**。

- [ ] **Step 3: weeklyTotals 接受可选 now 参数（可测性修复）**

`src/lib/stats.ts` weeklyTotals 签名改为 `weeklyTotals(workouts: Workout[], n = 8, now = new Date())`，内部 `mondayOf(new Date())` 改 `mondayOf(now)`。

测试改为：

```js
const buckets = s.weeklyTotals(workouts, 8, new Date(2026, 8, 29))
assert.strictEqual(buckets.length, 8)
const w921 = buckets.find(b => b.label === '9/21')
const w928 = buckets.find(b => b.label === '9/28')
assert.strictEqual(w921.sets, 60, '上周 6 天 × 10 组')
assert.strictEqual(w928.sets, 11, '本周一 11 组')
console.log('week totals tests passed')
```

- [ ] **Step 4: 确认归属正确后，改 X 轴标签表达"这是周聚合"**

`src/tabs/StatsTab.tsx` 周柱图卡标题 `近 8 周 · 每周组数` 保留，X 轴 tick 由 stats.ts 的 label 改为「{label} 周」。最小改法：stats.ts `mdLabel(start)` → `mdLabel(start) + '周'`？不行——mdLabel 也被其它处用。**只在 weeklyTotals 里改**：

```ts
// weeklyTotals 内（label 行）：
buckets.push({ label: `${mdLabel(start)}周`, days, sets })
```

测试断言同步改为 `b.label === '9/21周'`。

（若 Step 2 发现真的错位：停在任务内修 summarizeWeek/weeklyTotals 的周归属，不要只改标签。）

- [ ] **Step 5: 重跑测试全绿 + build + 提交**

```bash
node "$TEMP/test-weektotals.cjs" && npx tsc --noEmit && npm run build
git add src/lib/stats.ts src/tabs/StatsTab.tsx
git commit -m "统计周图：weeklyTotals 支持注入时间(可测)、X 轴标签标'周'消除周聚合误读"
```

---

### Task 2: 首页训练摘要化 + tab 改名「打卡」

**Files:**
- Modify: `src/tabs/TodayTab.tsx`（今日训练区）
- Modify: `src/App.tsx`（TabButton label）

**Interfaces:**
- Consumes: 现有 TodayTab props、lib/weekly.ts summarizeWeek（吨位数可复用 Σweight×reps）
- Produces: 无新导出

- [ ] **Step 1: 今日训练区改摘要**

`src/tabs/TodayTab.tsx` 把「今日训练」整段（`{todayWorkout && (...)}` 的 `<ul>` 列表）替换为：

```tsx
      {todayWorkout && (
        <p className="mt-5 text-center text-[13px] text-muted tabular-nums">
          今日已练 {todayWorkout.exercises.length} 个动作 ·{' '}
          {todayWorkout.exercises.reduce((n, ex) => n + ex.sets.length, 0)} 组 ·{' '}
          {Math.round(todayWorkout.exercises.reduce((n, ex) => n + ex.sets.reduce((a, s) => a + (s.weight ?? 0) * s.reps, 0), 0))} kg
          {' '}· <button onClick={onGoHistory} className="text-clay hover:underline">查看明细 ›</button>
        </p>
      )}
```

- [ ] **Step 2: tab 改名**

`src/App.tsx` 底部导航 `label="今天"` 改 `label="打卡"`；HistoryTab 返回按钮「‹ 返回」文案保留（其 onBack 回的是打卡页，无需改文案）。

- [ ] **Step 3: 验证 + 提交**

预览验证：有训练时首页只显示一行摘要（无逐条卡片）、点击「查看明细 ›」跳历史页、底部第一 tab 显示「打卡」。

```bash
npm run build && git add src/tabs/TodayTab.tsx src/App.tsx && git commit -m "首页训练区改一行摘要(动作数/组数/容量+查看明细入口)、底部tab今天改名打卡"
```

---

### Task 3: 历史页显示记录时间（updatedAt）

**Files:**
- Modify: `src/types.ts`（Workout 加 `updatedAt?: number`）
- Modify: `src/App.tsx`（addWorkout 同日追加时写 updatedAt）
- Modify: `src/storage.ts`（normalizeWorkouts 保留 updatedAt；isValidWorkout 白名单）
- Modify: `src/tabs/HistoryTab.tsx`（卡片头部显示）
- Test: `$TEMP/test-updatedat.cjs`

**Interfaces:**
- Produces: `Workout.updatedAt?: number`；normalizeWorkouts/isValidWorkout 向后兼容（无字段时回落 createdAt）

- [ ] **Step 1: 失败测试**（storage 侧）`$TEMP/test-updatedat.cjs`：

```js
const store = new Map()
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k,v)=>store.set(k,String(v)), removeItem: k=>store.delete(k) }
const s = require(process.env.TEMP + '/storage.cjs')
const assert = require('node:assert')
// 同日两条（追加场景）合并后 updatedAt 取最新、createdAt 取最早
const w = [
  { id:'b', date:'2026-09-29', createdAt:200, updatedAt:500, exercises:[{name:'深蹲',sets:[{reps:8}]}] },
  { id:'a', date:'2026-09-29', createdAt:100, exercises:[{name:'卧推',sets:[{reps:10,weight:60}]}] },
]
const merged = s.normalizeWorkouts(w)
assert.strictEqual(merged.length, 1)
assert.strictEqual(merged[0].createdAt, 100)
assert.strictEqual(merged[0].updatedAt, 500, 'normalizeWorkouts 应保留最新 updatedAt')
// 老数据无 updatedAt：不新增字段
const old = s.normalizeWorkouts([{ id:'x', date:'2026-09-28', createdAt:50, exercises:[{name:'卧推',sets:[{reps:8}]}] }])
assert.strictEqual(old[0].updatedAt, undefined)
console.log('updatedAt tests passed')
```

- [ ] **Step 2: 跑确认失败**（updatedAt 未透传 → 第一条断言失败）

```bash
npx esbuild src/storage.ts --bundle --format=cjs "--outfile=$TEMP/storage.cjs" --log-level=warning && node "$TEMP/test-updatedat.cjs"
```

- [ ] **Step 3: 实现**

`src/types.ts`：`updatedAt?: number // 同日追加时的最近保存时间` 加到 Workout。

`src/App.tsx` addWorkout 里 appended 分支的 map：

```ts
      ? workouts.map((x) => (x.date === w.date ? { ...x, exercises: [...x.exercises, ...w.exercises], note: x.note ?? w.note, updatedAt: Date.now() } : x))
```

新建分支的 withDuration 对象已有 createdAt，补 `updatedAt: Date.now()` 到新建 workout（`onSave({...})` 产生处是 RecordTab；**改 App.addWorkout 统一加**：`const stamped = { ...w, updatedAt: Date.now() }` 后用 stamped 参与 append/新建——注意 `workouts.map` 里 x 是被追加方，w 是新来的；新建时 workout 本体也要 updatedAt）。

`src/storage.ts` normalizeWorkouts：merged.push 的对象加 `updatedAt: ordered.map((w) => w.updatedAt).find((v) => typeof v === 'number') ?? undefined`——不对，应取**最新**值：`ordered` 是按 createdAt 升序，取最后一个有 updatedAt 的：`[...ordered].reverse().map(w=>w.updatedAt).find(v=>typeof v==='number')`；且无任一条带 updatedAt 时**不要写该字段**（保持老数据干净）。isValidWorkout 加：`(x.updatedAt === undefined || (isNum(x.updatedAt) && x.updatedAt > 0))`。

- [ ] **Step 4: 重跑测试全绿**

- [ ] **Step 5: 历史页显示**

`src/tabs/HistoryTab.tsx` 训练卡头部（`formatDate(w.date)` 那行 `<p className="font-display text-[15px] text-ink">` 的父 div），在其下方/同行的 muted 小字行追加：

```tsx
const fmtTime = (t: number) => { const d = new Date(t); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }
```
显示逻辑（加在日期行那组里）：
```tsx
<span className="ml-2 text-[11px] text-muted-weak">
  记录于 {fmtTime(w.createdAt)}{w.updatedAt && w.updatedAt > w.createdAt ? ` · 更新于 ${fmtTime(w.updatedAt)}` : ''}
</span>
```

- [ ] **Step 6: build + 预览（同日保存两次后历史卡显示「更新于」）+ 提交**

```bash
git add src/types.ts src/App.tsx src/storage.ts src/tabs/HistoryTab.tsx
git commit -m "训练记录时间：Workout 加 updatedAt(同日追加刷新)，历史卡显示记录于/更新于"
```

---

### Task 4: 启动默认饮食页 + 导航图标强化

**Files:**
- Modify: `src/App.tsx`（useState 初始值、TabButton 样式）
- Modify: `src/components/icons.tsx`（strokeWidth/size）

- [ ] **Step 1: 默认页**

`src/App.tsx:34`：`useState<Tab>('today')` → `useState<Tab>('diet')`。

- [ ] **Step 2: 图标加粗加大**

`src/components/icons.tsx`：`base` 改 `w-6 h-6`（22→24px），全部 strokeWidth 1.6→2.2（五处）。

- [ ] **Step 3: 选中态强化**

`src/App.tsx` TabButton 整体替换：

```tsx
function TabButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] transition ${active ? 'text-clay font-medium' : 'text-muted'}`}
    >
      <span className={`rounded-xl px-2.5 py-1 leading-none transition ${active ? 'bg-clay/12' : ''}`}>{icon}</span>
      {label}
    </button>
  )
}
```

（去掉原来的 4px 圆点行——气泡背景已足够表达选中。）

- [ ] **Step 4: 预览验证**（启动落在饮食页、选中 tab 有 clay 文字+浅色气泡、图标更粗）+ 提交

```bash
npm run build && git add src/App.tsx src/components/icons.tsx && git commit -m "启动默认打开饮食页、底部导航图标加粗24px、选中态改浅色气泡"
```

---

### Task 5: 运动消耗记录 + 摄入对比（TDD）

**Files:**
- Create: `src/lib/activity.ts`
- Modify: `src/types.ts`、`src/storage.ts`（load/save/isValid/parseBackup/exportBackup）
- Modify: `src/App.tsx`（activities state + addActivity/deleteActivity + DietTab props）
- Modify: `src/tabs/DietTab.tsx`（运动消耗卡 + 当日卡净热量行）
- Modify: `src/tabs/StatsTab.tsx`（周回顾加「运动消耗」格）
- Test: `$TEMP/test-activity.cjs`

**Interfaces:**
- Produces:
  - `ActivityKind = 'run' | 'walk' | 'brisk' | 'other'`；`ActivityEntry = { id, date, kind, minutes, kcal, createdAt }`
  - `ACTIVITY_METS: Record<'run'|'walk'|'brisk', number>` = `{ run: 8, walk: 3.5, brisk: 5 }`
  - `estimateKcal(kind: 'run'|'walk'|'brisk', minutes: number, weightKg: number): number`
  - `dayBurn(activities, date): number`（当日合计 kcal）
  - storage: `loadActivities/saveActivities/isValidActivity`；BackupData.activities

- [ ] **Step 1: 失败测试** `$TEMP/test-activity.cjs`：

```js
const store = new Map()
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k,v)=>store.set(k,String(v)), removeItem: k=>store.delete(k) }
const a = require(process.env.TEMP + '/activity.cjs')
const s = require(process.env.TEMP + '/storage.cjs')
const assert = require('node:assert')
// METs 估算：70kg 慢跑 30 分钟 = 70×8×0.5 = 280
assert.strictEqual(a.estimateKcal('run', 30, 70), 280)
assert.strictEqual(a.estimateKcal('walk', 60, 70), 245)
// dayBurn 汇总当日
const acts = [
  { id:'1', date:'2026-09-29', kind:'run', minutes:30, kcal:280, createdAt:1 },
  { id:'2', date:'2026-09-29', kind:'walk', minutes:60, kcal:245, createdAt:2 },
  { id:'3', date:'2026-09-28', kind:'run', minutes:20, kcal:180, createdAt:3 },
]
assert.strictEqual(a.dayBurn(acts, '2026-09-29'), 525)
assert.strictEqual(a.dayBurn(acts, '2026-09-30'), 0)
// 存储校验
assert.strictEqual(s.isValidActivity(acts[0]), true)
assert.strictEqual(s.isValidActivity({ ...acts[0], kind: 'fly' }), false)
assert.strictEqual(s.isValidActivity({ ...acts[0], minutes: 0 }), false)
assert.strictEqual(s.isValidActivity({ ...acts[0], minutes: 700 }), false)
// 备份往返含 activities；老备份无此字段不报错
const backup = s.exportBackup()
assert.ok(JSON.parse(backup).activities !== undefined)
console.log('activity tests passed')
```

- [ ] **Step 2: 跑确认失败**（模块/函数不存在）

- [ ] **Step 3: 实现 `src/lib/activity.ts`**：

```ts
import type { ActivityEntry, ActivityKind } from '../types'

// MET 代谢当量（参考 Compendium of Physical Activities 常用值）：慢跑 8、快走 5、步行 3.5
export const ACTIVITY_METS: Record<Exclude<ActivityKind, 'other'>, number> = { run: 8, walk: 3.5, brisk: 5 }

// 估算消耗热量 = 体重 × MET × 小时
export function estimateKcal(kind: Exclude<ActivityKind, 'other'>, minutes: number, weightKg: number): number {
  return Math.round(weightKg * ACTIVITY_METS[kind] * (minutes / 60))
}

export function dayBurn(activities: ActivityEntry[], date: string): number {
  return activities.reduce((n, a) => (a.date === date ? n + a.kcal : n), 0)
}
```

`src/types.ts` 加：

```ts
// 运动消耗（慢跑/步行等户外活动；健身房训练不计入——力量训练消耗估算误差太大）
export type ActivityKind = 'run' | 'walk' | 'brisk' | 'other'

export type ActivityEntry = {
  id: string
  date: string
  kind: ActivityKind
  minutes: number
  kcal: number
  createdAt: number
}
```

`src/storage.ts`（放在 water 相关函数旁，同款模式）：

```ts
const ACTIVITIES_KEY = 'fitness-app:activities'
const ACTIVITY_KINDS = ['run', 'walk', 'brisk', 'other']

export function isValidActivity(a: unknown): a is ActivityEntry {
  if (!a || typeof a !== 'object') return false
  const x = a as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    isValidDate(x.date) &&
    ACTIVITY_KINDS.includes(x.kind as string) &&
    isNum(x.minutes) && x.minutes >= 1 && x.minutes <= 600 &&
    isNum(x.kcal) && x.kcal > 0 && x.kcal <= 5000 &&
    isNum(x.createdAt)
  )
}

export function loadActivities(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(ACTIVITIES_KEY)
    if (!raw) return []
    const data: unknown = JSON.parse(raw)
    return Array.isArray(data) ? data.filter(isValidActivity) : []
  } catch {
    return []
  }
}

export function saveActivities(activities: ActivityEntry[]): void {
  try {
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities))
  } catch {
    /* 静默失败 */
  }
}
```

- `BackupData` 加 `activities?: ActivityEntry[]`；exportBackup 加 `activities: loadActivities()`；parseBackup：`const activities = (pick('activities', (x) => isValidActivity(x)) as unknown as ActivityEntry[]).map((a) => ({ ...a, id: restoreId() }))` 并在返回值带上；全空判断数组加 `activities.length === 0`。
- isValidDate/isNum 是文件内已有私有函数，直接可用。

`src/App.tsx`：

```ts
  const [activities, setActivities] = useState<ActivityEntry[]>(() => loadActivities())
  useEffect(() => saveActivities(activities), [activities])
  function addActivity(a: ActivityEntry) {
    setActivities((prev) => [a, ...prev])
  }
  function deleteActivity(id: string) {
    setActivities((prev) => prev.filter((x) => x.id !== id))
  }
```

DietTab 调用加 props：`activities={activities} onAddActivity={addActivity} onDeleteActivity={deleteActivity}`。

- [ ] **Step 4: 重跑测试全绿 + tsc**

- [ ] **Step 5: 饮食页 UI**

DietTab props 类型加：`activities: ActivityEntry[]`、`onAddActivity: (a: ActivityEntry) => void`、`onDeleteActivity: (id: string) => void`。

组件内派生：`const burn = dayBurn(activities, date)`。

当日热量卡（targetInfo 分支）进度条下方、advice 之前加一行：

```tsx
          <p className="mt-2 text-[12px] text-muted tabular-nums">
            已吃 {total} kcal{burn > 0 ? ` · 运动消耗 ${burn} kcal · ${total - burn > 0 ? `净摄入 ${total - burn} kcal` : `缺口 ${burn - total} kcal`}` : ''}
          </p>
```

「运动消耗」卡放在喝水卡之后（同一视图），完整 JSX：

```tsx
      {/* 运动消耗：户外慢跑/步行等（健身房力量训练不计——估算误差太大） */}
      <div className="mt-3 rounded-2xl bg-surface border border-line p-4">
        <p className="text-[15px] text-ink">🏃 运动消耗</p>
        {(() => {
          const dayActs = activities.filter((a) => a.date === date)
          return dayActs.length > 0 && (
            <ul className="mt-2 space-y-1">
              {dayActs.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-[14px]">
                  <span className="text-ink">{{ run: '慢跑', walk: '步行', brisk: '快走', other: '其他' }[a.kind as ActivityKind]} {a.minutes} 分钟</span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted">{a.kcal} kcal</span>
                    <button onClick={() => onDeleteActivity(a.id)} aria-label="删除这条运动记录" className="-m-3 p-3 leading-none text-muted/50 hover:text-clay text-sm">✕</button>
                  </span>
                </li>
              ))}
            </ul>
          )
        })()}
        <div className="mt-2 flex items-center gap-2">
          {/* 类型胶囊：点选切换 */}
          {([['run', '慢跑'], ['walk', '步行'], ['brisk', '快走'], ['other', '其他']] as [ActivityKind, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setActKind(k)} className={`px-2.5 py-1 rounded-full border text-[12px] transition ${actKind === k ? 'bg-clay text-white border-clay' : 'border-line text-muted hover:text-clay'}`}>{l}</button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={actMinutes}
            onChange={(e) => setActMinutes(e.target.value)}
            inputMode="numeric"
            placeholder="分钟"
            className="w-20 px-3 py-2 rounded-xl border border-line bg-paper text-base text-ink placeholder:text-muted-weak focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
          />
          <input
            value={actKcal}
            onChange={(e) => setActKcal(e.target.value)}
            inputMode="numeric"
            placeholder={actKind === 'other' ? 'kcal' : `≈${actKind && actMinutes && latestWeight ? estimateKcal(actKind, Number(actMinutes), latestWeight) : '—'} kcal`}
            className="w-20 px-3 py-2 rounded-xl border border-line bg-paper text-base text-ink placeholder:text-muted-weak focus:outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
          />
          <button
            onClick={() => {
              const m = Number(actMinutes)
              if (!Number.isFinite(m) || m < 1 || m > 600) return
              const est = actKind !== 'other' && latestWeight ? estimateKcal(actKind, m, latestWeight) : 0
              const k = actKcal ? Math.round(Number(actKcal)) : est
              if (!Number.isFinite(k) || k <= 0 || k > 5000) return
              onAddActivity({ id: uid(), date, kind: actKind, minutes: m, kcal: k, createdAt: Date.now() })
              setActMinutes('')
              setActKcal('')
            }}
            disabled={!actMinutes}
            className="shrink-0 w-9 h-9 rounded-xl bg-clay text-white text-[18px] leading-none disabled:bg-line disabled:text-muted-weak hover:bg-clay/90 active:scale-95 transition"
          >
            ＋
          </button>
        </div>
        {!latestWeight && actKind !== 'other' && <p className="mt-1 text-[10px] text-muted-weak">填体重后可按体重自动估算热量（身体页）</p>}
        <p className="mt-1 text-[10px] text-muted-weak">慢跑≈8 MET · 快走≈5 MET · 步行≈3.5 MET；健身房力量训练不计入此处</p>
      </div>
```

组件内 state 加：`const [actKind, setActKind] = useState<ActivityKind>('run')`、`const [actMinutes, setActMinutes] = useState('')`、`const [actKcal, setActKcal] = useState('')`；goTo/stepDate 里重置三个。

import 加：`import { dayBurn, estimateKcal } from '../lib/activity'` 与 `import type { ActivityEntry, ActivityKind } from '../types'`（合并进既有 types import 行）。

- [ ] **Step 6: 统计页周回顾加「运动消耗」格**

`src/App.tsx` StatsTab 调用加 `activities={activities}`；StatsTab props 加 `activities: ActivityEntry[]`。

周回顾指标网格（grid-cols-5）第 6 格加在日均热量后——5 列变 6 列会挤压，改为**把「训练时长」与「运动消耗」合并思路不行**；直接做法：网格改 `grid-cols-3` 两行的结构已经有洞问题……**改为 grid-cols-3 + 第 6 格**，两行三列整齐：

WeekCell 调用处 grid 类 `grid-cols-5` 改 `grid-cols-3`，追加：

```tsx
          <WeekCell
            label="运动消耗"
            cur={burnThis > 0 ? burnThis : null}
            prev={burnLast}
            hasPrev={burnLast > 0}
            unit="kcal"
            neutral
          />
```

派生（StatsTab 内，report 计算附近）：

```ts
  // 本周/上周运动消耗合计（与周回顾同区间口径：截至今天 vs 上周同星期区间）
  const burnThis = activities.filter((a) => thisWeekDates.has(a.date)).reduce((n, a) => n + a.kcal, 0)
  const burnLast = activities.filter((a) => lastWeekDates.has(a.date)).reduce((n, a) => n + a.kcal, 0)
```

而 thisWeekDates/lastWeekDates 从 weeklyReport 的区间推不出（summarizeWeek 内部构造）——**改从 mondayOf 直接算**（StatsTab 顶部 import mondayOf from '../lib/stats' 已有 overview 等同源 import）：

```ts
  const monday = mondayOf(new Date())
  const inWeek = (date: string, mondayOffset: number): boolean => {
    const [y, m, d] = date.split('-').map(Number)
    const t = new Date(y, m - 1, d).getTime()
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + mondayOffset).getTime()
    const end = start + 7 * 86400000
    return t >= start && t < end
  }
  const burnThis = activities.filter((a) => inWeek(a.date, 0)).reduce((n, a) => n + a.kcal, 0)
  const burnLast = activities.filter((a) => inWeek(a.date, -7)).reduce((n, a) => n + a.kcal, 0)
```

- [ ] **Step 7: 构建 + 浏览器验证 + 提交**

预览：饮食页加「慢跑 30 分钟」→ 显示 ≈280kcal（注入体重 70）→ 当日卡出现「净摄入」行；统计页周回顾出现「运动消耗」格。

```bash
npm run build && git add -A && git commit -m "运动消耗记录(慢跑/步行/快走METs估算+手动)+饮食页净摄入对比+统计周回顾运动消耗格"
```

---

### Task 6: 独立审查 + 推送

- [ ] **Step 1: 对 Task 1-5 全部 diff 派独立审查者**（重点：normalizeWorkouts/updatedAt 透传、activities 备份往返、DietTab 新卡与既有交互、周图标签改动范围）
- [ ] **Step 2: 修复确认问题，重跑全部 node 单测 + build**
- [ ] **Step 3: 推送（直连命令），验证 CF bundle 哈希与本地构建一致**
- [ ] **Step 4: 更新项目记忆**

---

## Self-Review 记录

- **Spec 覆盖**：8 个子项全部有任务（1→T1、2.1/2.2→T2、2.3→T3、4.1/4.2→T4、3.1/3.2→T5）；3.2 已定不做
- **类型一致**：ActivityEntry/ActivityKind 在 T5 各步签名一致；updatedAt 可选字段三处（types/App/storage）一致
- **风险**：T1 若复现发现真错位则停在任务内修周归属（已在步骤注明）；T5 网格 5→3 列是两周前刚为消洞改的，本次 6 格改回 3×2 无洞
- **已知取舍**：力量训练不计入消耗（注释与提示文案均写明）；other 类型必须手填 kcal
