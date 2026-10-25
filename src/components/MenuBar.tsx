// ===== 菜单栏（Notepad++ 风格：文件/编辑/搜索/视图/插件/设置） =====
import React, { useRef } from 'react'
import type { ViewMode } from '../types'
import type { EditOp } from '../lib/editOps'

interface Props {
  view: ViewMode
  theme: string
  sidebarVisible: boolean
  fontSize: number
  pluginCommands: { id: string; title: string; run: () => void }[]
  onView(v: ViewMode): void
  onZoom(delta: number): void            // ±1 字号，0 = 重置
  onToggleTheme(): void
  onToggleSidebar(): void
  onExport(format: 'md' | 'html' | 'pdf'): void
  onOpenGraph(): void
  onOpenHistory(): void
  onOpenSettings(): void
  onOpenSync(): void
  onOpenPlugins(): void
  onOpenAbout(): void
  onNewNote(): void
  onImportFiles(files: FileList | null): void
  onOpenLibrary(): void
  onSave(): void
  onEditOp(op: EditOp): void
  onFocusSearch(): void
  onGotoLine(): void
  onExit(): void
  saving: boolean
}

const CHECK = '✓ '

export function MenuBar(p: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const item = (label: string, fn: () => void, opts?: { checked?: boolean; hint?: string; disabled?: boolean }) => (
    <div
      key={label}
      className={opts?.disabled ? 'menu-item disabled' : 'menu-item'}
      onClick={() => { if (!opts?.disabled) fn() }}
    >
      <span className="menu-check">{opts?.checked ? CHECK : ''}</span>
      <span className="menu-label">{label}</span>
      {opts?.hint && <span className="menu-hint">{opts.hint}</span>}
    </div>
  )

  const menu = (name: string, body: React.ReactNode) => (
    <div className="dropdown-wrap menubar-item">
      <button className="menu-btn">{name}</button>
      <div className="dropdown-menu menubar-menu">{body}</div>
    </div>
  )

  return (
    <>
      <div className="topbar menubar">
        <button className="icon-btn" title="折叠侧栏 (可拖拽调宽)" onClick={p.onToggleSidebar}>☰</button>
        <span className="app-name">X-Note</span>

      {/* ── 文件 ── */}
      {menu('文件', <>
        {item('新建笔记', p.onNewNote, { hint: 'Ctrl+N' })}
        {item('导入 .md 文件…', () => fileInputRef.current?.click())}
        {item('打开笔记库…', p.onOpenLibrary)}
        <div className="dropdown-sep" />
        {item('保存', p.onSave, { hint: 'Ctrl+S', disabled: p.saving })}
        {item('导出为 Markdown', () => p.onExport('md'))}
        {item('导出为 HTML', () => p.onExport('html'))}
        {item('导出为 PDF（打印）', () => p.onExport('pdf'))}
        <div className="dropdown-sep" />
        {item('版本历史', p.onOpenHistory)}
        {item('退出', p.onExit)}
      </>)}

      {/* ── 编辑 ── */}
      {menu('编辑', <>
        {item('撤销', () => p.onEditOp('undo'), { hint: 'Ctrl+Z' })}
        {item('重做', () => p.onEditOp('redo'), { hint: 'Ctrl+Y' })}
        <div className="dropdown-sep" />
        {item('全选', () => p.onEditOp('select-all'))}
        {item('插入日期时间', () => p.onEditOp('insert-datetime'))}
        <div className="dropdown-sep" />
        {item('转为大写', () => p.onEditOp('upper'))}
        {item('转为小写', () => p.onEditOp('lower'))}
        <div className="dropdown-sep" />
        {item('复制当前行', () => p.onEditOp('dup-line'))}
        {item('删除当前行', () => p.onEditOp('del-line'))}
        {item('行上移', () => p.onEditOp('line-up'))}
        {item('行下移', () => p.onEditOp('line-down'))}
      </>)}

      {/* ── 搜索 ── */}
      {menu('搜索', <>
        {item('搜索笔记…', p.onFocusSearch, { hint: 'Ctrl+F' })}
        {item('跳转到行…', p.onGotoLine, { hint: 'Ctrl+G' })}
        <div className="dropdown-sep" />
        {item('标签过滤（侧栏）', p.onFocusSearch)}
      </>)}

      {/* ── 视图 ── */}
      {menu('视图', <>
        {item('编辑模式', () => p.onView('edit'), { checked: p.view === 'edit' })}
        {item('分屏', () => p.onView('split'), { checked: p.view === 'split' })}
        {item('预览', () => p.onView('preview'), { checked: p.view === 'preview' })}
        <div className="dropdown-sep" />
        {item('放大字体', () => p.onZoom(1), { hint: 'Ctrl+=' })}
        {item('缩小字体', () => p.onZoom(-1), { hint: 'Ctrl+-' })}
        {item(`恢复默认字号（${p.fontSize}px）`, () => p.onZoom(0))}
        <div className="dropdown-sep" />
        {item('显示侧栏', p.onToggleSidebar, { checked: p.sidebarVisible })}
        {item('关系图谱', p.onOpenGraph)}
      </>)}

      {/* ── 插件 ── */}
      {menu('插件', <>
        {p.pluginCommands.length === 0 && <div className="menu-item disabled"><span className="menu-check" /><span className="menu-label">（无已启用插件的命令）</span></div>}
        {p.pluginCommands.map(c => item(c.title, c.run))}
        <div className="dropdown-sep" />
        {item('插件中心…', p.onOpenPlugins)}
        {item('同步…', p.onOpenSync)}
      </>)}

      {/* ── 设置 ── */}
      {menu('设置', <>
        {item('设置…', p.onOpenSettings)}
        {item('切换主题（当前：' + (p.theme === 'dark' ? '深色' : '浅色') + '）', p.onToggleTheme)}
        <div className="dropdown-sep" />
        {item('关于 X-Note…', p.onOpenAbout)}
      </>)}
      </div>

      {/* ── 常用工具栏（菜单栏下方快捷按钮） ── */}
      <div className="topbar toolbar">
        <button className="tb-btn" title="新建笔记 (Ctrl+N)" onClick={p.onNewNote}>📄 新建</button>
        <button className="tb-btn" title="导入 .md 文件" onClick={() => fileInputRef.current?.click()}>📂 打开</button>
        <button className="tb-btn" title="打开笔记库文件夹" onClick={p.onOpenLibrary}>🗀 笔记库</button>
        <button className="tb-btn" title="保存 (Ctrl+S)" disabled={p.saving} onClick={p.onSave}>💾 保存</button>
        <div className="tb-sep" />
        <div className="view-switch" title="视图模式">
          <button className={p.view === 'edit' ? 'active' : ''} onClick={() => p.onView('edit')}>编辑</button>
          <button className={p.view === 'split' ? 'active' : ''} onClick={() => p.onView('split')}>分屏</button>
          <button className={p.view === 'preview' ? 'active' : ''} onClick={() => p.onView('preview')}>预览</button>
        </div>
        <div className="tb-sep" />
        <button className="tb-btn" title="搜索笔记 (Ctrl+F)" onClick={p.onFocusSearch}>🔍 搜索</button>
        <button className="tb-btn" title="版本历史" onClick={p.onOpenHistory}>🕘 历史</button>
        <button className="tb-btn" title="关系图谱" onClick={p.onOpenGraph}>🕸 图谱</button>
        <button className="tb-btn" title="插件中心" onClick={p.onOpenPlugins}>🧩 插件</button>
        <button className="tb-btn" title="云同步" onClick={p.onOpenSync}>☁ 同步</button>
        <span className="topbar-flex" />
        <button className="tb-btn" title={p.theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'} onClick={p.onToggleTheme}>{p.theme === 'dark' ? '☀️' : '🌙'}</button>
        <button className="tb-btn" title="设置" onClick={p.onOpenSettings}>⚙️ 设置</button>

        <input ref={fileInputRef} type="file" accept=".md" multiple style={{ display: 'none' }}
          onChange={e => { p.onImportFiles(e.target.files); e.target.value = '' }} />
      </div>
    </>
  )
}
