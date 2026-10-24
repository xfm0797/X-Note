// ===== 云同步插件入口：注册「同步」命令与设置面板（含冲突面板接线） =====
import React from 'react'
import type { XNotePlugin } from '../types'
import { decideSync, contentHash, resolveConflict, type ConflictItem, type ConflictChoice, type SyncFileInfo } from './sync'
import { createWebDAVProvider, type WebDAVConfig } from './providers/webdav'
import { createLocalFolderProvider } from './providers/localFolder'
import { createGitProvider, type GitConfig } from './providers/git'
import type { SyncProvider } from './providers/types'
import { ConflictModal } from './ConflictModal'
import { isTauri } from '../../lib/storage'

const BASE_KEY = 'xnote:sync-base'

interface PanelProps { ctx: any }

/** 设置面板（含冲突面板接线） */
function SyncPanel({ ctx }: PanelProps) {
  const { useState } = React
  const [provider, setProvider] = useState<string>(ctx.settings.get('provider', 'localFolder'))
  const [webdav, setWebdav] = useState<WebDAVConfig>(ctx.settings.get('webdav', { url: '', user: '', password: '', dir: '' }))
  const [git, setGit] = useState<GitConfig>(ctx.settings.get('git', { remote: 'origin', branch: 'main' }))
  const [testMsg, setTestMsg] = useState('')
  const [conflicts, setConflicts] = useState<ConflictItem[]>([])

  const makeProvider = (): SyncProvider => {
    if (provider === 'webdav') return createWebDAVProvider(webdav)
    if (provider === 'git') return createGitProvider(git)
    return createLocalFolderProvider()
  }

  const save = (p = provider, w = webdav, g = git) => {
    ctx.settings.set('provider', p)
    ctx.settings.set('webdav', w)
    ctx.settings.set('git', g)
  }

  const doTest = async () => {
    save()
    setTestMsg('测试中…')
    const r = await makeProvider().test()
    setTestMsg(r.message)
  }

  const doSync = async () => {
    save()
    setConflicts([])
    const r = await (window as any).__xnoteRunSync?.()
    if (r && r.conflicts?.length) setConflicts(r.conflicts)
  }

  const resolve = async (path: string, choice: ConflictChoice, item: ConflictItem) => {
    const actions = resolveConflict(path, choice, item.local, item.remote)
    for (const a of actions) await ctx.storage.writeFile(a.path, a.content)
    const remote = makeProvider()
    await remote.push(actions[0].path, actions[0].content)
    updateBase(ctx, { [path]: { hash: contentHash(actions[0].content), updated: Date.now() } })
    setConflicts(cs => cs.filter(c => c.path !== path))
    ctx.ui.showToast(`冲突已裁决：${path}`, 'success')
  }

  return (
    <div className="plugin-panel">
      <label>同步后端：
        <select value={provider} onChange={e => { setProvider(e.target.value); save(e.target.value) }}>
          <option value="localFolder">本地文件夹镜像（Web 用 localStorage 模拟远端）</option>
          <option value="webdav">WebDAV（Nextcloud / 群晖等）</option>
          <option value="git">Git 仓库（仅桌面端）</option>
        </select>
      </label>
      {provider === 'webdav' && (
        <div className="panel-fields">
          <input placeholder="WebDAV 地址 https://…" value={webdav.url} onChange={e => setWebdav({ ...webdav, url: e.target.value })} />
          <input placeholder="账号" value={webdav.user} onChange={e => setWebdav({ ...webdav, user: e.target.value })} />
          <input type="password" placeholder="应用密码" value={webdav.password} onChange={e => setWebdav({ ...webdav, password: e.target.value })} />
          <input placeholder="远端目录（可选）" value={webdav.dir || ''} onChange={e => setWebdav({ ...webdav, dir: e.target.value })} />
        </div>
      )}
      {provider === 'git' && (
        <div className="panel-fields">
          <input placeholder="remote（默认 origin）" value={git.remote || ''} onChange={e => setGit({ ...git, remote: e.target.value })} />
          <input placeholder="branch（默认 main）" value={git.branch || ''} onChange={e => setGit({ ...git, branch: e.target.value })} />
          {!isTauri() && <div className="panel-warn">Git 后端需要桌面端（Tauri shell 执行 git）</div>}
        </div>
      )}
      <div className="panel-btns">
        <button className="btn" onClick={() => { save(); doTest() }}>测试连接</button>
        <button className="btn primary" onClick={doSync}>立即同步</button>
      </div>
      {testMsg && <div className="panel-msg">{testMsg}</div>}
      {conflicts.length > 0 && (
        <ConflictModal
          items={conflicts}
          onResolve={(path, choice) => {
            const item = conflicts.find(c => c.path === path)!
            resolve(path, choice, item)
          }}
          onClose={() => setConflicts([])}
        />
      )}
    </div>
  )
}

function updateBase(ctx: any, patch: Record<string, SyncFileInfo>) {
  const base = ctx.settings.get(BASE_KEY, {})
  ctx.settings.set(BASE_KEY, { ...base, ...patch })
}

export function createCloudSyncPlugin(): XNotePlugin {
  return {
    manifest: {
      id: 'cloudSync',
      name: '云同步',
      version: '1.0.0',
      description: 'WebDAV / 本地镜像 / Git 三种后端，冲突面板裁决'
    },
    activate(ctx) {
      // 暴露同步执行器给设置面板
      ;(window as any).__xnoteRunSync = async () => {
        const providerId = ctx.settings.get<string>('provider', 'localFolder')
        const remote =
          providerId === 'webdav' ? createWebDAVProvider(ctx.settings.get<WebDAVConfig>('webdav', { url: '', user: '', password: '' }))
          : providerId === 'git' ? createGitProvider(ctx.settings.get<GitConfig>('git', {}))
          : createLocalFolderProvider()

        const tr = await ctx.storage.loadAll()
        const rl = await remote.list()
        const base = ctx.settings.get<Record<string, SyncFileInfo>>(BASE_KEY, {})
        const pushed: string[] = [], pulled: string[] = []
        const conflicts: ConflictItem[] = []

        const paths = new Set([...Object.keys(tr), ...Object.keys(rl)])
        for (const p of paths) {
          const local: SyncFileInfo | null = tr[p] ? { hash: contentHash(tr[p].content), updated: tr[p].updated } : null
          const r = rl[p] ?? null
          const b = base[p] ?? null
          const d = decideSync(local, r, b)
          if (d === 'push') { await remote.push(p, tr[p].content); pushed.push(p); updateBase(ctx, { [p]: r! }) }
          else if (d === 'pull') { await ctx.storage.writeFile(p, await remote.pull(p)); pulled.push(p) }
          else if (d === 'delete-local') { await ctx.storage.deletePath(p) }
          else if (d === 'conflict') {
            conflicts.push({ path: p, local: tr[p]?.content ?? '', remote: r ? await remote.pull(p) : '' })
          }
        }
        await remote.afterSync?.()
        ctx.ui.showToast(`同步完成：推送 ${pushed.length}，拉取 ${pulled.length}，冲突 ${conflicts.length}`,
          conflicts.length ? 'info' : 'success')
        await ctx.storage.reloadLibrary()
        return { conflicts }
      }

      ctx.ui.registerCommand({
        id: 'cloudsync.sync',
        title: '同步',
        run: () => (window as any).__xnoteRunSync?.()
      })

      ctx.ui.registerSettingsPanel({
        id: 'cloudSync',
        title: '云同步',
        render: () => React.createElement(SyncPanel, { ctx })
      })
    }
  }
}
