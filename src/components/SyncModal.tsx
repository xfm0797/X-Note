// ===== 云同步弹窗（插件菜单 → 同步… 直达） =====
import React from 'react'
import type { PluginSettingsPanel } from '../plugins/types'

interface Props {
  panels: PluginSettingsPanel[]
  onClose(): void
}

export function SyncModal(p: Props) {
  // 云同步是内置插件，其设置面板由 host 注册（id: cloudSync）
  const panel = p.panels.find(x => x.id === 'cloudSync') || p.panels.find(x => (x.title || '').includes('云同步'))

  return (
    <div className="modal-overlay" onClick={p.onClose}>
      <div className="modal settings-modal sync-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">云同步</div>
        {panel
          ? panel.render()
          : <div className="panel-warn">云同步插件未加载（请在插件中心重载插件目录）</div>}
        <div className="modal-btns"><button className="btn primary" onClick={p.onClose}>完成</button></div>
      </div>
    </div>
  )
}
