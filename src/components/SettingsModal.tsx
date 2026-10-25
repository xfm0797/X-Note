// ===== 设置面板（主题、字号、默认导出格式、字体 + 插件设置分区 + 外部插件管理） =====
import React, { useEffect, useState } from 'react'
import type { Settings } from '../types'
import type { PluginSettingsPanel } from '../plugins/types'
import { scanExternalPlugins, removeExternalPlugin, setExternalDisabled, loadExternalPlugin, type ExternalPluginEntry } from '../plugins/external'
import { askConfirm, appToast } from './AskModal'
import { isTauri, getLibraryRoot, ensureLibraryDirs } from '../lib/storage'

interface Props {
  settings: Settings
  onChange(patch: Partial<Settings>): void
  panels: PluginSettingsPanel[]
  onReloadExternal(): void
  onClose(): void
}

export function SettingsModal(p: Props) {
  const [extList, setExtList] = useState<ExternalPluginEntry[] | null>(null)
  const [extBusy, setExtBusy] = useState(false)
  const [pluginDir, setPluginDir] = useState<string>('')

  useEffect(() => {
    ;(async () => {
      if (!isTauri()) return
      const root = await getLibraryRoot()
      if (root) setPluginDir(`${root}\\.xnote-plugins`)
    })()
  }, [])

  const loadExt = async () => {
    setExtBusy(true)
    setExtList(await scanExternalPlugins())
    setExtBusy(false)
  }
  if (extList === null && !extBusy) { loadExt() }

  const reloadDir = async () => {
    setExternalDisabled(false)
    p.onReloadExternal()
    await loadExt()
  }

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

        {p.panels.length > 0 && (
          <div className="settings-section">
            <div className="section-title">插件</div>
            {p.panels.map(panel => (
              <div className="plugin-panel-wrap" key={panel.id}>
                <div className="plugin-panel-title">{panel.title}</div>
                {panel.render()}
              </div>
            ))}
          </div>
        )}

        <div className="settings-section">
          <div className="section-title">外部插件
            <button className="mini-btn" onClick={reloadDir} title="重新扫描 .xnote-plugins/ 目录">↻ 重载插件目录</button>
            {isTauri() && <button className="mini-btn" onClick={async () => { await ensureLibraryDirs(); appToast('已确保插件目录存在：.xnote-plugins', 'success') }}>创建插件目录</button>}
            <button className="mini-btn" onClick={() => { setExternalDisabled(true); p.onReloadExternal(); appToast('已停用全部外部插件', 'success') }}>一键停用</button>
          </div>
          {isTauri() && (
            <div className="ext-path">
              {pluginDir
                ? <>插件目录：<code>{pluginDir}</code>（每个插件一个子目录，含 plugin.json + main.js）</>
                : '请先选择笔记库'}
            </div>
          )}
          <ul className="ext-list">
            {(extList || []).map(e => (
              <li key={e.dir}>
                <div>
                  <b>{e.manifest.name}</b> <span className="ext-ver">v{e.manifest.version}</span>
                  {e.error ? <span className="ext-err"> · 加载失败：{e.error}</span> : <span className="ext-ok"> · 已加载</span>}
                  <div className="ext-desc">{e.manifest.description}</div>
                </div>
                <button className="mini-btn danger" onClick={async () => {
                  if (!(await askConfirm(`移除插件 ${e.dir}？`, true))) return
                  removeExternalPlugin(e.dir)
                  // 桌面端同时删除真实目录
                  try {
                    const { isTauri } = await import('../lib/storage')
                    if (isTauri()) {
                      const fs = await import('@tauri-apps/plugin-fs')
                      const { getLibraryRoot } = await import('../lib/storage')
                      const root = await getLibraryRoot()
                      if (root) await fs.remove(`${root}/.xnote-plugins/${e.dir}`, { recursive: true })
                    }
                  } catch { /* ignore */ }
                  p.onReloadExternal()
                  await loadExt()
                }}>移除</button>
              </li>
            ))}
            {!(extList || []).length && <li className="empty">插件目录为空（复制插件到笔记库 .xnote-plugins/ 后重载）</li>}
          </ul>
          <div className="panel-warn">安全提示：外部插件以应用的完整权限执行代码，请仅安装信任来源的插件。</div>
        </div>

        <div className="modal-btns"><button className="btn primary" onClick={p.onClose}>完成</button></div>
      </div>
    </div>
  )
}

export { loadExternalPlugin }
