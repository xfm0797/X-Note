// ===== 顶栏（视图切换、导出、主题、设置、插件命令、图谱、侧栏折叠、关于） =====
import React from 'react'
import type { ViewMode } from '../types'

interface Props {
  view: ViewMode
  theme: string
  sidebarVisible: boolean
  pluginCommands: { id: string; title: string; run: () => void }[]
  onView(v: ViewMode): void
  onToggleTheme(): void
  onToggleSidebar(): void
  onExport(format: 'md' | 'html' | 'pdf'): void
  onOpenGraph(): void
  onOpenHistory(): void
  onOpenSettings(): void
  onOpenAbout(): void
  onNewWindow(): void
  onSelectFolder(): void
  onSave(): void
  saving: boolean
}

export function Topbar(p: Props) {
  return (
    <div className="topbar">
      <button className="icon-btn" title="折叠侧栏 (可拖拽调宽)" onClick={p.onToggleSidebar}>☰</button>
      <span className="app-name">X-Note</span>
      <span className="app-sub">笔记</span>

      <div className="view-switch">
        {(['edit', 'split', 'preview'] as ViewMode[]).map(v => (
          <button key={v} className={p.view === v ? 'active' : ''} onClick={() => p.onView(v)}>
            {v === 'edit' ? '编辑' : v === 'split' ? '分屏' : '预览'}
          </button>
        ))}
      </div>

      <div className="topbar-flex" />

      <button className={`tb-btn save-btn ${p.saving ? 'saving' : ''}`} onClick={p.onSave} title="保存全部未保存内容 (Ctrl+S)">
        {p.saving ? '⏳ 保存中…' : '💾 保存'}
      </button>

      {p.pluginCommands.map(c => (
        <button key={c.id} className="tb-btn" onClick={c.run}>{c.title}</button>
      ))}

      <div className="dropdown-wrap">
        <button className="tb-btn">导出 ▾</button>
        <div className="dropdown-menu">
          <div onClick={() => p.onExport('md')}>导出 Markdown (.md)</div>
          <div onClick={() => p.onExport('html')}>导出 HTML (.html)</div>
          <div onClick={() => p.onExport('pdf')}>导出 PDF（打印）</div>
        </div>
      </div>

      <button className="tb-btn" onClick={p.onOpenGraph}>图谱</button>
      <button className="tb-btn" onClick={p.onOpenHistory}>历史</button>
      <button className="tb-btn" onClick={p.onNewWindow}>新窗</button>
      <button className="tb-btn" onClick={p.onSelectFolder} title="选择本地笔记库文件夹（桌面端）">📁</button>
      <button className="tb-btn" onClick={p.onOpenSettings}>设置</button>
      <button className="tb-btn" onClick={p.onToggleTheme} title="切换主题">{p.theme === 'dark' ? '☀️' : '🌙'}</button>
      <button className="tb-btn" onClick={p.onOpenAbout}>关于</button>
    </div>
  )
}
