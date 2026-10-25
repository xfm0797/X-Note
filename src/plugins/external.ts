// ===== 外部插件目录动态加载（.xnote-plugins/ + Blob URL import）=====
import type { XNotePlugin } from './types'
import { isTauri } from '../lib/storage'

const DIR_KEY = 'xnote:external-plugins'
const DISABLED_KEY = 'xnote:external-plugins-disabled'

export interface ExternalPluginEntry {
  dir: string
  manifest: { id: string; name: string; version: string; description?: string; main?: string }
  code: string
  error?: string
}

function readDirStore(): Record<string, ExternalPluginEntry> {
  try { return JSON.parse(localStorage.getItem(DIR_KEY) || '{}') } catch { return {} }
}
function writeDirStore(s: Record<string, ExternalPluginEntry>) {
  localStorage.setItem(DIR_KEY, JSON.stringify(s))
}

/** 扫描插件目录：桌面端读 <库>/.xnote-plugins/，Web 用 localStorage 模拟 */
export async function scanExternalPlugins(): Promise<ExternalPluginEntry[]> {
  if (isTauri()) {
    try {
      const fs = await import('@tauri-apps/plugin-fs')
      const { getLibraryRoot } = await import('../lib/storage')
      const root = await getLibraryRoot()
      if (!root) return []
      const base = `${root}/.xnote-plugins`
      const out: ExternalPluginEntry[] = []
      for (const dir of await fs.readDir(base)) {
        if (!dir.isDirectory) continue
        try {
          const manifest = JSON.parse(await fs.readTextFile(`${base}/${dir.name}/plugin.json`))
          const main = manifest.main || 'main.js'
          const code = await fs.readTextFile(`${base}/${dir.name}/${main}`)
          out.push({ dir: dir.name, manifest, code })
        } catch (e) {
          out.push({ dir: dir.name, manifest: { id: dir.name, name: dir.name, version: '?' }, code: '', error: String(e) })
        }
      }
      return out
    } catch { return [] }
  }
  // Web：localStorage 模拟目录；首次运行自动安装演示插件
  const store = readDirStore()
  if (!Object.keys(store).length) {
    store['hello-world'] = {
      dir: 'hello-world',
      manifest: { id: 'hello-world', name: 'Hello World 样板', version: '1.0.0', description: '演示命令 + 设置面板 + storage 读写' },
      code: DEMO_PLUGIN_CODE
    }
    writeDirStore(store)
  }
  return Object.values(store)
}

