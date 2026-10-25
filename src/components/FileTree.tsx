// ===== 文件树（展开/选中/重命名/删除/拖拽排序） =====
import React, { useState } from 'react'
import type { TreeItem } from '../types'
import { askMenu } from './AskModal'

interface Props {
  items: TreeItem[]
  activePath: string | null
  order: string[]
  onOpen(path: string): void
  onRename(path: string, isDir: boolean): void
  onDelete(path: string, isDir: boolean): void
  onNewFile(dirPath: string): void
  onNewDir(dirPath: string): void
  onDrop(dragged: string, target: string): void
  expanded: Set<string>
  onToggleDir(path: string): void
}

export function FileTree(props: Props) {
  return (
    <ul className="filetree">
      {props.items.map(it => <Node key={it.path} {...props} item={it} depth={0} />)}
    </ul>
  )
}

function Node(p: Props & { item: TreeItem; depth: number }) {
  const { item } = p
  const [dropHint, setDropHint] = useState<'none' | 'into' | 'before'>('none')
  const isDir = item.type === 'dir'
  const isOpen = p.expanded.has(item.path)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    const dragged = e.dataTransfer.getData('text/xnote-path')
    setDropHint('none')
    if (dragged && dragged !== item.path) p.onDrop(dragged, item.path)
  }

  return (
    <li>
      <div
        className={`tree-node ${p.activePath === item.path ? 'active' : ''} ${dropHint !== 'none' ? 'drop-' + dropHint : ''}`}
        style={{ paddingLeft: 8 + p.depth * 16 }}
        draggable
        onDragStart={e => { e.dataTransfer.setData('text/xnote-path', item.path); e.dataTransfer.effectAllowed = 'move' }}
        onDragOver={e => {
          e.preventDefault()
          e.stopPropagation()
          setDropHint(isDir ? 'into' : 'before')
        }}
        onDragLeave={() => setDropHint('none')}
        onDrop={handleDrop}
        onClick={() => { isDir ? p.onToggleDir(item.path) : p.onOpen(item.path) }}
        onContextMenu={async e => {
          e.preventDefault()
          const items = [
            { id: 'rename', label: '✏️ 重命名' },
            { id: 'delete', label: '🗑 删除', danger: true },
            ...(isDir ? [
              { id: 'newfile', label: '📄 新建笔记' },
              { id: 'newdir', label: '📁 新建文件夹' }
            ] : [])
          ]
          const act = await askMenu(`「${item.name}」`, items)
          if (act === 'rename') p.onRename(item.path, isDir)
          else if (act === 'delete') p.onDelete(item.path, isDir)
          else if (isDir && act === 'newfile') p.onNewFile(item.path)
          else if (isDir && act === 'newdir') p.onNewDir(item.path)
        }}
      >
        <span className="tree-icon">{isDir ? (isOpen ? '📂' : '📁') : '📄'}</span>
        <span className="tree-name">{item.name}</span>
      </div>
      {isDir && isOpen && item.children && (
        <ul className="filetree">
          {item.children.map(c => <Node key={c.path} {...p} item={c} depth={p.depth + 1} />)}
        </ul>
      )}
    </li>
  )
}
