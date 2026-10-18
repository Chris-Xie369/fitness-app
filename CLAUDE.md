# fitness-app 项目规范

个人自用的健身打卡 PWA（React 19 + TS strict + Tailwind 4，Vite 8，纯 localStorage/IndexedDB，无后端）。

## 构建与验证

- **提交前跑 `npm run verify`**（build + lint + test + check），CI 跑的是同一组命令。根目录 `tsc --noEmit` 是空跑，不要用它判断类型。
- 纯函数单测：`scripts/tests/*.test.mjs`，`npm test` 自动收集。新增 lib 纯函数必须带测试并入库。
- 浏览器预览用 launch.json 的 `fitness-app` 配置（autoPort）。验证后必须 `resize desktop` 复位视口。
- 部署：push main → Cloudflare Pages 自动构建。验证线上 = 本地 `npm run build` 产物 hash 与 `https://fitness-app-a6t.pages.dev` 引用的 bundle hash 一致。Netlify 已锁不动。

## 视觉（暖纸美学，不可破坏）

- 颜色只在 index.css @theme 定义（`npm run check` 拦截写死 hex）；图表取色用 `lib/theme.ts` 的 `themeColor()`。禁止渐变重阴影。
- 卡：`rounded-2xl bg-surface border border-line p-4`；主 CTA：`rounded-xl bg-clay text-white`；卡内小操作：描边胶囊（虚线=可填充内容，实线=可执行操作）。
- 进度条统一 `h-1.5 rounded-full bg-line`；填充语义：clay=正常/达标、ink/40=超出。
- hero 数字必须 `tabular-nums`；56px 只留给连续天数 streak，其余 hero 封顶 40px。
- 标题：卡内小标题统一 `font-display italic text-muted`；页面大标题 `font-display`。
- 底部导航图标统一 SVG（icons.tsx，26px 视觉尺寸、2.4px 描边），禁止引入 emoji 图标；正文 emoji 只允许成就/庆祝场景。

## 文案

- 全中文（「今日/当日/大卡」由 `npm run check` 拦截）。
- CTA 主动、带宾语（保存资料/保存模板/保存备注），动作名全流程一致；空态和错误给方向，不道歉。
- 「打卡」专指训练打卡；饮水/饮食叫「记录」「登记」，不叫打卡。

## 数据

- 新增记录类集合：在 `src/collections.ts` 登记（漏登记编译失败），再补 load/save 校验与 `collections.backup` 往返样本。单条记录的新字段仍要同步 load 校验与 parseBackup。
- 日期计算只用 `src/lib/date.ts`（dateKey/mondayOf/daysBetween/addDays/shiftDate），周一起算；其它写法由 `npm run check` 拦截。
- 克数记录形态固定为「名称 NNg」（lib/diet.ts 的 GRAM_SUFFIX 依赖），改格式必须同步 learnedKcal/macrosOf/menuLoggedCount。

## 代码

- 严格 TS（strict:true）；不新增依赖（recharts 为现有唯一图表库）；UI 改动上线前必须独立审查（不能只靠实测）。
- 提交信息中文。

## 规则与执行方式

| 规则 | 由什么保证 |
| --- | --- |
| 日期不用毫秒换算、不手写日期键 | `npm run check`（calendar-ms / date-key-copy） |
| lib 纯函数时钟可注入 | `npm run check`（hidden-clock） |
| 颜色只用主题 token | `npm run check`（raw-hex-color）+ `lib/theme.ts` |
| 文案禁用词 | `npm run check`（copy-terms） |
| 集合进备份、导入文案不漏项 | `src/collections.ts` 的 satisfies + `collections.backup` 测试 |
| 测试在任何机器可跑 | CI（ubuntu）跑 `npm test` |
| 视觉卡片/CTA/hero 字号、文案语气、UI 独立审查 | 人工判断（本文件） |

例外只能写在违规行：`// invariant-allow <rule>: <原因> (expires YYYY-MM-DD, approved-by: <人>)`，过期即失败。
