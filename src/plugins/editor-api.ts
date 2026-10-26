// ===== ctx.editor 实现：把 App 的编辑器状态包装成插件可用的读写 API =====
// 设计要点：
// 1. 宿主只传入「读取当前快照」「应用新内容」两个回调，其余语义在此实现，App 侧保持精简
// 2. 选区始终以 textarea 的 selectionStart/End 为准（插件弹窗打开时宿主 textarea 仍保存选区）
// 3. 每次写入都走 App 的 applyContent —— 与手动输入同一条自动保存/历史快照链路
import type { ActiveNote, EditorApi, EditorSelection } from './types'

export interface EditorApiDeps {
  /** 当前打开的笔记快照（无笔记时 null） */
  current(): ActiveNote | null
  /** 应用新内容；selStart/selEnd 用于写入后恢复选区 */
  apply(content: string, selStart?: number, selEnd?: number): void
}

export interface EditorApiInternal extends EditorApi {
  /** 宿主在内容变化（输入/切换笔记/外部写入）时调用，驱动插件订阅 */
  emit(content: string): void
}

const TEXTAREA = '.editor-textarea'

export function createEditorApi(deps: EditorApiDeps): EditorApiInternal {
  const listeners = new Set<(content: string) => void>()

  const textarea = () => document.querySelector<HTMLTextAreaElement>(TEXTAREA)

  /** 读取当前选区（越界裁剪到内容长度；textarea 不存在时退化为文末零宽选区） */
  function readSelection(): EditorSelection {
    const content = deps.current()?.content ?? ''
    const el = textarea()
    if (!el) return { text: '', start: content.length, end: content.length }
    const start = Math.max(0, Math.min(el.selectionStart ?? content.length, content.length))
    const end = Math.max(start, Math.min(el.selectionEnd ?? start, content.length))
    return { text: content.slice(start, end), start, end }
  }

  function applyAt(start: number, end: number, text: string) {
    const cur = deps.current()
    if (!cur) return
    const s = Math.max(0, Math.min(start, cur.content.length))
    const e = Math.max(s, Math.min(end, cur.content.length))
    const next = cur.content.slice(0, s) + text + cur.content.slice(e)
    const caret = s + text.length
    deps.apply(next, caret, caret)
  }

  const api: EditorApiInternal = {
    active() {
      const cur = deps.current()
      return cur ? { ...cur } : null
    },
    getContent() {
      return deps.current()?.content ?? ''
    },
    setContent(text) {
      if (!deps.current()) return
      deps.apply(String(text ?? ''))
    },
    getSelection: readSelection,
    replaceSelection(text) {
      if (!deps.current()) return
      const { start, end } = readSelection()
      applyAt(start, end, String(text ?? ''))
    },
    insertText(text) {
      if (!deps.current()) return
      const { start } = readSelection()
      applyAt(start, start, String(text ?? ''))
    },
    replaceRange(start, end, text) {
      applyAt(start, end, String(text ?? ''))
    },
    select(start, end) {
      const cur = deps.current()
      if (!cur) return
      const s = Math.max(0, Math.min(start, cur.content.length))
      const e = Math.max(s, Math.min(end, cur.content.length))
      const el = textarea()
      if (!el) return
      el.focus()
      el.setSelectionRange(s, e)
    },
    focus() {
      textarea()?.focus()
    },
    onChange(cb) {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
    emit(content) {
      for (const cb of Array.from(listeners)) {
        try { cb(content) } catch (err) { console.error('[editor.onChange]', err) }
      }
    }
  }
  return api
}
