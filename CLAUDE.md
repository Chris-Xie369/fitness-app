# fitness-app 项目规范

个人自用的健身打卡 PWA（React 19 + TS strict + Tailwind 4，Vite 8，纯 localStorage/IndexedDB，无后端）。

## 构建与验证

- **唯一可信的类型检查入口是 `npm run build`（tsc -b && vite build）**。根目录 `tsc --noEmit` 是空跑（根 tsconfig 为 solution-style，files: []），不要用它判断类型是否通过。
- 纯函数单测：`scripts/tests/*.test.cjs`，跑 `npm test`。新增 lib 纯函数必须带同名测试并入库；不要只在本机 Temp 写一次性脚本。
- 浏览器预览用 launch.json 的 `fitness-app` 配置（autoPort）。验证后必须 `resize desktop` 复位视口。
- 部署：push main → Cloudflare Pages 自动构建。验证线上 = 本地 `npm run build` 产物 hash 与 `https://fitness-app-a6t.pages.dev` 引用的 bundle hash 一致。Netlify 已锁不动。

## 视觉（暖纸美学，不可破坏）

- 颜色只用 token：`paper / surface / ink / muted / muted-weak / line / clay`（index.css @theme）。禁止手写近似 hex、禁止渐变重阴影。
- 卡：`rounded-2xl bg-surface border border-line p-4`；主 CTA：`rounded-xl bg-clay text-white`；卡内小操作：描边胶囊（虚线=可填充内容，实线=可执行操作）。
- 进度条统一 `h-1.5 rounded-full bg-line`；填充语义：clay=正常/达标、ink/40=超出。
- hero 数字必须 `tabular-nums`；56px 只留给连续天数 streak，其余 hero 封顶 40px。
- 标题：卡内小标题统一 `font-display italic text-muted`；页面大标题 `font-display`。
- 底部导航图标统一 SVG（icons.tsx，26px 视觉尺寸、2.4px 描边），禁止引入 emoji 图标；正文 emoji 只允许成就/庆祝场景。

## 文案

- 全中文；时间词统一「今天/当天」（禁「今日/当日」）；单位统一 `kcal`（禁「大卡」混用）。
- CTA 主动、带宾语（保存资料/保存模板/保存备注），动作名全流程一致；空态和错误给方向，不道歉。
- 「打卡」专指训练打卡；饮水/饮食叫「记录」「登记」，不叫打卡。

## 数据

- 任何新存储字段必须同步三处：`types.ts`、`storage.ts` 的 load 校验、`storage.ts` 的 parseBackup（含 exportBackup），否则备份往返丢数据（历史教训）。导入前自动快照 `preImportBackup`。
- 日期一律本地日期分量推算，禁止 `7*86400000` 毫秒换算（DST）。周一起算。
- 克数记录形态固定为「名称 NNg」（lib/diet.ts 的 GRAM_SUFFIX 依赖），改格式必须同步 learnedKcal/macrosOf/menuLoggedCount。

## 代码

- 严格 TS（strict:true）；不新增依赖（recharts 为现有唯一图表库）；UI 改动上线前必须独立审查（不能只靠实测）。
- 提交信息中文。
