// 测试辅助：esbuild 打包 lib 到系统临时目录并加载 + localStorage polyfill
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
// 用系统 Temp 而非项目内目录：项目路径含空格，esbuild CLI 的 outfile 引号处理不可靠
const tmpDir = path.join(os.tmpdir(), 'fitness-app-tests')
fs.mkdirSync(tmpDir, { recursive: true })

const require_ = createRequire(import.meta.url)

const localStorageStore = new Map()
globalThis.localStorage = {
  getItem: (k) => (localStorageStore.has(k) ? localStorageStore.get(k) : null),
  setItem: (k, v) => localStorageStore.set(k, String(v)),
  removeItem: (k) => localStorageStore.delete(k),
  clear: () => localStorageStore.clear(),
}
export const storageStore = localStorageStore

export function requireLib(name) {
  const src = path.join(root, 'src/lib', `${name}.ts`)
  const srcAlt = path.join(root, 'src', `${name}.ts`)
  const entry = fs.existsSync(src) ? src : srcAlt
  const out = path.join(tmpDir, `${name}.cjs`)
  const cli = path.join(path.dirname(require_.resolve('rolldown/package.json')), 'bin/cli.mjs')
  execFileSync(process.execPath, [cli, entry, '--format', 'cjs', '--platform', 'node', '--file', out, '--logLevel', 'warn'], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] })
  delete require_.cache[out]
  return require_(out)
}
