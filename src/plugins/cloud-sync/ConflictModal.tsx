// ===== 云同步冲突解决面板（本地版 / 远端版 / 都保留） =====
import React from 'react'
import type { ConflictItem, ConflictChoice } from './sync'

interface Props {
  items: ConflictItem[]
  onResolve: (path: string, choice: ConflictChoice) => void
  onClose: () => void
}

export function ConflictModal({ items, onResolve, onClose }: Props) {
  if (!items.length) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal conflict-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">⚠ 检测到 {items.length} 个同步冲突</div>
        <div className="conflict-tip">同一文件两侧都修改过，请逐项选择保留版本：</div>
        {items.map(it => (
          <div className="conflict-item" key={it.path}>
            <div className="conflict-path">{it.path}</div>
            <div className="conflict-views">
              <pre className="conflict-view local">{it.local.slice(0, 500) || '（空）'}</pre>
              <pre className="conflict-view remote">{it.remote.slice(0, 500) || '（空）'}</pre>
            </div>
            <div className="conflict-btns">
              <button className="btn local" onClick={() => onResolve(it.path, 'local')}>保留本地版</button>
              <button className="btn remote" onClick={() => onResolve(it.path, 'remote')}>保留远端版</button>
              <button className="btn both" onClick={() => onResolve(it.path, 'both')}>都保留</button>
            </div>
          </div>
        ))}
        <div className="modal-btns"><button className="btn" onClick={onClose}>关闭</button></div>
      </div>
    </div>
  )
}
