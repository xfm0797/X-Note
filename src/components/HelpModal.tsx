// ===== Markdown 语法帮助弹窗（设置 → 帮助…）：原文与实时渲染效果并排 =====
import React from 'react'
import { renderMarkdown } from '../lib/markdown'

/** 每节：语法原文 + 渲染效果（mermaid 只展示源码，附说明） */
const SECTIONS: { title: string; code: string; note?: string }[] = [
  {
    title: '标题',
    code: '# 一级标题\n## 二级标题\n### 三级标题\n#### 四级标题',
  },
  {
    title: '强调与行内代码',
    code: '**粗体**  *斜体*  ***粗斜体***  ~~删除线~~  `行内代码`',
  },
  {
    title: '列表（无序 / 有序 / 任务）',
    code: '- 无序列表项\n- 另一项\n  - 子项（缩进 2 空格）\n\n1. 有序列表\n2. 第二项\n\n- [ ] 待办任务\n- [x] 已完成任务',
  },
  {
    title: '引用',
    code: '> 这是一段引用\n> 可以有多行\n>> 支持嵌套引用',
  },
  {
    title: '代码块',
    code: '```js\n// 支持 js/ts/python/go/rust 等语言的简单高亮\nfunction greet(name) {\n  return `Hello, ${name}!`\n}\n```',
  },
  {
    title: '表格',
    code: '| 语法 | 说明 | 默认 |\n| --- | --- | :---: |\n| GFM 表格 | 管道分隔 | 支持 |\n| 对齐 | --- 左 :---: 中 ---: 右 | - |',
  },
  {
    title: '链接与图片',
    code: '[链接文字](https://example.com)\n\n![图片描述](https://example.com/image.png)',
  },
  {
    title: '分隔线',
    code: '上方内容\n\n---\n\n下方内容',
  },
  {
    title: '换行',
    code: '第一行\n第二行（单个回车即换行）\n\n空一行才是新段落',
    note: 'X-Note 开启了 GFM breaks：单个回车直接换行，无需行尾补两个空格。',
  },
  {
    title: '数学公式（KaTeX）',
    code: '行内公式：质能方程 $E = mc^2$ 写在句子中间。\n\n$$\n\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}\n$$',
  },
  {
    title: '双向链接',
    code: '链接到 [[另一篇笔记]]\n使用别名 [[另一篇笔记|显示文字]]',
    note: '[[笔记名]] 会链接到库内同名笔记；未创建的笔记显示为灰色，点击即可打开/创建。',
  },
  {
    title: '标签',
    code: '这句话包含一个标签：#随笔 记录今天的心情。',
    note: '正文中的 #标签 会被自动提取到侧栏标签过滤区（标题行与代码块内不生效）。',
  },
  {
    title: 'Mermaid 图表',
    code: '```mermaid\ngraph LR\n  A[开始] --> B{判断}\n  B -->|是| C[执行]\n  B -->|否| D[结束]\n```',
    note: 'mermaid 代码块在预览中自动渲染为流程图 / 时序图 / 甘特图等，此处仅展示源码。',
  },
]

export function HelpModal({ onClose }: { onClose(): void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal help-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Markdown 语法帮助</div>
        <div className="panel-help">
          以下为 X-Note 预览支持的 Markdown 语法。左侧为写法原文，右侧为实际渲染效果。
        </div>

        {SECTIONS.map(s => (
          <div className="settings-section" key={s.title}>
            <div className="section-title">{s.title}</div>
            {s.note && <div className="panel-help">{s.note}</div>}
            <div className="help-grid">
              <pre className="help-src">{s.code}</pre>
              <div className="md-body help-preview"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(s.code) }} />
            </div>
          </div>
        ))}

        <div className="modal-btns"><button className="btn primary" onClick={onClose}>完成</button></div>
      </div>
    </div>
  )
}
