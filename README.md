# 健身打卡（fitness-app）

个人自用的健身打卡 PWA：训练打卡（支持一键打卡/明细补记）、体重与围度、饮食记录与计划、运动消耗、每周回顾，全部数据只存本机，无后端、无账号。

**线上地址**：https://fitness-app-a6t.pages.dev （Cloudflare Pages，push main 自动构建部署；Netlify 镜像已锁定不更新）

## 功能

- **打卡**：一键打卡（点一下记为当天已练，明细可稍后补）或完整记录动作+组数；同日追加自动合并；休息计时器、组完成勾选、1RM 实时估算
- **记录**：训练历史（列表/月历）、按动作修改组数、备注编辑、单动作/整天删除
- **饮食**：81 种中式食物库 + 克数自动算热量、宏量营养素、每餐菜单计划（按身体数据生成）、饮水、运动消耗（METs 估算）、净摄入/缺口
- **身体**：体重/体脂/腰围/围度（按类型校验合法范围）、BMI/脂肪量/瘦体重/基础代谢派生、7 日移动平均、近 4 周趋势速度、进度照片（IndexedDB）
- **统计**：本周回顾（训练天数/时长/组数/训练容量 vs 上周）、近 8 周柱图、打卡热力、动作榜与 PR 曲线、成就徽章
- **数据安全**：全量 JSON 备份导出/导入（含照片）、导入前自动留底快照、存储损坏自动救援副本、写入失败明确提示可重试

## 数据存储

| 数据 | 位置 | 说明 |
|---|---|---|
| 训练/饮食/身体/设置等结构化数据 | 浏览器 `localStorage`（key 前缀 `fitness-app:`） | 换浏览器/换设备不互通，靠备份迁移 |
| 进度照片 | IndexedDB `fitness-photos` | 不进 JSON 快照，但随备份文件导出 |
| 损坏留底 | `<原key>.rescue` | 数据损坏时自动生成，可人工找回原始内容 |
| 导入前快照 | `fitness-app:preImportBackup` | 选定备份文件时自动写入，误导入可找回 |

## 备份与恢复

1. **导出**：「打卡 → 查看全部历史 → 数据管理 → 导出备份」，保存生成的 JSON 文件（含照片）
2. **恢复**：同区「导入恢复」选择备份文件 → 确认面板显示替换范围 → 确认导入
3. 误导入：用导入前自动留底（preImportBackup）或上次导出的备份文件再导入一次即可
4. 换手机/换域名（如从旧镜像迁到 pages.dev）：旧设备导出 → 新设备导入 → 重新添加主屏幕

## 开发与验证

```bash
npm install
npm run dev      # 本地开发（launch.json autoPort）
npm test         # 纯函数单测（esbuild 转译到临时目录跑 node）
npm run build    # tsc -b && vite build —— 唯一可信的类型检查入口
```

- 技术栈：React 19 + TypeScript strict + Tailwind 4 + Vite 8 + Recharts，PWA（vite-plugin-pwa，autoUpdate）
- 部署：push main → Cloudflare Pages 自动构建；验证线上 = 本地 build 产物 hash 与线上 bundle hash 一致
- 项目规范见 `CLAUDE.md`（视觉 token、文案规则、数据字段三处同步、日期分量推算等）
