// ===== 插件自定义弹窗外壳（ctx.ui.showDialog 的渲染端）=====
import React, { useEffect } from 'react'
import type { PluginDialog } from '../plugins/types'

interface Props {
  dialog: PluginDialog
  onClose(): void
}

export function PluginModal({ dialog, onClose }: Props) {
  // Esc 关闭（注册在捕获阶段之前不影响编辑器自身的快捷键）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // 弹窗内部各插件自行渲染，这里只负责外壳：标题 / 宽度 / 关闭 / 滚动
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal plugin-modal"
        style={{ width: dialog.width ?? 720 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-title">
          {dialog.title}
          {dialog.subtitle && <span className="modal-sub">{dialog.subtitle}</span>}
          <button className="plugin-modal-close" title="关闭（Esc）" onClick={onClose}>✕</button>
        </div>
        <div className="plugin-modal-body">{dialog.render()}</div>
      </div>
    </div>
  )
}
