// ===== 侧边栏（库名、搜索、文件树、标签、大纲、反链） =====
import React, { useState } from 'react'
import type { TreeItem, Heading, Backlink } from '../types'
import { FileTree } from './FileTree'

interface Props {
  libName: string
  visible: boolean
  width: number
  tree: TreeItem[]
  order: string[]
  expanded: Set<string>
  activePath: string | null
  search: string
  searchResults: { path: string; snippet: string }[]
  tags: { tag: string; count: number }[]
  activeTag: string | null
  outline: Heading[]
  backlinks: Backlink[]
  onSearch(q: string): void
  onPickTag(tag: string | null): void
  onOpen(path: string): void
  onRename(path: string, isDir: boolean): void
  onDelete(path: string, isDir: boolean): void
  onNewFile(dirPath: string): void
  onNewDir(dirPath: string): void
  onDropNode(dragged: string, target: string): void
  onToggleDir(path: string): void
  onNewRootFile(): void
  onJumpHeading(h: Heading): void
  onOpenBacklink(path: string): void
  onResizeStart(e: React.MouseEvent): void
}

type PanelTab = 'tree' | 'tags' | 'outline' | 'backlinks'

export function Sidebar(p: Props) {
  const [tab, setTab] = useState<PanelTab>('tree')
  if (!p.visible) return null

  return (
    <div className="sidebar" style={{ width: p.width }}>
      <div className="sidebar-lib">
        <span className="lib-icon">📚</span>
        <span className="lib-name" title={p.libName}>{p.libName}</span>
        <button className="mini-btn" title="库根目录新建笔记" onClick={p.onNewRootFile}>＋</button>
      </div>

      <input
        className="sidebar-search"
        placeholder="全文搜索（标题 + 正文）…"
        value={p.search}
        onChange={e => p.onSearch(e.target.value)}
      />

      <div className="panel-tabs">
        <button className={tab === 'tree' ? 'active' : ''} onClick={() => setTab('tree')}>文件</button>
        <button className={tab === 'tags' ? 'active' : ''} onClick={() => setTab('tags')}>标签</button>
        <button className={tab === 'outline' ? 'active' : ''} onClick={() => setTab('outline')}>大纲</button>
        <button className={tab === 'backlinks' ? 'active' : ''} onClick={() => setTab('backlinks')}>反链</button>
      </div>

      <div className="sidebar-body">
        {tab === 'tree' && (
          p.search
            ? (
              <ul className="search-results">
                {p.searchResults.map(r => (
                  <li key={r.path} onClick={() => p.onOpen(r.path)}>
                    <div className="sr-title">{r.path}</div>
                    <div className="sr-snippet">{r.snippet}</div>
                  </li>
                ))}
                {!p.searchResults.length && <li className="empty">无匹配结果</li>}
              </ul>
            )
            : (
              <FileTree
                items={p.tree}
                activePath={p.activePath}
                order={p.order}
                expanded={p.expanded}
                onOpen={p.onOpen}
                onRename={p.onRename}
                onDelete={p.onDelete}
                onNewFile={p.onNewFile}
                onNewDir={p.onNewDir}
                onDrop={p.onDropNode}
                onToggleDir={p.onToggleDir}
              />
            )
        )}

        {tab === 'tags' && (
          <ul className="tag-list">
            <li className={!p.activeTag ? 'active' : ''} onClick={() => p.onPickTag(null)}>全部笔记</li>
            {p.tags.map(t => (
              <li key={t.tag} className={p.activeTag === t.tag ? 'active' : ''} onClick={() => p.onPickTag(t.tag)}>
                <span className="tag-name"># {t.tag}</span>
                <span className="tag-count">{t.count}</span>
              </li>
            ))}
            {!p.tags.length && <li className="empty">暂无标签（正文输入 #标签）</li>}
          </ul>
        )}

        {tab === 'outline' && (
          <ul className="outline-list">
            {p.outline.map(h => (
              <li key={h.id} style={{ paddingLeft: (h.level - 1) * 14 }} onClick={() => p.onJumpHeading(h)}>
                {h.text}
              </li>
            ))}
            {!p.outline.length && <li className="empty">当前笔记无标题</li>}
          </ul>
        )}

        {tab === 'backlinks' && (
          <ul className="backlink-list">
            {p.backlinks.map(b => (
              <li key={b.source} onClick={() => p.onOpenBacklink(b.source)}>
                <div className="bl-title">{b.sourceTitle} <span className="bl-count">{b.snippets.length}</span></div>
                {b.snippets.map((s, i) => <div className="bl-snippet" key={i}>…{s}…</div>)}
              </li>
            ))}
            {!p.backlinks.length && <li className="empty">暂无引用当前笔记</li>}
          </ul>
        )}
      </div>

      <div className="sidebar-resizer" onMouseDown={p.onResizeStart} />
    </div>
  )
}
