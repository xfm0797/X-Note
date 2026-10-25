// 生成 Tauri updater 的 latest.json（在 CI 构建完成后运行）
// 用法：node scripts/gen-latest.mjs <tag>   例：node scripts/gen-latest.mjs v0.2.0
// 扫描 src-tauri/target/release/bundle 下的安装包与 .sig 签名文件，
// 输出 dist-updater/latest.json，其中下载地址指向 GitHub Release 资产。
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'

const repo = 'xfm0797/X-Note'
const tag = process.argv[2] || process.env.TAG || ''
if (!/^v\d/.test(tag)) {
  console.error('用法: node scripts/gen-latest.mjs v0.2.0'); process.exit(1)
}
const version = tag.replace(/^v/, '')
const bundleDir = 'src-tauri/target/release/bundle'

// 优先用 NSIS 安装程序作为更新载体（MSI 的升级语义较受限）
let exePath = null, sigPath = null
const nsisDir = join(bundleDir, 'nsis')
if (existsSync(nsisDir)) {
  for (const f of readdirSync(nsisDir)) {
    if (f.endsWith('-setup.exe')) { exePath = join(nsisDir, f); sigPath = exePath + '.sig'; break }
  }
  if (!exePath) {
    const exes = readdirSync(nsisDir).filter(f => f.endsWith('.exe'))
    if (exes.length) { exePath = join(nsisDir, exes[0]); sigPath = exePath + '.sig' }
  }
}
if (!exePath) { console.error('未找到 NSIS 安装包'); process.exit(1) }
if (!existsSync(sigPath)) { console.error('未找到签名文件：', sigPath, '（请确认已设置 TAURI_SIGNING_PRIVATE_KEY 且 createUpdaterArtifacts=true）'); process.exit(1) }

const signature = readFileSync(sigPath, 'utf8').trim()
const url = `https://github.com/${repo}/releases/download/${tag}/${basename(exePath)}`

const latest = {
  version,
  notes: `X-Note ${version} 更新。详情见 Release 页面。`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': { signature, url }
  }
}

mkdirSync('dist-updater', { recursive: true })
writeFileSync('dist-updater/latest.json', JSON.stringify(latest, null, 2))
console.log('latest.json 生成完成：', JSON.stringify({ version, url }, null, 2))
