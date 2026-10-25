// 生成 Tauri updater 的更新清单（在 CI 构建完成后运行）
// 用法：node scripts/gen-latest.mjs <tag>   例：node scripts/gen-latest.mjs v0.2.0
// 扫描 src-tauri/target/release/bundle 下的安装包与 .sig 签名文件，输出到 dist-updater/：
//   latest.json     —— 主路线：下载地址指向 GitHub Release 资产
//   latest-cn.json  —— 备用路线：下载地址指向 Gitee Release 资产（国内直连）
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'

const repo = 'xfm0797/X-Note'
const giteeRepo = 'xfm0797/x-note'
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
const file = basename(exePath)
const ghUrl = `https://github.com/${repo}/releases/download/${tag}/${file}`
const giteeUrl = `https://gitee.com/${giteeRepo}/releases/download/${tag}/${file}`

const latest = {
  version,
  notes: `X-Note ${version} 更新。详情见 Release 页面。`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': { signature, url: ghUrl }
  }
}

const latestCN = {
  ...latest,
  platforms: {
    'windows-x86_64': { signature, url: giteeUrl }
  }
}

mkdirSync('dist-updater', { recursive: true })
writeFileSync('dist-updater/latest.json', JSON.stringify(latest, null, 2))
writeFileSync('dist-updater/latest-cn.json', JSON.stringify(latestCN, null, 2))
console.log('更新清单生成完成：', JSON.stringify({ version, ghUrl, giteeUrl }, null, 2))
