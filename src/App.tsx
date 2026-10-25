// ===== X-Note 主逻辑：状态、自动保存、搜索、主题、导入导出、插件宿主接入 =====
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Settings, TreeItem, NoteMeta, Heading, Backlink, ToastMsg, ViewMode } from './types'
import { storage, isTauri, chooseLibraryRoot, getLibraryRoot, ensureLibraryDirs } from './lib/storage'
import { buildTree, filterTree, loadOrder, saveOrder, moveNode, baseName, stripMd, orderSnapshot } from './lib/tree'
import { extractOutline, extractTags, buildBacklinks, extractWikiTargets, renderMarkdown } from './lib/markdown'
import { countWords } from './lib/editorFmt'
import { pushSnapshot, listSnapshots } from './lib/history'
import { doExport } from './lib/export'
import { openNoteWindow, windowParams } from './lib/window'
import { Topbar } from './components/Topbar'
import { Sidebar } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { Editor } from './components/Editor'
import { Preview } from './components/Preview'
import { GraphModal, type GraphNode, type GraphEdge } from './components/GraphModal'
import { HistoryModal } from './components/HistoryModal'
import { AboutModal } from './components/AboutModal'
import { SettingsModal } from './components/SettingsModal'
import { DialogHost, askText, askConfirm, appToast } from './components/AskModal'
import { createRegistry, } from './plugins/registry'
import type { Host } from './plugins/host'
import { scanExternalPlugins, loadExternalPlugin, isExternalDisabled, setExternalDisabled } from './plugins/external'

const SETTINGS_KEY = 'xnote:settings'
const TABS_SESSION = 'xnote:tabs:session'
const TABS_LAST = 'xnote:tabs:last'

const DEFAULT_SETTINGS: Settings = {
  theme: 'light', fontSize: 15, fontFamily: "Consolas, 'Courier New', monospace",
  exportFormat: 'md', sidebarVisible: true, sidebarWidth: 250, view: 'split'
}

function loadSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') } }
  catch { return DEFAULT_SETTINGS }
}

