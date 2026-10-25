// ===== Markdown 编辑器（格式工具条、快捷键、列表续写、图片插入） =====
import React, { useEffect, useRef } from 'react'
import { toolbarAction, continueList } from '../lib/editorFmt'
import { saveImage } from '../lib/assets'
import { appToast } from './AskModal'

interface Props {
  value: string
  fontSize: number
  fontFamily: string
  onChange(v: string, selStart?: number, selEnd?: number): void
  onCaretChange(info: { line: number; col: number }): void
}

const TOOLS: [string, string, string][] = [
  ['bold', 'B', '加粗'], ['italic', 'I', '斜体'], ['strike', 'S̶', '删除线'],
  ['code', '〈〉', '行内代码'], ['codeblock', '{ }', '代码块'],
  ['h1', 'H1', '一级标题'], ['h2', 'H2', '二级标题'], ['h3', 'H3', '三级标题'],
  ['link', '🔗', '链接'], ['ul', '•≡', '无序列表'], ['ol', '1≡', '有序列表'],
  ['task', '☑', '任务列表'], ['quote', '❝', '引用']
]

export function Editor(p: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { /* 外部值变化由 React 受控 */ }, [p.value])

  const apply = (res: { text: string; selStart: number; selEnd: number }) => {
    p.onChange(res.text, res.selStart, res.selEnd)
    requestAnimationFrame(() => {
      const el = ref.current
      if (el) { el.focus(); el.setSelectionRange(res.selStart, res.selEnd) }
    })
  }

  const insertAtCursor = (text: string) => {
    const el = ref.current!
    const s = el.selectionStart
    apply({ text: p.value.slice(0, s) + text + p.value.slice(el.selectionEnd), selStart: s + text.length, selEnd: s + text.length })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    const { selectionStart: s, selectionEnd: en, value } = el
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.key === 'b') { e.preventDefault(); apply(toolbarAction(value, s, en, 'bold')); return }
      if (e.key === 'i') { e.preventDefault(); apply(toolbarAction(value, s, en, 'italic')); return }
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      insertAtCursor('  ')
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      const res = continueList(value, s)
      if (res) { e.preventDefault(); apply(res) }
      return
    }
    // 光标位置上报
    const before = value.slice(0, s)
    const line = before.split('\n').length
    const col = s - before.lastIndexOf('\n')
    p.onCaretChange({ line, col })
  }

  const handlePasteOrDrop = async (e: React.ClipboardEvent | React.DragEvent) => {
    const files: File[] = []
    if ('clipboardData' in e) files.push(...Array.from(e.clipboardData.files))
    if ('dataTransfer' in e) files.push(...Array.from(e.dataTransfer.files))
    const img = files.find(f => f.type.startsWith('image/'))
    if (!img) return
    e.preventDefault()
    const r = await saveImage(img)
    if (r.ok) insertAtCursor(r.markdown)
    else appToast(r.error, 'error')
  }

  return (
    <div className="editor-pane">
      <div className="fmt-toolbar">
        {TOOLS.map(([act, label, title]) => (
          <button
            key={act}
            title={title}
            onMouseDown={e => e.preventDefault()}
            onClick={() => {
              const el = ref.current!
              apply(toolbarAction(p.value, el.selectionStart, el.selectionEnd, act))
            }}
          >{label}</button>
        ))}
      </div>
      <textarea
        ref={ref}
        className="editor-textarea"
        style={{ fontSize: p.fontSize, fontFamily: p.fontFamily }}
        value={p.value}
        placeholder="在此输入 Markdown…（粘贴或拖入图片可自动插入）"
        onChange={e => p.onChange(e.target.value, e.target.selectionStart, e.target.selectionEnd)}
        onKeyDown={handleKeyDown}
        onKeyUp={e => {
          const el = e.currentTarget
          const before = el.value.slice(0, el.selectionStart)
          p.onCaretChange({ line: before.split('\n').length, col: el.selectionStart - before.lastIndexOf('\n') })
        }}
        onPaste={handlePasteOrDrop}
        onDrop={handlePasteOrDrop as any}
        spellCheck={false}
      />
    </div>
  )
}
