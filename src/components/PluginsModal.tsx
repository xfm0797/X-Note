// ===== 插件中心：只管「装 / 更新 / 卸载」；插件的配置项在「插件设置」弹窗里 =====
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  scanExternalPlugins, uninstallExternalPlugin, setExternalDisabled,
  installZipPlugin, installFromMarket, fetchMarketIndex, getMarketUrl, setMarketUrl, DEFAULT_MARKET_URL,
  compareVersion,
  type ExternalPluginEntry, type MarketEntry
} from '../plugins/external'
import { askConfirm, appToast } from './AskModal'
import { isTauri, getLibraryRoot, ensureLibraryDirs } from '../lib/storage'

interface Props {
  onReloadExternal(): void
  onClose(): void
}

export function PluginsModal(p: Props) {
  const [extList, setExtList] = useState<ExternalPluginEntry[] | null>(null)
  const [extBusy, setExtBusy] = useState(false)
  const [pluginDir, setPluginDir] = useState<string>('')

  // .zip 安装
  const zipInputRef = useRef<HTMLInputElement>(null)
  const [zipBusy, setZipBusy] = useState(false)

  // 插件中心
  const [marketUrl, setMarketUrlState] = useState(getMarketUrl())
  const [marketList, setMarketList] = useState<MarketEntry[] | null>(null)
  const [marketSource, setMarketSource] = useState('')
  const [marketErr, setMarketErr] = useState('')
  const [marketBusy, setMarketBusy] = useState(false)
  const [busyId, setBusyId] = useState('')          // 正在安装/更新的插件 id
  const [keyword, setKeyword] = useState('')

  /** 已安装表：id → { version, dir } */
  const installed = new Map<string, { version: string; dir: string }>()
  for (const e of extList || []) {
    if (e.manifest?.id) installed.set(e.manifest.id, { version: e.manifest.version, dir: e.dir })
  }

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

  /* ---------- 安装 / 卸载 ---------- */
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

  const uninstall = async (dir: string, name: string) => {
    if (!(await askConfirm(`卸载插件「${name}」？会删除 .xnote-plugins/${dir} 目录，笔记内容不受影响。`, true))) return
    setBusyId(dir)
    try {
      await uninstallExternalPlugin(dir)
      appToast(`已卸载：${name}`, 'success')
    } catch (e) {
      appToast(String(e).replace(/^Error:\s*/, ''), 'error')
    } finally {
      setBusyId('')
      p.onReloadExternal()
      await loadExt()
    }
  }

  /* ---------- 插件中心 ---------- */
  const loadMarket = async (url = marketUrl) => {
    setMarketBusy(true); setMarketErr('')
    try {
      const r = await fetchMarketIndex(url)
      setMarketList(r.list)
      setMarketSource(r.source)
      if (r.failed.length) {
        appToast(`默认源不可用，已自动切到备用源（${new URL(r.source).host}）`, 'info')
      }
    } catch (e) {
      setMarketList(null)
      setMarketSource('')
      setMarketErr(String(e).replace(/^Error:\s*/, ''))
    } finally { setMarketBusy(false) }
  }
  const installMarket = async (entry: MarketEntry) => {
    const have = installed.get(entry.id)
    setBusyId(entry.id)
    try {
      const r = await installFromMarket(entry)
      appToast(have ? `已更新：${r.name} ${have.version} → v${r.version}` : `已安装：${r.name} v${r.version}`, 'success')
      p.onReloadExternal()
      await loadExt()
    } catch (e) {
      appToast(`安装失败：${String(e).replace(/^Error:\s*/, '')}`, 'error')
    } finally { setBusyId('') }
  }

  // 进入即拉取插件中心列表
  useEffect(() => { void loadMarket() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  const shown = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return marketList || []
    return (marketList || []).filter(e =>
      `${e.name} ${e.id} ${e.description || ''}`.toLowerCase().includes(kw))
  }, [marketList, keyword])

  /** 插件中心里还没上架的已装插件（本地 .zip 装的） */
  const onlyLocal = (extList || []).filter(e => !(marketList || []).some(m => m.id === e.manifest?.id))

  return (
    <div className="modal-overlay" onClick={p.onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">插件中心</div>

        {/* ── 已安装 ── */}
        <div className="settings-section">
          <div className="section-title">已安装 {(extList || []).length > 0 && <span className="market-meta">{(extList || []).length} 个</span>}
            <button className="mini-btn" disabled={zipBusy} onClick={() => zipInputRef.current?.click()}>
              {zipBusy ? '安装中…' : '⬆ 安装 .zip 插件包'}
            </button>
            <button className="mini-btn" onClick={reloadDir} title="重新扫描 .xnote-plugins/ 目录">↻ 重载目录</button>
            {isTauri() && <button className="mini-btn" onClick={async () => { await ensureLibraryDirs(); appToast('已确保插件目录存在：.xnote-plugins', 'success') }}>创建插件目录</button>}
          </div>
          {isTauri() && (
            <div className="ext-path">
              {pluginDir
                ? <>插件目录：<code>{pluginDir}</code>（每个插件一个子目录，含 plugin.json + main.js）</>
                : '请先选择笔记库'}
            </div>
          )}
          <input ref={zipInputRef} type="file" accept=".zip" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) void onZipPick(f) }} />
          <ul className="ext-list">
            {(extList || []).map(e => (
              <li key={e.dir}>
                <div>
                  <b>{e.manifest.name}</b> <span className="ext-ver">v{e.manifest.version}</span>
                  {e.error
                    ? <span className="ext-err"> · 加载失败：{e.error}</span>
                    : <span className="ext-ok"> · 已启用</span>}
                  <div className="ext-desc">{e.manifest.description}</div>
                </div>
                <div className="ext-actions">
                  <button className="mini-btn danger" disabled={busyId === e.dir}
                    onClick={() => void uninstall(e.dir, e.manifest.name)}>卸载</button>
                </div>
              </li>
            ))}
            {!(extList || []).length && <li className="empty">还没有安装插件（可从下方插件中心安装，或上传 .zip 插件包）</li>}
          </ul>
          {(extList || []).length > 0 && (
            <div className="ext-path" style={{ marginTop: 4 }}>
              批量：<button className="mini-btn" onClick={() => { setExternalDisabled(true); p.onReloadExternal(); appToast('已停用全部外部插件（点「重载目录」恢复）', 'success') }}>停用全部</button>
            </div>
          )}
          <div className="panel-warn">安全提示：外部插件以应用的完整权限执行代码，请仅安装信任来源的插件。</div>
        </div>

        {/* ── 插件中心 ── */}
        <div className="settings-section">
          <div className="section-title">插件中心
            <button className="mini-btn" disabled={marketBusy} onClick={() => void loadMarket()}>{marketBusy ? '加载中…' : '↻ 刷新列表'}</button>
            {marketList && !marketBusy && (
              <span className="market-meta">
                {marketList.length} 个插件 · 来自 {new URL(marketSource || DEFAULT_MARKET_URL).host}
              </span>
            )}
          </div>
          <div className="market-url">
            <input value={marketUrl} onChange={e => setMarketUrlState(e.target.value)}
              placeholder="插件中心索引地址（GitHub / Gitee raw 的 index.json）" />
            <button className="mini-btn" onClick={() => { setMarketUrl(marketUrl); void loadMarket(marketUrl) }}>保存源</button>
            <button className="mini-btn" onClick={() => { setMarketUrlState(DEFAULT_MARKET_URL); setMarketUrl(DEFAULT_MARKET_URL); void loadMarket(DEFAULT_MARKET_URL) }}>恢复默认</button>
          </div>
          <div className="market-url">
            <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="搜索插件名 / 描述…" />
            {keyword && <button className="mini-btn" onClick={() => setKeyword('')}>清除</button>}
          </div>
          {marketErr && <div className="panel-warn">{marketErr}</div>}
          <ul className="ext-list">
            {shown.map(entry => {
              const have = installed.get(entry.id)
              const canUpdate = !!have && compareVersion(entry.version, have.version) > 0
              const busy = busyId === entry.id || (have ? busyId === have.dir : false)
              return (
                <li key={entry.id}>
                  <div>
                    <b>{entry.name}</b> <span className="ext-ver">v{entry.version}</span>
                    {entry.author && <span className="ext-ok"> · {entry.author}</span>}
                    {have
                      ? (canUpdate
                        ? <span className="ext-badge-new"> · 可更新（已装 v{have.version}）</span>
                        : <span className="ext-badge-ok"> · 已是最新</span>)
                      : <span className="ext-badge-new"> · 未安装</span>}
                    <div className="ext-desc">{entry.description}</div>
                  </div>
                  <div className="ext-actions">
                    <button className="mini-btn primary" disabled={busy}
                      onClick={() => void installMarket(entry)}>
                      {busy ? '处理中…' : canUpdate ? '更新' : have ? '重装' : '安装'}
                    </button>
                    {have && (
                      <button className="mini-btn danger" disabled={busy}
                        onClick={() => void uninstall(have.dir, entry.name)}>卸载</button>
                    )}
                  </div>
                </li>
              )
            })}
            {marketList && !shown.length && <li className="empty">{keyword ? `没有匹配「${keyword}」的插件` : '插件中心为空'}</li>}
            {!marketList && !marketBusy && !marketErr && <li className="empty">点击「刷新列表」从插件中心拉取可安装插件</li>}
          </ul>
          {onlyLocal.length > 0 && (
            <div className="panel-help">
              另有 {onlyLocal.length} 个本地安装的插件未在插件中心上架：{onlyLocal.map(e => e.manifest.name).join('、')}
            </div>
          )}
          <div className="panel-help">
            自建插件中心：新建一个 GitHub / Gitee 公开仓库，放入 <code>index.json</code>（数组，每项含 id / name / version / zip 下载地址），
            把各插件的 .zip 上传到仓库 Release 或直接提交到仓库，把 raw 地址填到上面即可。
            每次「刷新列表」都会绕过 CDN 缓存重新拉取（jsDelivr 默认缓存 7 天）；默认源不可用时会自动切到备用源。
          </div>
        </div>

        <div className="modal-btns"><button className="btn primary" onClick={p.onClose}>完成</button></div>
      </div>
    </div>
  )
}
