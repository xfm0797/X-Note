// ===== 实时预览（代码高亮着色 + Mermaid + 双向链接点击） =====
import React, { useEffect, useRef, useState } from 'react'
import { renderMarkdown } from '../lib/markdown'

interface Props {
  content: string
  wikiTitles: Set<string>
  fontSize: number
  onOpenWiki(title: string): void
  scrollTargetId: string | null
}

let mermaidReady: Promise<any> | null = null
function getMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then(m => {
      m.default.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' })
      return m.default
    })
  }
  return mermaidReady
}

let mermaidSeq = 0

export function Preview(p: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [html] = useState('')

  // 渲染 + Mermaid 后处理
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = renderMarkdown(p.content, p.wikiTitles)

    // mermaid 代码块
    const blocks = el.querySelectorAll('pre code.language-mermaid')
    if (blocks.length) {
      getMermaid().then(mm => {
        blocks.forEach(code => {
          const src = code.textContent || ''
          const holder = document.createElement('div')
          holder.className = 'mermaid-chart'
          mm.render(`mmd-${++mermaidSeq}`, src).then(({ svg }: any) => {
            holder.innerHTML = svg
            code.closest('pre')?.replaceWith(holder)
          }).catch(() => { /* 语法错误时保留源码块 */ })
        })
      })
    }

    // 简单代码高亮着色（关键字/字符串/注释）
    el.querySelectorAll('pre code:not(.language-mermaid)').forEach(code => {
      const h = code as HTMLElement
      if (h.dataset.hl) return
      h.dataset.hl = '1'
      h.innerHTML = highlight(h.textContent || '')
    })

    // 双向链接点击
    const onClk = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a.wikilink') as HTMLElement | null
      if (a) { e.preventDefault(); p.onOpenWiki(a.dataset.wiki!) }
    }
    el.addEventListener('click', onClk)
    return () => el.removeEventListener('click', onClk)
  }, [p.content, p.wikiTitles])

  // 大纲跳转定位
  useEffect(() => {
    if (p.scrollTargetId && ref.current) {
      const t = ref.current.querySelector(`#${p.scrollTargetId}`)
      t?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [p.scrollTargetId])

  return (
    <div className="preview-pane">
      <div ref={ref} className="md-body" style={{ fontSize: p.fontSize * 1.05 }} />
      {/* html 由上方 effect 注入，占位避免空 */}
      {html ? null : null}
    </div>
  )
}

/** 极简语法着色（注释 / 字符串 / 关键字 / 数字） */
function highlight(src: string): string {
  const esc = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const kws = 'const|let|var|function|return|if|else|for|while|import|export|from|class|extends|new|await|async|def|print|true|false|null|None|undefined|this|self'
  return esc
    .replace(/(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>')
    .replace(/(&quot;|&#39;|"|'|`)((?:(?!\1)[\s\S])*)\1/g, '<span class="hl-string">$1$2$1</span>')
    .replace(new RegExp(`\\b(${kws})\\b`, 'g'), '<span class="hl-keyword">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="hl-number">$1</span>')
}
