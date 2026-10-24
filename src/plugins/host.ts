// ===== 插件宿主：注册表 + UI API + 命令归属跟踪 =====
import type { NoteMeta } from '../types'
import type { PluginCommand, PluginContext, PluginSettingsPanel, XNotePlugin } from './types'
import { isTauri } from '../lib/storage'

export interface HostDeps {
  storage: {
    loadAll(): Promise<Record<string, NoteMeta>>
    readFile(path: string): Promise<string | null>
    writeFile(path: string, content: string): Promise<void>
    deletePath(path: string): Promise<void>
    reloadLibrary(): Promise<Record<string, NoteMeta>>
  }
  showToast(text: string, kind?: 'success' | 'error' | 'info'): void
  /** 宿主主动询问各面板是否刷新（用简单订阅实现） */
  notifyPanelsChanged(): void
}

export interface Host {
  registerPlugin(plugin: XNotePlugin): Promise<void>
  commands(): PluginCommand[]
  panels(): PluginSettingsPanel[]
  /** 清空指定来源（'external' 或全部）的注册 */
  clear(source?: string): void
  /** 外部插件停用标记 */
  isExternalDisabled(): boolean
  setExternalDisabled(v: boolean): void
}

export function createHost(deps: HostDeps): Host {
  const commands: (PluginCommand & { owner: string })[] = []
  const panels: (PluginSettingsPanel & { owner: string })[] = []

  const DISABLE_KEY = 'xnote:external-plugins-disabled'

  const host: Host = {
    async registerPlugin(plugin) {
      const pSettingsKey = `xnote:plugin:${plugin.manifest.id}`
      const ctx: PluginContext = {
        manifest: plugin.manifest,
        storage: {
          loadAll: () => deps.storage.loadAll(),
          readFile: (p) => deps.storage.readFile(p),
          writeFile: (p, c) => deps.storage.writeFile(p, c),
          deletePath: (p) => deps.storage.deletePath(p),
          getModified: async (p) => {
            const lib = await deps.storage.loadAll()
            return lib[p]?.updated ?? 0
          },
          reloadLibrary: () => deps.storage.reloadLibrary()
        },
        settings: {
          get: (key, def) => {
            try {
              const raw = localStorage.getItem(`${pSettingsKey}:${key}`)
              return raw === null ? def : JSON.parse(raw)
            } catch { return def }
          },
          set: (key, value) => {
            localStorage.setItem(`${pSettingsKey}:${key}`, JSON.stringify(value))
            deps.notifyPanelsChanged()
          }
        },
        ui: {
          registerCommand: (cmd) => { commands.push({ ...cmd, owner: plugin.manifest.id }) },
          registerSettingsPanel: (panel) => { panels.push({ ...panel, owner: plugin.manifest.id }) },
          showToast: (text, kind) => deps.showToast(text, kind)
        },
        log: (...args) => console.log(`[plugin:${plugin.manifest.id}]`, ...args)
      }
      commands.push // noop 防止 TS 优化提示
      await plugin.activate(ctx)
      deps.notifyPanelsChanged()
    },
    commands: () => commands.slice(),
    panels: () => panels.slice(),
    clear(source) {
      if (!source) { commands.length = 0; panels.length = 0; return }
      for (let i = commands.length - 1; i >= 0; i--) if (commands[i].owner === source) commands.splice(i, 1)
      for (let i = panels.length - 1; i >= 0; i--) if (panels[i].owner === source) panels.splice(i, 1)
    },
    isExternalDisabled: () => {
      try { return localStorage.getItem(DISABLE_KEY) === '1' } catch { return false }
    },
    setExternalDisabled(v) {
      localStorage.setItem(DISABLE_KEY, v ? '1' : '0')
      deps.notifyPanelsChanged()
    }
  }
  void isTauri
  return host
}
