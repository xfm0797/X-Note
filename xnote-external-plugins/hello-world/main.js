// hello-world：X-Note 外部插件开发样板（最小完整用法）
// 演示：注册顶栏命令 + 设置面板 + storage 读写 + 配置持久化
// 安装：复制本目录到 <笔记库>/.xnote-plugins/，然后「设置 → 外部插件 → 重载插件目录」
export default {
  manifest: {
    id: 'hello-world',
    name: 'Hello World 样板',
    version: '1.0.0',
    description: '演示命令 + 设置面板 + storage 读写'
  },

  activate(ctx) {
    // 1) 命令：统计点击次数（配置持久化）
    let count = ctx.settings.get('count', 0)
    ctx.ui.registerCommand({
      id: 'hello-world.greet',
      title: 'Hello 世界',
      run: async () => {
        count++
        ctx.settings.set('count', count)
        const lib = await ctx.storage.loadAll()
        ctx.ui.showToast(`Hello from external plugin! 笔记共 ${Object.keys(lib).length} 篇，已点击 ${count} 次`, 'success')
      },
    })

    // 2) 设置面板：签名配置（经 window.XNoteReact 渲染，无构建步骤）
    function Panel({ getConfig, saveConfig }) {
      const { createElement: h, useState } = window.XNoteReact
      const [cfg, setCfg] = useState(getConfig())
      return h('div', null,
        h('label', null, '签名：'),
        h('input', { value: cfg.sign || '', onChange: (e) => setCfg({ ...cfg, sign: e.target.value }) }),
        h('button', {
          onClick: () => {
            saveConfig(cfg)
            // 3) storage 读写演示：把签名写入一篇笔记
            ctx.storage.writeFile('hello-world-留言板.md', `# Hello World 留言板\n\n${cfg.sign || '（空）'}\n`)
              .then(() => ctx.storage.reloadLibrary())
            alert('已保存签名并写入 hello-world-留言板.md')
          }
        }, '保存'),
      )
    }

    ctx.ui.registerSettingsPanel({
      id: 'hello-world',
      title: 'Hello World 样板',
      render: () => window.XNoteReact.createElement(Panel, {
        getConfig: () => ctx.settings.get('ui', {}),
        saveConfig: (cfg) => ctx.settings.set('ui', cfg),
      }),
    })

    ctx.log('hello-world 插件已激活')
  },

  deactivate(ctx) {
    // 可选清理：命令/面板由宿主按归属自动移除
  },
}
