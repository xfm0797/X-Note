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