/** 经 Blob URL 动态 import 加载单个外部插件 */
export async function loadExternalPlugin(entry: ExternalPluginEntry): Promise<XNotePlugin> {
  if (entry.error) throw new Error(entry.error)
  const blob = new Blob([entry.code], { type: 'text/javascript' })
  const url = URL.createObjectURL(blob)
  try {
    const mod = await import(/* @vite-ignore */ url)
    const plugin = mod.default
    if (!plugin || !plugin.manifest || typeof plugin.activate !== 'function')
      throw new Error('插件形状不符：需 default 导出 { manifest, activate }')
    return plugin as XNotePlugin
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}

export function isExternalDisabled(): boolean {
  return localStorage.getItem(DISABLED_KEY) === '1'
}

export function setExternalDisabled(v: boolean) {
  localStorage.setItem(DISABLED_KEY, v ? '1' : '0')
}

/** 移除外部插件（删除目录条目） */
export function removeExternalPlugin(dir: string) {
  const store = readDirStore()
  delete store[dir]
  writeDirStore(store)
}

/* ---------- .zip 插件包安装 ---------- */

export interface ZipInstallResult { dir: string; name: string; version: string; files: number }

function sanitizeDirName(s: string): string {
  return (s || 'plugin').replace(/[^\w\u4e00-\u9fa5.-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '') || 'plugin'
}

/**
 * 安装 .zip 插件包：自动解压并放入插件目录。
 * zip 内需含 plugin.json（根目录或单个顶层目录内均可，含子目录文件结构）。
 * 桌面端写入 <笔记库>/.xnote-plugins/<插件名>/；Web 模式存入 localStorage 模拟目录。
 */
export async function installZipPlugin(data: Uint8Array): Promise<ZipInstallResult> {
  const { unzipSync } = await import('fflate')
  let entries: Record<string, Uint8Array>
  try { entries = unzipSync(data) } catch (e) { throw new Error('无法解压：不是有效的 zip 文件') }

  // 过滤目录项与 macOS 垃圾
  const files = Object.entries(entries).filter(([p, v]) =>
    !p.endsWith('/') && v.length >= 0 && !p.includes('__MACOSX') && !p.split('/').pop()?.startsWith('._'))
  if (!files.length) throw new Error('zip 中没有文件')

  // 定位 plugin.json（根目录 / 单个顶层目录 / 任意深度取最浅）
  const manifestPath = files.map(([p]) => p)
    .filter(p => p.split('/').pop() === 'plugin.json')
    .sort((a, b) => a.split('/').length - b.split('/').length)[0]
  if (!manifestPath) throw new Error('zip 中未找到 plugin.json（必须是标准插件包）')

  let manifest: ExternalPluginEntry['manifest']
  try { manifest = JSON.parse(new TextDecoder().decode(entries[manifestPath])) }
  catch { throw new Error('plugin.json 不是有效的 JSON') }
  if (!manifest || typeof manifest !== 'object' || !manifest.id || !manifest.name)
    throw new Error('plugin.json 缺少 id / name 字段')

  // 基准目录：plugin.json 所在目录（含嵌套单目录包装的情况）；stripRoot 为根级
  const baseParts = manifestPath.split('/').slice(0, -1)
  const basePrefix = baseParts.length ? baseParts.join('/') + '/' : ''

  const dirName = sanitizeDirName(baseParts.length === 1 && !basePrefix.includes('/')
    ? baseParts[0] : manifest.id)

  // 收集插件文件（相对路径 → 内容）
  const pluginFiles: { rel: string; data: Uint8Array }[] = []
  for (const [p, v] of files) {
    if (!p.startsWith(basePrefix)) continue
    const rel = p.slice(basePrefix.length)
    if (!rel || rel.endsWith('/')) continue
    pluginFiles.push({ rel, data: v })
  }

  const mainEntry = manifest.main || 'main.js'
  if (!pluginFiles.some(f => f.rel === mainEntry))
    throw new Error(`插件包缺少入口文件 ${mainEntry}`)

  if (isTauri()) {
    const fs = await import('@tauri-apps/plugin-fs')
    const { getLibraryRoot } = await import('../lib/storage')
    const root = await getLibraryRoot()
    if (!root) throw new Error('请先选择笔记库')
    const target = `${root}/.xnote-plugins/${dirName}`
    // 覆盖安装：先删旧目录
    try { await fs.remove(target, { recursive: true }) } catch { /* 不存在则忽略 */ }
    for (const f of pluginFiles) {
      const full = `${target}/${f.rel}`
      const parent = full.split('/').slice(0, -1).join('/')
      await fs.mkdir(parent, { recursive: true }).catch(() => {})
      await fs.writeFile(full, f.data)
    }
  } else {
    // Web：localStorage 模拟目录，保存主入口内容
    const main = pluginFiles.find(f => f.rel === mainEntry)!
    const store = readDirStore()
    store[dirName] = {
      dir: dirName,
      manifest,
      code: new TextDecoder().decode(main.data)
    }
    writeDirStore(store)
  }
  return { dir: dirName, name: manifest.name, version: manifest.version, files: pluginFiles.length }
}

/* ---------- 插件中心（GitHub / Gitee 仓库作插件源） ---------- */

export interface MarketEntry {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  /** .zip 插件包下载地址 */
  zip: string
  homepage?: string
}

const MARKET_URL_KEY = 'xnote:market-url'
export const DEFAULT_MARKET_URL = 'https://raw.githubusercontent.com/xfm0797/xnote-plugin-center/main/index.json'

export function getMarketUrl(): string {
  return localStorage.getItem(MARKET_URL_KEY) || DEFAULT_MARKET_URL
}
export function setMarketUrl(url: string) {
  localStorage.setItem(MARKET_URL_KEY, url.trim())
}

/** 拉取插件中心索引（index.json） */
export async function fetchMarketIndex(url: string): Promise<MarketEntry[]> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`索引拉取失败：HTTP ${res.status}`)
  const data = await res.json()
  const list = Array.isArray(data) ? data : data.plugins
  if (!Array.isArray(list)) throw new Error('索引格式不符：需要数组或 { plugins: [...] }')
  return list.filter(e => e && e.id && e.zip)
}

/** 从插件中心安装（下载 zip → 走 installZipPlugin 流程） */
export async function installFromMarket(entry: MarketEntry): Promise<ZipInstallResult> {
  const res = await fetch(entry.zip)
  if (!res.ok) throw new Error(`插件包下载失败：HTTP ${res.status}`)
  const buf = new Uint8Array(await res.arrayBuffer())
  return installZipPlugin(buf)
}

/** Web 模式：演示插件源码（等价于 xnote-external-plugins/hello-world/main.js） */
const DEMO_PLUGIN_CODE = `export default {
  manifest: { id: 'hello-world', name: 'Hello World 样板', version: '1.0.0', description: '演示命令 + 设置面板 + storage 读写' },
  activate(ctx) {
    let count = ctx.settings.get('count', 0)
    ctx.ui.registerCommand({
      id: 'hello-world.greet',
      title: 'Hello 世界',
      run: async () => {
        count++
        ctx.settings.set('count', count)
        const lib = await ctx.storage.loadAll()
        ctx.ui.showToast('Hello from external plugin! 笔记共 ' + Object.keys(lib).length + ' 篇，点击 ' + count + ' 次', 'success')
      },
    })
    function Panel({ getConfig, saveConfig }) {
      const { createElement: h, useState } = window.XNoteReact
      const [cfg, setCfg] = useState(getConfig())
      return h('div', null,
        h('label', null, '签名：'),
        h('input', { value: cfg.sign || '', onChange: (e) => setCfg({ ...cfg, sign: e.target.value }) }),
        h('button', { onClick: () => { saveConfig(cfg); ctx.ui.showToast('已保存：' + (cfg.sign || '（空）'), 'success') } }, '保存'),
      )
    }
    ctx.ui.registerSettingsPanel({
      id: 'hello-world',
      title: 'Hello World 样板',
      render: () => window.XNoteReact.createElement(Panel, {
        getConfig: () => ctx.settings.get('ui', {}),
        saveConfig: (cfg) => ctx.settings.set('ui', cfg),
      }),
    })
  },
}
`
