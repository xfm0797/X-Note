// ===== 设置面板（外观 + 插件设置 + 外部插件（.zip 安装）+ 插件中心 + 自动更新） =====
import React, { useEffect, useRef, useState } from 'react'
import type { Settings } from '../types'
import type { PluginSettingsPanel } from '../plugins/types'
import {
  scanExternalPlugins, removeExternalPlugin, setExternalDisabled, loadExternalPlugin,
  installZipPlugin, installFromMarket, fetchMarketIndex, getMarketUrl, setMarketUrl, DEFAULT_MARKET_URL,
  type ExternalPluginEntry, type MarketEntry
} from '../plugins/external'
import { askConfirm, appToast } from './AskModal'
import { isTauri, getLibraryRoot, ensureLibraryDirs } from '../lib/storage'
import { getCurrentVersion, checkForUpdate, downloadAndInstall, relaunchApp, type UpdateState } from '../lib/updater'

interface Props {
  settings: Settings
  onChange(patch: Partial<Settings>): void
  panels: PluginSettingsPanel[]
  onReloadExternal(): void
  onClose(): void
  /** 打开时定位到指定区块（'sync' → 云同步面板；'plugins' → 外部插件区） */
  initialSection?: 'sync' | 'plugins'
}

export function SettingsModal(p: Props) {
  const [extList, setExtList] = useState<ExternalPluginEntry[] | null>(null)
  const [extBusy, setExtBusy] = useState(false)
  const [pluginDir, setPluginDir] = useState<string>('')

  // 定位到指定区块（菜单「设置 → 同步」「插件 → 插件中心」直达）
  useEffect(() => {
    if (!p.initialSection) return
    const t = setTimeout(() => {
      let el: Element | undefined
      if (p.initialSection === 'sync') {
        el = [...document.querySelectorAll('.plugin-panel-title')]
          .find(e => (e.textContent || '').includes('云同步'))
      } else {
        el = [...document.querySelectorAll('.settings-section .section-title')]
          .find(e => (e.textContent || '').includes('外部插件'))
      }
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => clearTimeout(t)
  }, [p.initialSection])

  // .zip 安装
  const zipInputRef = useRef<HTMLInputElement>(null)
  const [zipBusy, setZipBusy] = useState(false)

  // 插件中心
  const [marketUrl, setMarketUrlState] = useState(getMarketUrl())
  const [marketList, setMarketList] = useState<MarketEntry[] | null>(null)
  const [marketErr, setMarketErr] = useState('')
  const [marketBusy, setMarketBusy] = useState(false)
  const [installingId, setInstallingId] = useState('')

  // 自动更新
  const [updateState, setUpdateState] = useState<UpdateState>({ kind: 'idle' })
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    ;(async () => {
      if (!isTauri()) return
      const root = await getLibraryRoot()
      if (root) setPluginDir(`${root}\\.xnote-plugins`)
    })()
    getCurrentVersion().then(setAppVersion)
    setUpdateState(isTauri() ? { kind: 'idle' } : { kind: 'unavailable' })
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

  /* ---------- .zip 安装 ---------- */
  const onZipPick = async (file: File) => {
    setZipBusy(true)
    try {
      const buf = new Uint8Array(await file.arrayBuffer())
      const r = await installZipPlugin(buf)
      appToast(`插件已安装：${r.name} v${r.version}（${r.files} 个文件 → ${r.dir}/）`, 'success')
      p.onReloadExternal()
      await loadExt()
    } catch (e) {
      appToast(`安装失败：${String(e).replace(/^Error:\s*/, '')}`, 'error')
    } finally {
      setZipBusy(false)
      if (zipInputRef.current) zipInputRef.current.value = ''
    }
  }

  /* ---------- 插件中心 ---------- */
  const loadMarket = async (url = marketUrl) => {
    setMarketBusy(true); setMarketErr('')
    try {
      setMarketList(await fetchMarketIndex(url))
    } catch (e) {
      setMarketList(null)
      setMarketErr(String(e).replace(/^Error:\s*/, '') + '（GitHub/Gitee raw 均支持跨域；Gitee 注意仓库需公开）')
    } finally { setMarketBusy(false) }
  }
  const installMarket = async (entry: MarketEntry) => {
    setInstallingId(entry.id)
    try {
      const r = await installFromMarket(entry)
      appToast(`已从插件中心安装：${r.name} v${r.version}`, 'success')
      p.onReloadExternal()
      await loadExt()
    } catch (e) {
      appToast(`安装失败：${String(e).replace(/^Error:\s*/, '')}`, 'error')
    } finally { setInstallingId('') }
  }

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
            <button className="mini-btn" disabled={zipBusy} onClick={() => zipInputRef.current?.click()}>
              {zipBusy ? '安装中…' : '⬆ 安装 .zip 插件包'}
            </button>
            <button className="mini-btn" onClick={reloadDir} title="重新扫描 .xnote-plugins/ 目录">↻ 重载插件目录</button>
            {isTauri() && <button className="mini-btn" onClick={async () => { await ensureLibraryDirs(); appToast('已确保插件目录存在：.xnote-plugins', 'success') }}>创建插件目录</button>}
            <button className="mini-btn" onClick={() => { setExternalDisabled(true); p.onReloadExternal(); appToast('已停用全部外部插件', 'success') }}>一键停用</button>
            <input ref={zipInputRef} type="file" accept=".zip" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) void onZipPick(f) }} />
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
            {!(extList || []).length && <li className="empty">插件目录为空（上传 .zip 插件包、从插件中心安装，或复制插件到 .xnote-plugins/ 后重载）</li>}
          </ul>
          <div className="panel-warn">安全提示：外部插件以应用的完整权限执行代码，请仅安装信任来源的插件。</div>
        </div>

        <div className="settings-section">
          <div className="section-title">插件中心
            <button className="mini-btn" disabled={marketBusy} onClick={() => void loadMarket()}>{marketBusy ? '加载中…' : '↻ 刷新列表'}</button>
          </div>
          <div className="market-url">
            <input value={marketUrl} onChange={e => setMarketUrlState(e.target.value)}
              placeholder="插件中心索引地址（GitHub / Gitee raw 的 index.json）" />
            <button className="mini-btn" onClick={() => { setMarketUrl(marketUrl); void loadMarket(marketUrl) }}>保存源</button>
            <button className="mini-btn" onClick={() => { setMarketUrlState(DEFAULT_MARKET_URL); setMarketUrl(DEFAULT_MARKET_URL); void loadMarket(DEFAULT_MARKET_URL) }}>恢复默认</button>
          </div>
          <div className="panel-help">
            自建插件中心：新建一个 GitHub / Gitee 公开仓库，放入 <code>index.json</code>（数组，每项含 id / name / version / zip 下载地址），
            把各插件的 .zip 上传到仓库 Release 或直接提交到仓库，把 raw 地址填到上面即可。
          </div>
          {marketErr && <div className="panel-warn">{marketErr}</div>}
          <ul className="ext-list">
            {(marketList || []).map(entry => (
              <li key={entry.id}>
                <div>
                  <b>{entry.name}</b> <span className="ext-ver">v{entry.version}</span>
                  {entry.author && <span className="ext-ok"> · {entry.author}</span>}
                  <div className="ext-desc">{entry.description}</div>
                </div>
                <button className="mini-btn primary" disabled={installingId === entry.id}
                  onClick={() => void installMarket(entry)}>
                  {installingId === entry.id ? '安装中…' : '安装'}
                </button>
              </li>
            ))}
            {marketList && !marketList.length && <li className="empty">插件中心为空</li>}
            {!marketList && !marketBusy && !marketErr && <li className="empty">点击「刷新列表」从插件中心拉取可安装插件</li>}
          </ul>
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

export { loadExternalPlugin }
