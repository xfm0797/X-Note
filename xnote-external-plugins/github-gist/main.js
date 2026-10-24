// GitHub Gist 备份插件：笔记库一键备份 / 恢复到 Gist
// 文件名保留目录结构（用 " / " 映射 Gist 文件名，因为 Gist 文件名不含 /）
const API = 'https://api.github.com'
const SETTING_GIST = 'gistId'

export default {
  manifest: {
    id: 'githubGist',
    name: 'GitHub Gist 备份',
    version: '1.0.0',
    description: '笔记库一键备份到 GitHub Gist 并随时恢复（保留目录结构，远端删除可同步）'
  },
  activate(ctx) {
    const token = () => ctx.settings.get('token', '')

    const headers = () => ({
      Authorization: `Bearer ${token()}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    })

    const gistFile = (path) => path.replace(/\//g, ' ∕ ') // Gist 文件名不含 /，用特殊斜杠映射

    async function getGist(createIfMissing) {
      let id = ctx.settings.get(SETTING_GIST, '')
      if (id) {
        const res = await fetch(`${API}/gists/${id}`, { headers: headers() })
        if (res.ok) return res.json()
        if (res.status !== 404) throw new Error(`读取 Gist 失败：${res.status}`)
      }
      if (!createIfMissing) return null
      const res = await fetch(`${API}/gists`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ description: 'X-Note 笔记备份', public: false, files: { 'x-note.md': { content: 'X-Note backup' } } })
      })
      if (!res.ok) throw new Error(`创建 Gist 失败：${res.status}`)
      const gist = await res.json()
      ctx.settings.set(SETTING_GIST, gist.id)
      return gist
    }

    ctx.ui.registerCommand({
      id: 'github-gist.backup',
      title: 'Gist 备份',
      run: async () => {
        if (!token()) { ctx.ui.showToast('请先在「设置 → 插件 → GitHub Gist 备份」填写令牌', 'error'); return }
        try {
          const gist = await getGist(true)
          const lib = await ctx.storage.loadAll()
          const files = {}
          for (const [p, m] of Object.entries(lib)) files[gistFile(p)] = { content: m.content }
          const res = await fetch(`${API}/gists/${gist.id}`, {
            method: 'PATCH', headers: headers(),
            body: JSON.stringify({ files })
          })
          if (!res.ok) throw new Error(`备份失败：${res.status}`)
          ctx.ui.showToast(`已备份 ${Object.keys(files).length} 篇笔记到 Gist`, 'success')
        } catch (e) { ctx.ui.showToast(String(e), 'error') }
      }
    })

    ctx.ui.registerCommand({
      id: 'github-gist.restore',
      title: 'Gist 恢复',
      run: async () => {
        if (!token()) { ctx.ui.showToast('请先在「设置 → 插件 → GitHub Gist 备份」填写令牌', 'error'); return }
        try {
          const gist = await getGist(false)
          if (!gist) { ctx.ui.showToast('尚无备份 Gist，请先备份', 'info'); return }
          let n = 0
          for (const [name, f] of Object.entries(gist.files)) {
            if (name === 'x-note.md') continue
            const path = name.replace(/ ∕ /g, '/')
            await ctx.storage.writeFile(path, f.content ?? '')
            n++
          }
          await ctx.storage.reloadLibrary()
          ctx.ui.showToast(`已从 Gist 恢复 ${n} 篇笔记`, 'success')
        } catch (e) { ctx.ui.showToast(String(e), 'error') }
      }
    })

    function Panel({ getConfig, saveConfig }) {
      const { createElement: h, useState } = window.XNoteReact
      const [cfg, setCfg] = useState(getConfig())
      return h('div', null,
        h('input', {
          type: 'password', placeholder: 'GitHub Personal Access Token（gist 权限）',
          value: cfg.token || '', onChange: (e) => setCfg({ ...cfg, token: e.target.value })
        }),
        h('button', { onClick: () => saveConfig(cfg) }, '保存令牌'),
        h('span', null, '　顶栏「Gist 备份 / Gist 恢复」执行操作。令牌仅存于本地。'),
      )
    }

    ctx.ui.registerSettingsPanel({
      id: 'githubGist',
      title: 'GitHub Gist 备份',
      render: () => window.XNoteReact.createElement(Panel, {
        getConfig: () => ctx.settings.get('ui', {}),
        saveConfig: (cfg) => ctx.settings.set('ui', cfg)
      })
    })
  }
}
