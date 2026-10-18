// 仓库不变量检查：每条规则的报错都写明该用哪个文件/函数。本地与 CI 跑同一条命令：npm run check
// 例外只能写在违规行上：// invariant-allow <rule>: <原因> (expires YYYY-MM-DD, approved-by: <人>)
import fs from 'node:fs'
import path from 'node:path'

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd()
const today = new Date().toISOString().slice(0, 10)

const RULES = [
  {
    id: 'calendar-ms',
    files: /^src\/.*\.(ts|tsx)$/,
    owner: 'src/lib/date.ts',
    pattern: /\b86400000\b|\b864e5\b|24\s*\*\s*60\s*\*\s*60\b/,
    fix: '日历天数不要用毫秒换算（DST 会错）。用 src/lib/date.ts 的 daysBetween / addDays / shiftDate；时长阈值用 ELAPSED_DAY_MS。',
  },
  {
    id: 'date-key-copy',
    files: /^src\/.*\.(ts|tsx)$/,
    owner: 'src/lib/date.ts',
    pattern: /padStart\(2,\s*'0'\)\}-\$\{/,
    fix: "不要手写 YYYY-MM-DD 拼接。用 src/lib/date.ts 的 dateKey(date) / todayStr(now)。",
  },
  {
    id: 'hidden-clock',
    files: /^src\/lib\/.*\.ts$/,
    test: (line) => {
      for (const m of line.matchAll(/new Date\(\)/g)) {
        const before = line.slice(0, m.index)
        const isDefaultParam = /(^|[(,])\s*\w+\s*(:\s*Date\s*)?=\s*$/.test(before) && !/\b(const|let|var)\s+\w+\s*(:[^=]+)?=\s*$/.test(before)
        if (!isDefaultParam) return true
      }
      return false
    },
    fix: 'lib 纯函数不能偷偷读时钟。把 now 作为参数（now = new Date()）传入，测试才能注入时间。',
  },
  {
    id: 'raw-hex-color',
    files: /^src\/.*\.(ts|tsx)$/,
    pattern: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])/,
    fix: '颜色只在 src/index.css 的 @theme 定义。className 用 token 类（bg-paper/text-ink/...），图表用 src/lib/theme.ts 的 themeColor()。',
  },
  {
    id: 'copy-terms',
    files: /^src\/.*\.(ts|tsx)$/,
    pattern: /今日|当日|大卡/,
    fix: '文案统一：「今日/当日」写作「今天/当天」，「大卡」写作「kcal」。',
  },
]

function stripComments(src) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:\\'"`])\/\/.*$/gm, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const files = walk(path.join(root, 'src')).map((p) => path.relative(root, p).split(path.sep).join('/'))
const problems = []
for (const rel of files) {
  const raw = fs.readFileSync(path.join(root, rel), 'utf8')
  const rawLines = raw.split('\n')
  const code = stripComments(raw).split('\n')
  for (const rule of RULES) {
    if (!rule.files.test(rel) || rel === rule.owner) continue
    code.forEach((line, i) => {
      const hit = rule.test ? rule.test(line) : rule.pattern.test(line)
      if (!hit) return
      const allow = rawLines[i].match(new RegExp(`invariant-allow ${rule.id}: .+\\(expires (\\d{4}-\\d{2}-\\d{2}), approved-by: ([^)]+)\\)`))
      if (allow && allow[1] >= today) return
      const why = allow ? `例外已于 ${allow[1]} 过期` : rule.fix
      problems.push(`${rel}:${i + 1} [${rule.id}] ${why}\n    ${rawLines[i].trim()}`)
    })
  }
}

if (problems.length) {
  console.error(problems.join('\n'))
  console.error(`\n${problems.length} invariant violation(s)`)
  process.exit(1)
}
console.log(`invariants ✓ (${RULES.length} rules, ${files.length} files)`)
