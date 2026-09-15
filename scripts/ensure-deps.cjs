// predev 自检：node_modules 残缺（如 .bin/vite 丢失）时自动修复，避免 dev 启动失败
const { existsSync } = require('fs')
const { execSync } = require('child_process')
const path = require('path')

const root = path.join(__dirname, '..')
const vitePkg = path.join(root, 'node_modules', 'vite', 'package.json')
const viteBin = path.join(root, 'node_modules', '.bin', 'vite.cmd')

if (!existsSync(vitePkg) || !existsSync(viteBin)) {
  console.log('[predev] 依赖不完整（缺少 vite），正在执行 npm install …')
  // 清除生命周期继承的 allow-scripts 配置，否则嵌套 npm install 在 npm 12 下报 EALLOWSCRIPTS
  const env = { ...process.env }
  delete env.npm_config_allow_scripts
  try {
    execSync('npm install', { cwd: root, stdio: 'inherit', env, shell: true })
  } catch {
    // Node 的输出在管道里是 UTF-8，能被正常显示（避免 cmd 的 GBK 乱码报错）
    console.error('[predev] npm install 失败，请手动在项目目录运行一次 npm install 后再启动。')
    process.exit(1)
  }
  if (!existsSync(viteBin)) {
    console.error('[predev] vite 仍未恢复，请删除 node_modules 后重新 npm install。')
    process.exit(1)
  }
}
