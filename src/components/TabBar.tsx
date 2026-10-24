// ===== 标签栏（多笔记标签，可拖拽排序） =====
import React, { useState } from 'react'
import { moveTab } from '../lib/tabs'

interface Props {
  tabs: string[]
  active: string | null
  titleOf(path: string): string
  onSelect(path: string): void
  onClose(path: string): void
  onOrderChange(tabs: string[]): void
}

export function TabBar(p: Props) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)

  if (!p.tabs.length) return <div className="tabbar" />

  return (
    <div className="tabbar">
      {p.tabs.map((path, i) => (
        <div
          key={path}
          className={`tab ${p.active === path ? 'active' : ''} ${dropIdx === i && dragIdx !== null ? 'drop-hint' : ''}`}
          draggable
          onDragStart={() => setDragIdx(i)}
          onDragOver={e => { e.preventDefault(); setDropIdx(i) }}
          onDragEnd={() => { setDragIdx(null); setDropIdx(null) }}
          onDrop={e => {
            e.preventDefault()
            if (dragIdx !== null && dragIdx !== i) p.onOrderChange(moveTab(p.tabs, dragIdx, i))
            setDragIdx(null); setDropIdx(null)
          }}
          onClick={() => p.onSelect(path)}
          title={path}
        >
          <span className="tab-title">{p.titleOf(path)}</span>
          <button className="tab-close" onClick={e => { e.stopPropagation(); p.onClose(path) }}>✕</button>
        </div>
      ))}
    </div>
  )
}
