# 两周实测反馈优化 设计

日期：2026-09-29
状态：需求已逐条确认，方向已拍板

## 需求汇总与已定决策

| # | 需求 | 决策 |
|---|---|---|
| 1 | 统计页"近 8 周组数"疑似错位 | 先复现：大概率是 X 轴只标周一引发的误读（柱子=周聚合），复现确认后改标签为「9/21 周」式标注；若真错位则修 |
| 2.1 | 首页逐条动作列表破坏简洁 | 极简文字摘要：「今日已练 X 个动作 · Y 组 · Z kg」，不再逐条列卡片 |
| 2.2 | tab「今天」改名 | 「打卡」（全 App"打卡"已特指训练打卡，语义一致） |
| 2.3 | 训练记录显示添加时间 | 历史页训练卡显示「记录于 HH:mm」；同日多次追加显示「更新于 HH:mm」。Workout 加可选 updatedAt（备份兼容：缺省回落 createdAt） |
| 3.1 | 摄入 vs 消耗对比 | 新增运动消耗记录（PWA 手动+METs 估算）：慢跑/步行/快走/其他 + 分钟 → 按体重估算 kcal；饮食页当日卡显示「已吃 X · 消耗 Y · 净 Z」 |
| 3.2 | 接入苹果健身 App | **不做**：PWA 硬边界（无法读 Apple Health），转原生是架构级变更，用户已选 A 坚持 PWA |
| 4.1 | 启动默认页 | 现有顺序不变，默认打开第 3 个 tab「饮食」 |
| 4.2 | 底部图标太小、选中不明显 | strokeWidth 1.6→2.2、图标 22→24px；选中态：clay 色 + 图标背后纸色圆角气泡 + 文字加粗；去掉 4px 圆点 |

## 范围控制
- 不做：Apple Health、自动训练计划、深色模式、月度视图（本轮）
- activities 进备份（BackupData.activities），load/parse 白名单同步

## 新数据模型

```ts
// types.ts
export type ActivityKind = 'run' | 'walk' | 'brisk' | 'other'
export type ActivityEntry = {
  id: string
  date: string
  kind: ActivityKind
  minutes: number
  kcal: number // 估算或手动
  createdAt: number
}
```

- 新 lib/activity.ts：`ACTIVITY_METS = { run: 8, walk: 3.5, brisk: 5 }`（other 无估算，纯手填）；`estimateKcal(kind, minutes, weightKg)` = round(weight × MET × minutes/60)
- 存储 key `fitness-app:activities`，isValidActivity 校验（kind 白名单、minutes 1-600、kcal 0-5000）

## UI 落点
- 饮食页：热量卡下方加「运动消耗」卡：类型胶囊 + 分钟输入 → 显示估算 kcal（可手改）→ 保存；今日已记活动列表（可删）
- 饮食页当日热量卡：已吃 X · 消耗 Y · 净 Z（net = eaten - burned，负值显示为「缺口 N」绿/正常色）
- 统计页周回顾指标网格加「运动消耗」（本周合计 kcal，vs 上周）
