// Gitee 代码片段备份插件：笔记库一键备份 / 恢复
// Gitee snippet 文件名扁平化，用 __ 映射目录分隔符；清单文件 .xnote-manifest.json 还原目录结构
const API = 'https://gitee.com/api/v5'

export default {
  manifest: {
    id: 'giteeGist',
    name: 'Gitee 代码片段备份',
    version: '1.0.0',
    description: '笔记库一键备份到 Gitee 代码片段（扁平化存储 + 清单还原目录结构）'
  },
  activate(ctx) {
    const token = () => ctx.settings.get('token', '')
    const flat = (p) => p.replace(/\//g, '__')
    const unfold = (n) => n.replace(/__/g, '/')

    async function getSnippet(createIfMissing) {
      const id = ctx.settings.get('snippetId', '')
      if (id) {
        const res = await fetch(`${API}/gists/${id}?access_token=${encodeURIComponent(token())}`)
        if (res.ok) return res.json()
        if (res.status !== 404) throw new Error(`读取片段失败：${res.status}`)
      }
      if (!createIfMissing) return null
      const res = await fetch(`${API}/gists?access_token=${encodeURIComponent(token())}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'X-Note 笔记备份', files: { 'x-note.md': { content: 'X-Note backup' } } })
      })
      if (!res.ok) throw new Error(`创建片段失败：${res.status}`)
      const s = await res.json()
      ctx.settings.set('snippetId', s.id)
      return s
    }

    ctx.ui.registerCommand({
      id: 'gitee-gist.backup',
      title: 'Gitee 备份',
      run: async () => {
        if (!token()) { ctx.ui.showToast('请先在「设置 → 插件 → Gitee 备份」填写私人令牌', 'error'); return }
        try {
          const snippet = await getSnippet(true)
          const lib = await ctx.storage.loadAll()
          const files = { '.xnote-manifest.json': { content: JSON.stringify(Object.keys(lib)) } }
          for (const [p, m] of Object.entries(lib)) files[flat(p)] = { content: m.content }
          const res = await fetch(`${API}/gists/${snippet.id}?access_token=${encodeURIComponent(token())}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files })
          })
          if (!res.ok) throw new Error(`备份失败：${res.status}`)
          ctx.ui.showToast(`已备份 ${Object.keys(lib).length} 篇笔记到 Gitee`, 'success')
        } catch (e) { ctx.ui.showToast(String(e), 'error') }
      }
    })

    ctx.ui.registerCommand({
      id: 'gitee-gist.restore',
      title: 'Gitee 恢复',
      run: async () => {
        if (!token()) { ctx.ui.showToast('请先在「设置 → 插件 → Gitee 备份」填写私人令牌', 'error'); return }
        try {
          const snippet = await getSnippet(false)
          if (!snippet) { ctx.ui.showToast('尚无备份片段，请先备份', 'info'); return }
          let manifest = null
          for (const [name, f] of Object.entries(snippet.files)) {
            if (name === '.xnote-manifest.json') manifest = JSON.parse(f.content ?? '[]')
          }
          let n = 0
          for (const [name, f] of Object.entries(snippet.files)) {
            if (name === 'x-note.md' || name === '.xnote-manifest.json') continue
            const path = manifest && manifest.includes(unfold(name)) ? unfold(name) : name
            await ctx.storage.writeFile(path, f.content ?? '')
            n++
          }
          await ctx.storage.reloadLibrary()
          ctx.ui.showToast(`已从 Gitee 恢复 ${n} 篇笔记`, 'success')
        } catch (e) { ctx.ui.showToast(String(e), 'error') }
      }
    })

    function Panel({ getConfig, saveConfig }) {
      const { createElement: h, useState } = window.XNoteReact
      const [cfg, setCfg] = useState(getConfig())
      return h('div', null,
        h('input', {
          type: 'password', placeholder: 'Gitee 私人令牌（gists + user_info）',
          value: cfg.token || '', onChange: (e) => setCfg({ ...cfg, token: e.target.value })
        }),
        h('button', { onClick: () => saveConfig(cfg) }, '保存令牌'),
        h('span', null, '　顶栏「Gitee 备份 / Gitee 恢复」执行操作。'),
      )
    }

    ctx.ui.registerSettingsPanel({
      id: 'giteeGist',
      title: 'Gitee 代码片段备份',
      render: () => window.XNoteReact.createElement(Panel, {
        getConfig: () => ctx.settings.get('ui', {}),
        saveConfig: (cfg) => ctx.settings.set('ui', cfg)
      })
    })
  }
}
