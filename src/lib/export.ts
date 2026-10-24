// ===== 导入 / 导出（MD / HTML / PDF，含公式与流程图） =====

function download(name: string, content: string | Blob, type = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function htmlDoc(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<style>
  body { max-width: 860px; margin: 40px auto; padding: 0 24px; font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; line-height: 1.7; color: #1e1e1e; }
  pre { background: #f3f3f3; padding: 12px 14px; border-radius: 6px; overflow-x: auto; }
  code { font-family: Consolas, "Courier New", monospace; font-size: .9em; }
  blockquote { border-left: 4px solid #4a89dc; margin: .8em 0; padding: 6px 14px; background: #f8f9fb; color: #555; }
  table { border-collapse: collapse; } th, td { border: 1px solid #ccc; padding: 6px 12px; }
  th { background: #f0f0f0; }
  img { max-width: 100%; }
  .wikilink { color: #1a66b0; border-bottom: 1px dashed #1a66b0; text-decoration: none; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`
}

export function exportMarkdown(title: string, content: string) {
  download(`${title}.md`, content, 'text/markdown;charset=utf-8')
}

export function exportHtml(title: string, htmlBody: string) {
  download(`${title}.html`, htmlDoc(title, htmlBody), 'text/html;charset=utf-8')
}

/** PDF：打开打印窗口（保留公式 KaTeX 样式），由用户「另存为 PDF」 */
export function exportPdf(title: string, htmlBody: string) {
  const w = window.open('', '_blank', 'width=880,height=960')
  if (!w) return
  w.document.write(htmlDoc(title, htmlBody))
  w.document.close()
  w.onload = () => { setTimeout(() => w.print(), 600) }
  setTimeout(() => { try { w.print() } catch { /* ignore */ } }, 1200)
}

export function doExport(format: 'md' | 'html' | 'pdf', title: string, content: string, htmlBody: string) {
  if (format === 'md') exportMarkdown(title, content)
  else if (format === 'html') exportHtml(title, htmlBody)
  else exportPdf(title, htmlBody)
}
