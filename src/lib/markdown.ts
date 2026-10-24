// ===== Markdown 渲染：marked + DOMPurify + KaTeX + 双向链接扩展 + 大纲/标签提取 =====
import { marked, type Tokens } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/* ---- KaTeX 行内 $...$ 与块级 $$...$$ ---- */
const inlineMath = {
  name: 'inlineMath',
  level: 'inline' as const,
  start(src: string) { return src.indexOf('$') },
  tokenizer(src: string) {
    const m = /^\$([^$\n]+?)\$/.exec(src)
    if (!m) return undefined
    return { type: 'inlineMath', raw: m[0], formula: m[1] } as any
  },
  renderer(token: any) {
    try { return katex.renderToString(token.formula, { throwOnError: false, displayMode: false }) }
    catch { return esc(token.raw) }
  }
}

const blockMath = {
  name: 'blockMath',
  level: 'block' as const,
  start(src: string) { return src.indexOf('$$') },
  tokenizer(src: string) {
    const m = /^\$\$([\s\S]+?)\$\$(?:\n+|$)/.exec(src)
    if (!m) return undefined
    return { type: 'blockMath', raw: m[0], formula: m[1] } as any
  },
  renderer(token: any) {
    try { return `<p class="math-block">${katex.renderToString(token.formula, { throwOnError: false, displayMode: true })}</p>` }
    catch { return esc(token.raw) }
  }
}

/* ---- 双向链接 [[笔记名]] / [[笔记名|别名]] ---- */
const wikiLink = {
  name: 'wikiLink',
  level: 'inline' as const,
  start(src: string) { return src.indexOf('[[') },
  tokenizer(src: string) {
    const m = /^\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/.exec(src)
    if (!m) return undefined
    return { type: 'wikiLink', raw: m[0], target: m[1].trim(), text: (m[2] || m[1]).trim() } as any
  },
  renderer(token: any) {
    const exists = (window as any).__xnoteWikiTitles instanceof Set
      ? (window as any).__xnoteWikiTitles.has(token.target)
      : true
    return `<a href="javascript:void(0)" class="wikilink${exists ? '' : ' unresolved'}" data-wiki="${esc(token.target)}">${esc(token.text)}</a>`
  }
}

marked.use({ extensions: [inlineMath, blockMath, wikiLink], gfm: true, breaks: true })

/** 渲染为消毒后的 HTML（标题自动注入 h-<序号> 锚点） */
export function renderMarkdown(src: string, wikiTitles?: Set<string>): string {
  ;(window as any).__xnoteWikiTitles = wikiTitles ?? null
  let html = marked.parse(src ?? '') as string
  // 逐个加标题锚点 id
  let i = 0
  html = html.replace(/<h([1-6])>/g, (_m, lv) => `<h${lv} id="xh-${i++}">`)
  return DOMPurify.sanitize(html, { ADD_ATTR: ['data-wiki', 'target'] })
}

/** 文档大纲（跳过代码块内的 # 行） */
export function extractOutline(src: string) {
  const out: { level: number; text: string; id: string; line: number }[] = []
  let inCode = false
  let i = 0
  src.split('\n').forEach((line, ln) => {
    if (/^\s*```/.test(line)) { inCode = !inCode; return }
    if (inCode) return
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
    if (m) out.push({ level: m[1].length, text: m[2], id: `xh-${i++}`, line: ln })
  })
  return out
}

/** 标签提取（正文 #标签，跳过代码块与标题行） */
export function extractTags(src: string): string[] {
  const tags = new Set<string>()
  let inCode = false
  for (const line of src.split('\n')) {
    if (/^\s*```/.test(line)) { inCode = !inCode; continue }
    if (inCode || /^#{1,6}\s/.test(line)) continue
    const re = /(^|[\s(（【\[,，:：])#([^\s#`'"。，！？；：、\)）】]{1,30})/g
    let m: RegExpExecArray | null
    while ((m = re.exec(line))) tags.add(m[2])
  }
  return Array.from(tags)
}

/** 反链：引用 title 的全部笔记（含上下文片段） */
export function buildBacklinks(
  lib: Record<string, { content: string }>,
  currentPath: string,
  title: string
): { source: string; sourceTitle: string; snippets: string[] }[] {
  const res: { source: string; sourceTitle: string; snippets: string[] }[] = []
  for (const [path, meta] of Object.entries(lib)) {
    if (path === currentPath) continue // 自引用过滤
    const snippets: string[] = []
    const re = new RegExp(`\\[\\[\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\s*(?:\\|[^\]]+)?\\]\\]`, 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(meta.content))) {
      const start = Math.max(0, m.index - 20)
      const frag = meta.content.slice(start, m.index + m[0].length + 20).replace(/\s+/g, ' ').trim()
      snippets.push(frag)
      if (snippets.length >= 3) break
    }
    if (snippets.length) res.push({ source: path, sourceTitle: path.split('/').pop()!.replace(/\.md$/i, ''), snippets })
  }
  return res
}

/** 从全库内容提取 [[目标]] 集合（图谱用） */
export function extractWikiTargets(src: string): string[] {
  const out: string[] = []
  const re = /\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) out.push(m[1].trim())
  return out
}

export type { Tokens }
