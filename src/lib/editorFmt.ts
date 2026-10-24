// ===== 编辑器格式化纯函数（包裹 / 前缀 / 列表续写 / 字数统计） =====

export interface EditResult { text: string; selStart: number; selEnd: number }

/** 包裹选区：有选区则前后包夹；无选区则插入骨架并把光标放中间 */
export function applyWrap(text: string, selStart: number, selEnd: number, before: string, after: string): EditResult {
  const sel = text.slice(selStart, selEnd)
  const newText = text.slice(0, selStart) + before + sel + after + text.slice(selEnd)
  if (sel) return { text: newText, selStart: selStart + before.length, selEnd: selStart + before.length + sel.length }
  const pos = selStart + before.length
  return { text: newText, selStart: pos, selEnd: pos }
}

/** 行前缀切换（H1-H3 / 引用 / 列表）：已有则移除，否则添加 */
export function toggleLinePrefix(text: string, selStart: number, selEnd: number, prefix: string): EditResult {
  const ls = text.lastIndexOf('\n', selStart - 1) + 1
  let le = text.indexOf('\n', selEnd)
  if (le === -1) le = text.length
  const block = text.slice(ls, le)
  const lines = block.split('\n')
  const allHave = lines.every(l => l.startsWith(prefix))
  const newLines = lines.map(l => allHave ? l.slice(prefix.length) : prefix + l.replace(/^(#{1,6}\s|>\s|[-*+]\s\[[ x]\]\s|[-*+]\s|\d+\.\s)/, ''))
  const newBlock = newLines.join('\n')
  const newText = text.slice(0, ls) + newBlock + text.slice(le)
  return { text: newText, selStart: ls, selEnd: ls + newBlock.length }
}

/** 行内包裹类工具条动作 */
export function toolbarAction(text: string, selStart: number, selEnd: number, action: string): EditResult {
  switch (action) {
    case 'bold': return applyWrap(text, selStart, selEnd, '**', '**')
    case 'italic': return applyWrap(text, selStart, selEnd, '*', '*')
    case 'strike': return applyWrap(text, selStart, selEnd, '~~', '~~')
    case 'code': return applyWrap(text, selStart, selEnd, '`', '`')
    case 'codeblock': return applyWrap(text, selStart, selEnd, '\n```\n', '\n```\n')
    case 'h1': return toggleLinePrefix(text, selStart, selEnd, '# ')
    case 'h2': return toggleLinePrefix(text, selStart, selEnd, '## ')
    case 'h3': return toggleLinePrefix(text, selStart, selEnd, '### ')
    case 'quote': return toggleLinePrefix(text, selStart, selEnd, '> ')
    case 'ul': return toggleLinePrefix(text, selStart, selEnd, '- ')
    case 'task': return toggleLinePrefix(text, selStart, selEnd, '- [ ] ')
    case 'ol': {
      const ls = text.lastIndexOf('\n', selStart - 1) + 1
      let le = text.indexOf('\n', selEnd); if (le === -1) le = text.length
      const lines = text.slice(ls, le).split('\n')
      const allOl = lines.every(l => /^\d+\.\s/.test(l))
      const newLines = lines.map((l, i) => allOl ? l.replace(/^\d+\.\s/, '') : `${i + 1}. ${l.replace(/^([-*+]|\d+\.)\s/, '')}`)
      const newBlock = newLines.join('\n')
      return { text: text.slice(0, ls) + newBlock + text.slice(le), selStart: ls, selEnd: ls + newBlock.length }
    }
    case 'link': return applyWrap(text, selStart, selEnd, '[', '](https://)')
    default: return { text, selStart, selEnd }
  }
}

/**
 * Enter 智能续写：无序 / 有序（编号 +1）/ 任务 / 引用自动续行；
 * 空项再按 Enter 退出列表。返回 null 表示按默认换行处理。
 */
export function continueList(text: string, caret: number): EditResult | null {
  const ls = text.lastIndexOf('\n', caret - 1) + 1
  const line = text.slice(ls, caret)
  // 光标后还有内容时不干预（避免拆散文本）——仅当光标在行尾
  if (text.slice(caret).split('\n')[0].trim() !== '') return null

  const patterns: [RegExp, (m: RegExpExecArray) => string | null][] = [
    [/^(\s*)([-*+])\s\[[ xX]\]\s$/, m => `${m[1]}${m[2]} [ ] `],          // 空任务项 → 退出
    [/^(\s*)([-*+])\s\[[ xX]\]\s/, m => `${m[1]}${m[2]} [ ] `],
    [/^(\s*)([-*+])\s$/, () => ''],                                        // 空无序项 → 退出
    [/^(\s*)([-*+])\s/, m => `${m[1]}${m[2]} `],
    [/^(\s*)(>)\s$/, () => ''],
    [/^(\s*)(>)\s/, m => `${m[1]}${m[2]} `],
    [/^(\s*)(\d+)\.\s$/, (_m) => ''],                                      // 空有序项 → 退出
    [/^(\s*)(\d+)\.\s/, m => `${m[1]}${parseInt(m[2], 10) + 1}. `]
  ]
  for (const [re, make] of patterns) {
    const m = re.exec(line)
    if (!m) continue
    const next = make(m)
    if (next === '') {
      // 退出列表：删除当前空项，光标到行尾
      const newText = text.slice(0, ls) + text.slice(caret)
      return { text: newText, selStart: ls, selEnd: ls }
    }
    const insert = '\n' + next
    const newText = text.slice(0, caret) + insert + text.slice(caret)
    const pos = caret + insert.length
    return { text: newText, selStart: pos, selEnd: pos }
  }
  return null
}

/** 字数统计：中文按字、英文按词 */
export function countWords(text: string): { chars: number; words: number } {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const en = (text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ').match(/[A-Za-z0-9_'-]+/g) || []).length
  return { chars: text.length, words: cjk + en }
}
