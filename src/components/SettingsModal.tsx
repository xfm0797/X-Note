// ===== 设置面板（外观 + 自动更新）；插件相关已移至插件中心弹窗 =====
import React, { useEffect, useState } from 'react'
import type { Settings } from '../types'
import { appToast } from './AskModal'
import { isTauri } from '../lib/storage'
import { getCurrentVersion, checkForUpdate, downloadAndInstall, relaunchApp, type UpdateState } from '../lib/updater'

interface Props {
  settings: Settings
  onChange(patch: Partial<Settings>): void
  onClose(): void
}

export function SettingsModal(p: Props) {
  // 自动更新
  const [updateState, setUpdateState] = useState<UpdateState>({ kind: 'idle' })
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    getCurrentVersion().then(setAppVersion)
    setUpdateState(isTauri() ? { kind: 'idle' } : { kind: 'unavailable' })
  }, [])

  /* ---------- 自动更新 ---------- */
  const runCheck = async () => {
    setUpdateState({ kind: 'checking' })
    try {
      const info = await checkForUpdate()
      setUpdateState(info ? { kind: 'available', info } : { kind: 'up-to-date', currentVersion: appVersion })
    } catch (e) {
      setUpdateState({ kind: 'error', message: String(e).replace(/^Error:\s*/, '') })
    }
  }
  const runInstall = async () => {
    setUpdateState(s => s.kind === 'available' ? { kind: 'downloading', progress: '0%' } : s)
    try {
      await downloadAndInstall(progress => {
        setUpdateState(s => s.kind === 'downloading' ? { kind: 'downloading', progress } : s)
      })
      setUpdateState({ kind: 'ready', version: 'new' })
      appToast('更新已安装，重启应用后生效', 'success')
    } catch (e) {
      setUpdateState({ kind: 'error', message: String(e).replace(/^Error:\s*/, '') })
    }
  }

  const updateLine = (() => {
    switch (updateState.kind) {
      case 'unavailable': return '浏览器预览模式不支持自动更新（桌面端可用）'
      case 'idle': return `当前版本 v${appVersion}${isTauri() ? ' · 启动时可手动检查更新' : ''}`
      case 'checking': return '正在检查更新…'
      case 'up-to-date': return `已是最新版本（v${updateState.currentVersion}）`
      case 'available': return `发现新版本 v${updateState.info.version}${updateState.info.notes ? `：${updateState.info.notes}` : ''}`
      case 'downloading': return `正在下载更新… ${updateState.progress}`
      case 'ready': return '更新已安装，重启后生效'
      case 'error': return `检查/安装失败：${updateState.message}`
    }
  })()

  return (
    <div className="modal-overlay" onClick={p.onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">设置</div>

        <div className="settings-section">
          <div className="section-title">外观</div>
          <label>主题：
            <select value={p.settings.theme} onChange={e => p.onChange({ theme: e.target.value as any })}>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
              <option value="system">跟随系统</option>
            </select>
          </label>
          <label>字号：
            <input type="range" min={12} max={24} value={p.settings.fontSize}
              onChange={e => p.onChange({ fontSize: Number(e.target.value) })} />
            <span>{p.settings.fontSize}px</span>
          </label>
          <label>字体：
            <select value={p.settings.fontFamily} onChange={e => p.onChange({ fontFamily: e.target.value })}>
              <option value="Consolas, 'Courier New', monospace">等宽 (Consolas)</option>
              <option value="-apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif">系统默认</option>
              <option value="Georgia, 'Times New Roman', serif">衬线 (Georgia)</option>
              <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
            </select>
          </label>
          <label>默认导出格式：
            <select value={p.settings.exportFormat} onChange={e => p.onChange({ exportFormat: e.target.value as any })}>
              <option value="md">Markdown</option>
              <option value="html">HTML</option>
              <option value="pdf">PDF</option>
            </select>
          </label>
        </div>

        <div className="settings-section">
          <div className="section-title">自动更新
            {updateState.kind === 'available' && (
              <button className="mini-btn primary" onClick={() => void runInstall()}>下载并安装</button>
            )}
            {updateState.kind === 'ready' && (
              <button className="mini-btn primary" onClick={() => void relaunchApp()}>重启应用</button>
            )}
            {updateState.kind !== 'available' && updateState.kind !== 'ready' && (
              <button className="mini-btn" disabled={!isTauri() || updateState.kind === 'checking' || updateState.kind === 'downloading'}
                onClick={() => void runCheck()}>
                {updateState.kind === 'checking' || updateState.kind === 'downloading' ? '请稍候…' : '检查更新'}
              </button>
            )}
          </div>
          <div className="panel-help">{updateLine}</div>
        </div>

        <div className="modal-btns"><button className="btn primary" onClick={p.onClose}>完成</button></div>
      </div>
    </div>
  )
}
