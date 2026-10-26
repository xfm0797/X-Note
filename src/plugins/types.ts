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

/** 插件自定义弹窗：插件菜单命令点击后弹出的独立窗口 */
export interface PluginDialog {
  id: string
  title: string
  /** 标题右侧的小字说明 */
  subtitle?: string
  /** 弹窗宽度（px，默认 720） */
  width?: number
  /** 返回 React 元素（外部插件经 window.XNoteReact） */
  render: () => any
}

export interface ToastKind { kind?: 'success' | 'error' | 'info' }

/* ---------- ctx.editor：读写当前编辑器 ---------- */

export interface EditorSelection {
  /** 选中的原文 */
  text: string
  /** 选区起点（全文偏移） */
  start: number
  /** 选区终点（全文偏移）；无选区时 start === end */
  end: number
}

export interface ActiveNote {
  path: string
  title: string
  content: string
}

export interface EditorApi {
  /** 当前打开的笔记；没有打开时返回 null */
  active(): ActiveNote | null
  /** 当前笔记全文（无笔记时为空串） */
  getContent(): string
  /** 整体替换当前笔记内容（走编辑器同一条自动保存链路） */
  setContent(text: string): void
  /** 当前选区；光标未落在编辑器内时退化为文末零宽选区 */
  getSelection(): EditorSelection
  /** 用 text 替换选区（无选区则插入到光标处），光标移到插入内容之后 */
  replaceSelection(text: string): void
  /** 在光标处插入 text（不删除选中内容） */
  insertText(text: string): void
  /** 按全文偏移替换任意区间（start/end 会被裁剪到合法范围） */
  replaceRange(start: number, end: number, text: string): void
  /** 设置选区（用于定位生成结果） */
  select(start: number, end: number): void
  /** 让编辑器获得焦点 */
  focus(): void
  /** 订阅当前笔记内容变化（含切换笔记），返回取消订阅函数 */
  onChange(cb: (content: string) => void): () => void
}

/* ---------- ctx.http：插件发网络请求 ---------- */

export interface HttpRequestOptions {
  url: string
  method?: string
  headers?: Record<string, string>
  /** 字符串请求体（JSON 自行 stringify） */
  body?: string
  /** 超时毫秒，默认 120000 */
  timeoutMs?: number
}

export interface HttpResult {
  status: number
  ok: boolean
  text: string
  headers: Record<string, string>
}

export interface JsonResult<T = any> extends HttpResult {
  /** 响应体按 JSON 解析的结果；解析失败为 null */
  data: T | null
}

export interface HttpApi {
  /** 发起任意请求（桌面端经 Rust 侧发出，不受 WebView CORS 限制） */
  request(opts: HttpRequestOptions): Promise<HttpResult>
  /** JSON POST 便捷方法：自动加 Content-Type 并解析响应 JSON */
  postJSON<T = any>(url: string, body: any, headers?: Record<string, string>, timeoutMs?: number): Promise<JsonResult<T>>
  /** JSON GET 便捷方法 */
  getJSON<T = any>(url: string, headers?: Record<string, string>, timeoutMs?: number): Promise<JsonResult<T>>
}

export interface PluginContext {
  manifest: PluginManifest
  storage: StorageApi
  /** 当前编辑器：读写笔记内容与选区（v0.3.0 起提供） */
  editor: EditorApi
  /** 网络请求：桌面端绕过 WebView CORS（v0.3.0 起提供） */
  http: HttpApi
  settings: {
    get<T = any>(key: string, defaultValue?: T): T
    set(key: string, value: any): void
  }
  ui: {
    registerCommand(cmd: PluginCommand): void
    registerSettingsPanel(panel: PluginSettingsPanel): void
    /** 弹出插件自己的窗口（同一时刻只保留最新一个） */
    showDialog(dialog: PluginDialog): void
    /** 关闭插件窗口 */
    closeDialog(): void
    showToast(text: string, kind?: ToastKind['kind']): void
  }
  log: (...args: any[]) => void
}

export interface XNotePlugin {
  manifest: PluginManifest
  activate(ctx: PluginContext): void | Promise<void>
  deactivate?(ctx: PluginContext): void
}
