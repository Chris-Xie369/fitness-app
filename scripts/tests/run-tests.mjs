// 运行 scripts/tests 下全部 *.test.cjs，任一失败退出非零
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.mjs'))
if (files.length === 0) {
  console.error('no test files found')
  process.exit(1)
}
for (const f of files) {
  console.log(`-- ${f}`)
  execFileSync(process.execPath, [path.join(dir, f)], { stdio: 'inherit', cwd: path.resolve(dir, '../..') })
}
console.log(`\n${files.length} test file(s) passed`)
