// ===== 顶栏（开始/编辑/设置/切换主题 菜单 + 视图切换 + 插件命令 + 侧栏折叠） =====
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
  onOpenSync(): void
  onOpenAbout(): void
  onCreateNote(): void
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

      {/* 开始：新建 / 打开 / 保存 */}
      <div className="dropdown-wrap">
        <button className="tb-btn">开始 ▾</button>
        <div className="dropdown-menu">
          <div onClick={p.onCreateNote}>新建笔记</div>
          <div onClick={p.onSelectFolder} title="选择本地笔记库文件夹（桌面端）">打开笔记库…</div>
          <div onClick={p.onSave}>{p.saving ? '⏳ 保存中…' : '保存 (Ctrl+S)'}</div>
        </div>
      </div>

      {/* 编辑：图谱 / 历史 / 导出 */}
      <div className="dropdown-wrap">
        <button className="tb-btn">编辑 ▾</button>
        <div className="dropdown-menu">
          <div onClick={p.onOpenGraph}>关系图谱</div>
          <div onClick={p.onOpenHistory}>版本历史</div>
          <div className="dropdown-sep" />
          <div onClick={() => p.onExport('md')}>导出 Markdown (.md)</div>
          <div onClick={() => p.onExport('html')}>导出 HTML (.html)</div>
          <div onClick={() => p.onExport('pdf')}>导出 PDF（打印）</div>
        </div>
      </div>

      {/* 设置：同步 / 设置 / 关于 */}
      <div className="dropdown-wrap">
        <button className="tb-btn">设置 ▾</button>
        <div className="dropdown-menu">
          <div onClick={p.onOpenSync}>同步</div>
          <div onClick={p.onOpenSettings}>设置</div>
          <div onClick={p.onOpenAbout}>关于</div>
        </div>
      </div>

      {/* 切换主题（顶层） */}
      <button className="tb-btn" onClick={p.onToggleTheme} title="切换浅色 / 深色主题">
        {p.theme === 'dark' ? '☀️ 切换主题' : '🌙 切换主题'}
      </button>

      {/* 插件注册的命令（如：同步） */}
      {p.pluginCommands.map(c => (
        <button key={c.id} className="tb-btn" onClick={c.run}>{c.title}</button>
      ))}
    </div>
  )
}
