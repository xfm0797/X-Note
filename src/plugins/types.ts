// ===== 插件契约：PluginContext / XNotePlugin / Command / SettingsPanel =====
import type { NoteMeta } from '../types'

export interface PluginManifest {
  id: string
  name: string
  version: string
  description?: string
}

export interface StorageApi {
  loadAll(): Promise<Record<string, NoteMeta>>
  readFile(path: string): Promise<string | null>
  writeFile(path: string, content: string): Promise<void>
  deletePath(path: string): Promise<void>
  getModified(path: string): Promise<number>
  reloadLibrary(): Promise<Record<string, NoteMeta>>
}

export interface PluginCommand {
  id: string
  title: string
  run: () => void | Promise<void>
}

export interface PluginSettingsPanel {
  id: string
  title: string
  /** 返回 React 元素（外部插件经 window.XNoteReact） */
  render: () => any
}

export interface ToastKind { kind?: 'success' | 'error' | 'info' }

export interface PluginContext {
  manifest: PluginManifest
  storage: StorageApi
  settings: {
    get<T = any>(key: string, defaultValue?: T): T
    set(key: string, value: any): void
  }
  ui: {
    registerCommand(cmd: PluginCommand): void
    registerSettingsPanel(panel: PluginSettingsPanel): void
    showToast(text: string, kind?: ToastKind['kind']): void
  }
  log: (...args: any[]) => void
}

export interface XNotePlugin {
  manifest: PluginManifest
  activate(ctx: PluginContext): void | Promise<void>
  deactivate?(ctx: PluginContext): void
}
