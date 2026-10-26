// ===== 编辑菜单文本操作（纯函数，配合 onEditorChange 应用） =====
export type EditOp =
  | 'insert-datetime'
  | 'upper'
  | 'lower'
  | 'dup-line'
  | 'del-line'
  | 'line-up'
  | 'line-down'

/** 菜单可见的编辑操作：撤销/重做/全选走浏览器原生能力，其余交给 transformText */
export type MenuEditOp = EditOp | 'undo' | 'redo' | 'select-all'

/** 光标/选区所在行范围 [start, end)（不含行尾换行） */
function lineBounds(text: string, pos: number): [number, number] {
  const start = text.lastIndexOf('\n', Math.max(0, pos - 1)) + 1
  let end = text.indexOf('\n', pos)
  if (end === -1) end = text.length
  return [start, end]
}

/** 对文本应用编辑操作，返回新文本与新选区；无法应用时返回 null */
export function transformText(
  op: EditOp,
  text: string,
  s: number,
  e: number
): { text: string; selStart: number; selEnd: number } | null {
  switch (op) {
    case 'insert-datetime': {
      const d = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
      return {
        text: text.slice(0, s) + stamp + text.slice(e),
        selStart: s + stamp.length, selEnd: s + stamp.length
      }
    }
    case 'upper':
    case 'lower': {
      if (s === e) return null // 无选区
      const sel = text.slice(s, e)
      const converted = op === 'upper' ? sel.toUpperCase() : sel.toLowerCase()
      return { text: text.slice(0, s) + converted + text.slice(e), selStart: s, selEnd: s + converted.length }
    }
    case 'dup-line': {
      const pos = s === e ? s : e // 有选区时取选区末尾所在行
      const [ls, le] = lineBounds(text, pos)
      const line = text.slice(ls, le)
      const insertAt = le
      const out = text.slice(0, insertAt) + '\n' + line + text.slice(insertAt)
      return { text: out, selStart: insertAt + 1, selEnd: insertAt + 1 + line.length }
    }
    case 'del-line': {
      const pos = s === e ? s : s // 有选区时删首行
      const [ls, le] = lineBounds(text, pos)
      const withNl = le < text.length ? le + 1 : le
      const out = text.slice(0, ls) + text.slice(withNl)
      return { text: out, selStart: ls, selEnd: ls }
    }
    case 'line-up':
    case 'line-down': {
      const [ls, le] = lineBounds(text, s === e ? s : e)
      const line = text.slice(ls, le)
      if (op === 'line-up') {
        if (ls === 0) return null // 已在首行
        const [ps, pe] = lineBounds(text, ls - 2 < 0 ? 0 : ls - 2)
        const prev = text.slice(ps, pe)
        const out = text.slice(0, ps) + line + '\n' + prev + text.slice(le)
        const moved = le - ls // 行长不变，光标随行上移
        return { text: out, selStart: ps, selEnd: ps + moved }
      }
      if (le >= text.length) return null // 已在末行
      const nextEnd0 = text.indexOf('\n', le + 1)
      const ne = nextEnd0 === -1 ? text.length : nextEnd0
      const next = text.slice(le + 1, ne)
      const out = text.slice(0, ls) + next + '\n' + line + text.slice(ne)
      const delta = next.length + 1
      return { text: out, selStart: ls + delta, selEnd: le + delta }
    }
  }
}

/** 计算第 n 行（1 起）行首偏移；行号越界返回 null */
export function lineOffset(text: string, n: number): number | null {
  if (n < 1) return null
  let off = 0
  let line = 1
  while (line < n) {
    const nl = text.indexOf('\n', off)
    if (nl === -1) return null
    off = nl + 1
    line++
  }
  return off
}
