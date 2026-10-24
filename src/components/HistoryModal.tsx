// ===== 版本历史面板（快照列表 / 查看 / diff 对比当前 / 恢复） =====
import React, { useMemo, useState } from 'react'
import type { HistorySnapshot, DiffRow } from '../types'
import { diffLines, diffStats } from '../lib/diff'
import { renderMarkdown } from '../lib/markdown'

interface Props {
  snapshots: HistorySnapshot[]
  currentContent: string
  currentTitle: string
  onRestore(content: string): void
  onClose(): void
}

export function HistoryModal({ snapshots, currentContent, currentTitle, onRestore, onClose }: Props) {
  const [viewing, setViewing] = useState<number | null>(null) // 快照索引
  const [mode, setMode] = useState<'preview' | 'diff'>('preview')

  const diffRows: DiffRow[] | null = useMemo(() => {
    if (viewing === null || mode !== 'diff') return null
    return diffLines(snapshots[viewing].content, currentContent)
  }, [viewing, mode, snapshots, currentContent])

  const stats = diffRows ? diffStats(diffRows) : null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal history-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">版本历史 — {currentTitle}</div>
        <div className="history-layout">
          <ul className="history-list">
            {snapshots.map((s, i) => (
              <li key={s.ts} className={viewing === i ? 'active' : ''} onClick={() => setViewing(i)}>
                <span className="hl-time">{new Date(s.ts).toLocaleString('zh-CN')}</span>
                <span className="hl-size">{s.content.length} 字</span>
              </li>
            ))}
            {!snapshots.length && <li className="empty">暂无历史快照（保存时自动记录）</li>}
          </ul>
          <div className="history-view">
            {viewing === null && <div className="empty" style={{ padding: 40 }}>左侧选择一个版本</div>}
            {viewing !== null && (
              <>
                <div className="history-toolbar">
                  <button className={`btn ${mode === 'preview' ? 'primary' : ''}`} onClick={() => setMode('preview')}>查看</button>
                  <button className={`btn ${mode === 'diff' ? 'primary' : ''}`} onClick={() => setMode('diff')}>对比当前</button>
                  <button className="btn" onClick={() => { onRestore(snapshots[viewing].content); onClose() }}>恢复此版本</button>
                  {stats && (
                    <span className="diff-stats">
                      <span className="d-add">+{stats.added}</span> / <span className="d-del">−{stats.removed}</span>
                    </span>
                  )}
                </div>
                {mode === 'preview'
                  ? <div className="md-body history-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(snapshots[viewing].content) }} />
                  : (
                    <div className="diff-view">
                      {diffRows!.map((r, i) => (
                        <div key={i} className={`diff-row ${r.type}`}>{r.type === 'add' ? '+' : r.type === 'del' ? '−' : ' '}{r.text}</div>
                      ))}
                    </div>
                  )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
