// ===== 插件设置弹窗：只放各插件的配置面板，与「插件中心」（安装/更新/卸载）分离 =====
import React from 'react'
import type { PluginSettingsPanel } from '../plugins/types'

interface Props {
  panels: PluginSettingsPanel[]
  onClose(): void
  /** 从设置面板跳去插件中心（没装插件时给个入口） */
  onOpenMarket?(): void
}

export function PluginSettingsModal({ panels, onClose, onOpenMarket }: Props) {
  // 云同步面板跟着「同步」弹窗走，这里不重复出现
  const list = panels.filter(x => x.id !== 'cloudSync')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">插件设置</div>

        {list.length === 0 ? (
          <div className="settings-section">
            <div className="empty" style={{ padding: '18px 0' }}>
              当前没有可配置的插件。已安装的插件如果提供设置面板，会出现在这里。
            </div>
            {onOpenMarket && (
              <div style={{ textAlign: 'center' }}>
                <button className="mini-btn primary" onClick={onOpenMarket}>去插件中心安装插件</button>
              </div>
            )}
          </div>
        ) : (
          <div className="settings-section">
            {list.map(panel => (
              <div className="plugin-panel-wrap" key={panel.id}>
                <div className="plugin-panel-title">{panel.title}</div>
                {panel.render()}
              </div>
            ))}
          </div>
        )}

        <div className="modal-btns"><button className="btn primary" onClick={onClose}>完成</button></div>
      </div>
    </div>
  )
}