export default function App() {
  /* ---------- 基础状态 ---------- */
  const [ready, setReady] = useState(false)
  const [lib, setLib] = useState<Record<string, NoteMeta>>({})
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [tabs, setTabs] = useState<string[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [caret, setCaret] = useState({ line: 1, col: 1 })
  const [status, setStatus] = useState<'saved' | 'saving'>('saved')
  const [modal, setModal] = useState<'none' | 'graph' | 'history' | 'settings' | 'about'>('none')
  const [scrollTarget, setScrollTarget] = useState<string | null>(null)
  const [, forceRender] = useState(0)
  // 插件
  const hostRef = useRef<Host | null>(null)
  const [pluginCommands, setPluginCommands] = useState<{ id: string; title: string; run: () => void }[]>([])
  const [pluginPanels, setPluginPanels] = useState<{ id: string; title: string; render: () => any }[]>([])
  const [extErrors, setExtErrors] = useState<Record<string, string>>({})

  const showToast = useCallback((text: string, kind: ToastMsg['kind'] = 'info') => {
    appToast(text, kind)
  }, [])

  const notifyPanelsChanged = useCallback(() => {
    const h = hostRef.current
    if (!h) return
    setPluginCommands(h.commands().map(c => ({ id: c.id, title: c.title, run: () => void c.run() })))
    setPluginPanels(h.panels().map(pp => ({ id: pp.id, title: pp.title, render: pp.render })))
  }, [])

  /* ---------- 启动：加载库 + 插件 ---------- */
  useEffect(() => {
    (async () => {
      // 桌面端首次启动：未选择笔记库时先弹出文件夹选择
      if (isTauri() && !(await getLibraryRoot())) await chooseLibraryRoot()
      await ensureLibraryDirs() // 补建 .xnote-plugins/ 等辅助目录（防止手动建错名）
      const loaded = await storage.loadAll()
      setLib(loaded)
      setReady(true)

      // 恢复标签页：sessionStorage → localStorage 回退
      let restored: string[] = []
      try { restored = JSON.parse(sessionStorage.getItem(TABS_SESSION) || 'null') || [] } catch { }
      if (!restored.length) { try { restored = JSON.parse(localStorage.getItem(TABS_LAST) || '[]') } catch { } }
      const valid = restored.filter(p => loaded[p])
      const wp = windowParams()
      const noteParam = wp.get('note')
      if (noteParam && loaded[noteParam]) {
        valid.unshift(noteParam)
        if (wp.get('view')) patchSettings({ view: wp.get('view') as ViewMode })
        if (wp.get('sidebar')) patchSettings({ sidebarVisible: wp.get('sidebar') === '1' })
        if (wp.get('sw')) patchSettings({ sidebarWidth: Number(wp.get('sw')) || 250 })
      }
      const finalTabs = valid.length ? Array.from(new Set(valid)) : Object.keys(loaded).slice(0, 1)
      setTabs(finalTabs)
      setActive(finalTabs[0] ?? null)

      // 展开一级目录
      setExpanded(new Set(Object.keys(loaded).filter(p => p.includes('/')).map(p => p.split('/')[0])))

      // 内置插件
      const { host, ready: regReady } = createRegistry({
        storage: {
          loadAll: () => storage.loadAll(),
          readFile: (p) => storage.readFile(p),
          writeFile: (p, c) => storage.writeFile(p, c),
          deletePath: (p) => storage.deletePath(p),
          reloadLibrary: async () => { const l = await storage.loadAll(); setLib(l); return l }
        },
        showToast,
        notifyPanelsChanged
      })
      hostRef.current = host
      await regReady

      // 外部插件目录动态加载
      if (!isExternalDisabled()) {
        const entries = await scanExternalPlugins()
        const errs: Record<string, string> = {}
        for (const e of entries) {
          try { await host.registerPlugin(await loadExternalPlugin(e)) }
          catch (err) { errs[e.dir] = String(err) }
        }
        setExtErrors(errs)
      }
      notifyPanelsChanged()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(s => {
      const next = { ...s, ...patch }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const reloadExternal = useCallback(async () => {
    const h = hostRef.current
    if (!h) return
    h.clear('external')
    if (!isExternalDisabled()) {
      const entries = await scanExternalPlugins()
      const errs: Record<string, string> = {}
      for (const e of entries) {
        try { await h.registerPlugin(await loadExternalPlugin(e)) }
        catch (err) { errs[e.dir] = String(err) }
      }
      setExtErrors(errs)
      showToast('外部插件目录已重载', 'success')
    } else {
      showToast('外部插件已停用', 'info')
    }
    notifyPanelsChanged()
  }, [showToast, notifyPanelsChanged])

  /* ---------- 主题（含跟随系统） ---------- */
  const [systemDark, setSystemDark] = useState(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const fn = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener?.('change', fn)
    return () => mq.removeEventListener?.('change', fn)
  }, [])
  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark)
  useEffect(() => { document.body.classList.toggle('dark', isDark) }, [isDark])

  /* ---------- 标签页持久化 ---------- */
  useEffect(() => {
    if (!ready) return
    sessionStorage.setItem(TABS_SESSION, JSON.stringify(tabs))
    localStorage.setItem(TABS_LAST, JSON.stringify(tabs))
  }, [tabs, ready])

  /* ---------- 自动保存 ---------- */
  const savedContentRef = useRef<Record<string, string>>({}) // 各路径已持久化的内容
  const saveTimer = useRef<number | null>(null)
  useEffect(() => {
    if (ready) {
      const snapshot: Record<string, string> = {}
      for (const [p, m] of Object.entries(lib)) snapshot[p] = m.content
      savedContentRef.current = snapshot
    }
  }, [ready]) // 首次加载建立基线

  const scheduleSave = useCallback((path: string, content: string) => {
    setStatus('saving')
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(async () => {
      const old = savedContentRef.current[path] ?? ''
      if (old !== content) await pushSnapshot(path, old) // 保存前快照旧内容
      await storage.writeFile(path, content)
      savedContentRef.current[path] = content
      setLib(l => ({ ...l, [path]: { content, updated: Date.now() } }))
      setStatus('saved')
    }, 400)
  }, [])

  /* ---------- 派生数据 ---------- */
  const tree: TreeItem[] = useMemo(() => {
    let filtered = lib
    if (activeTag) {
      const keep = new Set<string>()
      for (const [p, m] of Object.entries(lib)) if (extractTags(m.content).includes(activeTag)) keep.add(p)
      filtered = Object.fromEntries(Object.entries(lib).filter(([p]) => keep.has(p)))
    }
    return buildTree(filtered)
  }, [lib, activeTag])

  const order = useMemo(() => loadOrder(), [lib])

  const wikiTitles = useMemo(() => {
    const s = new Set<string>()
    for (const p of Object.keys(lib)) s.add(stripMd(baseName(p)))
    return s
  }, [lib])

  const titleOf = useCallback((path: string) => stripMd(baseName(path)), [])

  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    const out: { path: string; snippet: string }[] = []
    for (const [p, m] of Object.entries(lib)) {
      const inTitle = titleOf(p).toLowerCase().includes(q)
      const i = m.content.toLowerCase().indexOf(q)
      if (inTitle || i !== -1) {
        const frag = i !== -1 ? m.content.slice(Math.max(0, i - 18), i + q.length + 30).replace(/\n/g, ' ') : ''
        out.push({ path: p, snippet: frag })
      }
      if (out.length >= 30) break
    }
    return out
  }, [search, lib, titleOf])

  const tags = useMemo(() => {
    const counter = new Map<string, number>()
    for (const m of Object.values(lib)) for (const t of extractTags(m.content)) counter.set(t, (counter.get(t) || 0) + 1)
    return Array.from(counter, ([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count)
  }, [lib])

  const activeContent = active ? lib[active]?.content ?? '' : ''
  const outline: Heading[] = useMemo(() => active ? extractOutline(activeContent) : [], [active, activeContent])

  const backlinks: Backlink[] = useMemo(() => {
    if (!active) return []
    return buildBacklinks(lib, active, titleOf(active))
  }, [lib, active, titleOf])

  const words = useMemo(() => countWords(activeContent), [activeContent])

  const graph = useMemo(() => {
    const paths = Object.keys(lib)
    const byTitle = new Map(paths.map(p => [stripMd(baseName(p)), p]))
    const edges: GraphEdge[] = []
    const degree = new Map<string, number>()
    const neighbor = new Set<string>()
    for (const p of paths) {
      for (const t of new Set(extractWikiTargets(lib[p].content))) {
        const target = byTitle.get(t)
        if (target && target !== p) {
          edges.push({ source: p, target })
          degree.set(p, (degree.get(p) || 0) + 1)
          degree.set(target, (degree.get(target) || 0) + 1)
          if (p === active || target === active) { neighbor.add(p); neighbor.add(target) }
        }
      }
    }
    const nodes: GraphNode[] = paths.map(p => ({
      id: p, label: titleOf(p), degree: degree.get(p) || 0,
      active: p === active, neighbor: neighbor.has(p) && p !== active,
      isolated: !degree.get(p)
    }))
    return { nodes, edges }
  }, [lib, active, titleOf])

  /* ---------- 笔记操作 ---------- */
  const openNote = useCallback((path: string) => {
    setTabs(ts => ts.includes(path) ? ts : [...ts, path])
    setActive(path)
    setActiveTag(null)
    setSearch('')
  }, [])

  const closeTab = useCallback((path: string) => {
    setTabs(ts => {
      const idx = ts.indexOf(path)
      const next = ts.filter(t => t !== path)
      setActive(a => (a === path ? next[Math.min(idx, next.length - 1)] ?? null : a))
      return next
    })
  }, [])

  const flushSave = useCallback(async () => {
    if (saveTimer.current) { window.clearTimeout(saveTimer.current); saveTimer.current = null }
    // 立即持久化所有未保存内容
    for (const [p, m] of Object.entries(lib)) {
      if (savedContentRef.current[p] !== m.content) {
        await pushSnapshot(p, savedContentRef.current[p] ?? '')
        await storage.writeFile(p, m.content)
        savedContentRef.current[p] = m.content
      }
    }
    setStatus('saved')
  }, [lib])

  /* ---------- 手动保存（Ctrl+S）与窗口关闭前落盘 ---------- */
  const flushRef = useRef(flushSave)
  useEffect(() => { flushRef.current = flushSave }, [flushSave])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void flushRef.current().then(() => appToast('已保存', 'success'))
      }
    }
    window.addEventListener('keydown', onKey)
    let unlisten: (() => void) | undefined
    ;(async () => {
      if (isTauri()) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window')
          const un = await getCurrentWindow().onCloseRequested(async (e) => {
            e.preventDefault()          // 先拦截关闭
            await flushRef.current()    // 落盘未保存内容
            getCurrentWindow().destroy() // 再真正关闭
          })
          unlisten = un
        } catch { /* API 不可用时忽略 */ }
      }
    })()
    return () => { window.removeEventListener('keydown', onKey); unlisten?.() }
  }, [])

  const onEditorChange = useCallback((content: string, selStart?: number, selEnd?: number) => {
    if (!active) return
    setLib(l => ({ ...l, [active]: { content, updated: Date.now() } }))
    scheduleSave(active, content)
    // 选区恢复（工具条操作后）
    if (selStart !== undefined && selEnd !== undefined) {
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLTextAreaElement>('.editor-textarea')
        if (el) el.setSelectionRange(selStart, selEnd)
      })
    }
  }, [active, scheduleSave])

  const createNote = useCallback(async (dir: string) => {
    await flushSave()
    const name = await askText('笔记名称：', '新建笔记.md')
    if (!name) return
    const path = dir ? `${dir}/${name.endsWith('.md') ? name : name + '.md'}` : (name.endsWith('.md') ? name : name + '.md')
    if (lib[path] !== undefined) { showToast('同名笔记已存在', 'error'); return }
    const content = `# ${stripMd(baseName(path))}\n\n`
    await storage.writeFile(path, content)
    setLib(l => ({ ...l, [path]: { content, updated: Date.now() } }))
    savedContentRef.current[path] = content
    openNote(path)
  }, [lib, flushSave, openNote, showToast])

  const createDir = useCallback(async (dir: string) => {
    const name = await askText('文件夹名称：', '新建文件夹')
    if (!name) return
    const path = dir ? `${dir}/${name}` : name
    if (isTauri()) {
      const fs = await import('@tauri-apps/plugin-fs')
      const root = await getLibraryRoot()
      if (root) await fs.mkdir(`${root}/${path}`, { recursive: true })
    } else {
      // Web：通过占位保持目录可见（放入一个空说明文件）
      await storage.writeFile(`${path}/.keep.md`, '')
      setLib(l => ({ ...l, [`${path}/.keep.md`]: { content: '', updated: Date.now() } }))
    }
    setExpanded(s => new Set(s).add(path))
    showToast(`文件夹 ${name} 已创建`, 'success')
  }, [showToast])

  const renameNote = useCallback(async (path: string, isDir: boolean) => {
    const oldName = baseName(path)
    const name = await askText('新名称：', oldName)
    if (!name || name === oldName) return
    await flushSave()
    const newPath = path.slice(0, path.length - oldName.length) + name
    await storage.renamePath(path, newPath, isDir)
    const next = await storage.loadAll()
    setLib(next)
    // 修正基线 / 标签
    savedContentRef.current = {}
    for (const [p, m] of Object.entries(next)) savedContentRef.current[p] = m.content
    setTabs(ts => ts.map(t => isDir && t.startsWith(path + '/') ? newPath + t.slice(path.length) : t === path ? newPath : t))
    setActive(a => a && (a === path ? newPath : isDir && a.startsWith(path + '/') ? newPath + a.slice(path.length) : a))
    // 排序清单同步
    const od = loadOrder().map(o => isDir && o.startsWith(path + '/') ? newPath + o.slice(path.length) : o === path ? newPath : o)
    saveOrder(od)
    showToast('已重命名', 'success')
  }, [flushSave, showToast])

  const deleteNote = useCallback(async (path: string, isDir: boolean) => {
    if (!(await askConfirm(`确定删除「${baseName(path)}」吗？${isDir ? '（文件夹内全部内容将删除）' : ''}`, true))) return
    await flushSave()
    await storage.deletePath(path, isDir)
    const next = await storage.loadAll()
    setLib(next)
    const affected = (p: string) => p === path || (isDir && p.startsWith(path + '/'))
    setTabs(ts => ts.filter(t => !affected(t)))
    setActive(a => a && affected(a) ? null : a)
    showToast('已删除', 'success')
  }, [flushSave, showToast])

  const onDropNode = useCallback((dragged: string, target: string) => {
    const isDirTarget = lib[target] === undefined || Object.keys(lib).some(p => p.startsWith(target + '/'))
    const draggedIsDir = Object.keys(lib).some(p => p.startsWith(dragged + '/'))
    if (draggedIsDir) { showToast('文件夹暂不支持移动（仅笔记可拖拽重排）', 'info'); return }
    // 拖到文件夹 = 移入
    if (isDirTarget) {
      const fileName = baseName(dragged)
      renamePathTo(dragged, `${target}/${fileName}`)
    } else {
      // 前插重排（同级排序清单）
      saveOrder(moveNode(loadOrder(), dragged, target))
      forceRender(x => x + 1)
    }
  }, [lib])

  const renamePathTo = useCallback(async (oldPath: string, newPath: string) => {
    await flushSave()
    await storage.renamePath(oldPath, newPath)
    const next = await storage.loadAll()
    setLib(next)
    savedContentRef.current = {}
    for (const [p, m] of Object.entries(next)) savedContentRef.current[p] = m.content
    setTabs(ts => ts.map(t => t === oldPath ? newPath : t))
    setActive(a => a === oldPath ? newPath : a)
    showToast(`已移动到 ${baseName(newPath) === baseName(oldPath) ? newPath.split('/')[0] : newPath}`, 'success')
  }, [flushSave, showToast])

  const openWiki = useCallback((title: string) => {
    const path = Array.from(Object.keys(lib)).find(p => stripMd(baseName(p)) === title)
    if (path) openNote(path)
    else showToast(`未找到同名笔记「${title}」`, 'info')
  }, [lib, openNote, showToast])

  /* ---------- 导入 ---------- */
  const importFiles = useCallback(async (files: FileList | null) => {
    if (!files) return
    for (const f of Array.from(files)) {
      if (!f.name.toLowerCase().endsWith('.md')) continue
      const content = await f.text()
      await storage.writeFile(f.name, content)
      setLib(l => ({ ...l, [f.name]: { content, updated: Date.now() } }))
      savedContentRef.current[f.name] = content
    }
    showToast('导入完成', 'success')
  }, [showToast])

  /* ---------- 导出 ---------- */
  const doExportActive = useCallback((format: 'md' | 'html' | 'pdf') => {
    if (!active) { showToast('请先打开一篇笔记', 'info'); return }
    doExport(format, titleOf(active), activeContent, renderMarkdown(activeContent, wikiTitles))
  }, [active, activeContent, titleOf, wikiTitles, showToast])

  /* ---------- 历史 ---------- */
  const [snapshots, setSnapshots] = useState<HistorySnapshotType[]>([])
  const openHistory = useCallback(async () => {
    if (!active) { showToast('请先打开一篇笔记', 'info'); return }
    setSnapshots(await listSnapshots(active))
    setModal('history')
  }, [active, showToast])

  /* ---------- 布局：侧栏拖拽调宽 ---------- */
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = settings.sidebarWidth
    const move = (ev: MouseEvent) => patchSettings({ sidebarWidth: Math.max(180, Math.min(480, startW + ev.clientX - startX)) })
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [settings.sidebarWidth, patchSettings])

  /* ---------- 选择笔记库（桌面端） ---------- */
  const onSelectFolder = useCallback(async () => {
    if (!isTauri()) { showToast('桌面端（Tauri）才能选择本地文件夹；浏览器预览使用 localStorage', 'info'); return }
    const root = await chooseLibraryRoot()
    if (root) {
      const loaded = await storage.loadAll()
      setLib(loaded)
      setTabs([]); setActive(null)
      showToast(`已切换笔记库：${root}`, 'success')
    }
  }, [showToast])

  /* ---------- 渲染 ---------- */
  if (!ready) return <div className="boot">X-Note 加载中…</div>

  return (
    <div className="app" onDragOver={e => e.preventDefault()} onDrop={e => { if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files) }}>
      <Topbar
        view={settings.view}
        theme={isDark ? 'dark' : 'light'}
        sidebarVisible={settings.sidebarVisible}
        pluginCommands={pluginCommands}
        onView={v => patchSettings({ view: v })}
        onToggleTheme={() => patchSettings({ theme: isDark ? 'light' : 'dark' })}
        onToggleSidebar={() => patchSettings({ sidebarVisible: !settings.sidebarVisible })}
        onExport={doExportActive}
        onOpenGraph={() => setModal('graph')}
        onOpenHistory={openHistory}
        onOpenSettings={() => setModal('settings')}
        onOpenAbout={() => setModal('about')}
        onNewWindow={() => active && openNoteWindow({
          note: active, view: settings.view,
          sidebar: settings.sidebarVisible ? '1' : '0', sw: String(settings.sidebarWidth)
        })}
        onSelectFolder={onSelectFolder}
        onSave={() => { void flushRef.current().then(() => appToast('已保存', 'success')) }}
        saving={status === 'saving'}
      />

      <div className="main">
        <Sidebar
          libName={isTauri() ? (getLibraryRootCache() || '笔记库') : '浏览器预览库'}
          visible={settings.sidebarVisible}
          width={settings.sidebarWidth}
          tree={tree}
          order={order}
          expanded={expanded}
          activePath={active}
          search={search}
          searchResults={searchResults}
          tags={tags}
          activeTag={activeTag}
          outline={outline}
          backlinks={backlinks}
          onSearch={setSearch}
          onPickTag={setActiveTag}
          onOpen={openNote}
          onRename={renameNote}
          onDelete={deleteNote}
          onNewFile={p => createNote(p)}
          onNewDir={p => createDir(p)}
          onDropNode={onDropNode}
          onToggleDir={p => setExpanded(s => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n })}
          onNewRootFile={() => createNote('')}
          onJumpHeading={h => setScrollTarget(h.id)}
          onOpenBacklink={openNote}
          onResizeStart={onResizeStart}
        />

        <div className="content">
          <TabBar
            tabs={tabs}
            active={active}
            titleOf={titleOf}
            onSelect={p => { flushSave(); setActive(p) }}
            onClose={closeTab}
            onOrderChange={setTabs}
          />
          <div className={`workbench view-${settings.view}`}>
            {active && (
              <Editor
                value={activeContent}
                fontSize={settings.fontSize}
                fontFamily={settings.fontFamily}
                onChange={onEditorChange}
                onCaretChange={setCaret}
              />
            )}
            {settings.view !== 'edit' && active && (
              <Preview
                content={activeContent}
                wikiTitles={wikiTitles}
                fontSize={settings.fontSize}
                onOpenWiki={openWiki}
                scrollTargetId={scrollTarget}
              />
            )}
            {!active && (
              <div className="empty-state">
                <div className="empty-logo">📝</div>
                <div>没有打开的笔记</div>
                <div className="empty-tip">从左侧文件树打开，或将 .md 文件拖入窗口导入</div>
              </div>
            )}
          </div>
          <div className="statusbar">
            <span>{status === 'saving' ? '保存中…' : '已保存'}</span>
            <span className="status-flex" />
            {active && <span>Ln {caret.line}, Col {caret.col}</span>}
            {active && <span>{words.words} 词 / {words.chars} 字</span>}
            <span className="status-flex" />
            <span className="lib-path" title={isTauri() ? (getLibraryRootCache() || '未选择笔记库') : '浏览器 localStorage'}>
              {isTauri() ? (getLibraryRootCache() || '📁 未选择笔记库（点击顶栏 📁 选择）') : '浏览器预览 · localStorage'}
            </span>
          </div>
        </div>
      </div>

      {/* 弹窗 */}
      {modal === 'graph' && (
        <GraphModal nodes={graph.nodes} edges={graph.edges} onOpenNote={p => { openNote(p); setModal('none') }} onClose={() => setModal('none')} />
      )}
      {modal === 'history' && (
        <HistoryModal
          snapshots={snapshots}
          currentContent={activeContent}
          currentTitle={active ? titleOf(active) : ''}
          onRestore={async (content) => {
            if (!active) return
            await pushSnapshot(active, savedContentRef.current[active] ?? '')
            await storage.writeFile(active, content)
            savedContentRef.current[active] = content
            setLib(l => ({ ...l, [active]: { content, updated: Date.now() } }))
            showToast('已恢复该版本（当前内容已另行快照，可撤销）', 'success')
          }}
          onClose={() => setModal('none')}
        />
      )}
      {modal === 'settings' && (
        <SettingsModal
          settings={settings}
          onChange={patchSettings}
          panels={pluginPanels}
          onReloadExternal={reloadExternal}
          onClose={() => setModal('none')}
        />
      )}
      {modal === 'about' && <AboutModal onClose={() => setModal('none')} />}

      {/* 应用内对话框 + 全局 Toast（替代原生 prompt/confirm/alert） */}
      <DialogHost />
    </div>
  )
}

type HistorySnapshotType = { ts: number; content: string }

/** 桌面端库名缓存（避免在渲染中读取异步值） */
let libRootCache: string | null = null
getLibraryRoot().then(r => { libRootCache = r })
function getLibraryRootCache(): string | null { return libRootCache }

// extErrors 暴露给设置面板展示
declare module './components/SettingsModal' { }
void setExternalDisabled
