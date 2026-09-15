// 开发服务器启动包装：绑定预览系统分配的 PORT（Vite dev server 不读 PORT 环境变量，需显式传 --port）
// 先执行依赖自检（.bin/vite 丢失时自动 npm install），再用 node 直接调 vite
require('./ensure-deps.cjs')
const { spawn } = require('child_process')
const path = require('path')

const root = path.join(__dirname, '..')
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const port = process.env.PORT || '5180'
const args = [viteBin, '--host', '--port', String(port), ...process.argv.slice(2)]

const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 0))
