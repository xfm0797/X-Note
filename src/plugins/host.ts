// ===== 插件宿主：注册表 + UI API + 命令归属跟踪 =====
// 防重复加载机制：
// 1. registerPlugin 幂等 —— 同 id 重新注册前先清掉旧注册
// 2. epoch 机制 —— clear() 递增 epoch，注册期间捕获 epoch，
//    重载后迟到的注册（旧一轮加载流程的 activate 尚未完成）一律丢弃
// 3. (owner, cmd/panel id) 去重 —— 插件内部重复注册同 id 也只保留一份
import type { NoteMeta } from '../types'
import type { EditorApi, HttpApi, PluginCommand, PluginContext, PluginDialog, PluginSettingsPanel, XNotePlugin } from './types'
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
  /** ctx.editor：读写当前编辑器 */
  editor: EditorApi
  /** ctx.http：插件网络请求 */
  http: HttpApi
  /** 打开/关闭插件自定义弹窗 */
  openDialog(dialog: PluginDialog): void
  closeDialog(): void
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
  // 全局注册纪元：每次 clear() 后 +1，用于丢弃重载前发起的迟到注册
  let epoch = 0

  const DISABLE_KEY = 'xnote:external-plugins-disabled'

  /** 按 owner 移除注册（不递增 epoch，供幂等重注册使用） */
  function removeOwner(owner: string) {
    for (let i = commands.length - 1; i >= 0; i--) if (commands[i].owner === owner) commands.splice(i, 1)
    for (let i = panels.length - 1; i >= 0; i--) if (panels[i].owner === owner) panels.splice(i, 1)
  }

  const host: Host = {
    async registerPlugin(plugin) {
      const myEpoch = epoch
      const id = plugin.manifest.id
      // 幂等：同 id 重复注册时先清掉旧注册，保证同一插件只有一份
      removeOwner(id)
      const pSettingsKey = `xnote:plugin:${id}`
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
        editor: deps.editor,
        http: deps.http,
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
          registerCommand: (cmd) => {
            // epoch 变化 = 注册期间发生过重载，丢弃迟到注册
            if (epoch !== myEpoch) return
            // (owner, cmd.id) 去重：插件内部重复注册同 id 只保留一份
            if (commands.some(c => c.owner === id && c.id === cmd.id)) return
            commands.push({ ...cmd, owner: id })
          },
          registerSettingsPanel: (panel) => {
            if (epoch !== myEpoch) return
            if (panels.some(p => p.owner === id && p.id === panel.id)) return
            panels.push({ ...panel, owner: id })
          },
          showDialog: (dialog) => {
            if (epoch !== myEpoch) return
            deps.openDialog(dialog)
          },
          closeDialog: () => deps.closeDialog(),
          showToast: (text, kind) => deps.showToast(text, kind)
        },
        log: (...args) => console.log(`[plugin:${id}]`, ...args)
      }
      await plugin.activate(ctx)
      deps.notifyPanelsChanged()
    },
    commands: () => commands.slice(),
    panels: () => panels.slice(),
    clear(source) {
      epoch++ // 使所有进行中的注册流程过期
      if (!source) { commands.length = 0; panels.length = 0; return }
      removeOwner(source)
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
