/** X-Note jsdom 冒烟测试：加载生产构建，验证核心功能可交互 */
const { JSDOM } = require('jsdom')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
let passed = 0, failed = 0
const check = (name, cond) => { cond ? (passed++, console.log(`  ✔ ${name}`)) : (failed++, console.log(`  ✘ ${name}`)) }

;(async () => {
  const dom = await JSDOM.fromURL('http://127.0.0.1:4620/', {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true
  })
  const { window } = dom
  const { document } = window
  await new Promise(r => window.addEventListener('load', r))
  await sleep(1200) // React 渲染 + 插件加载

  const $ = s => document.querySelector(s)
  const $$ = s => document.querySelectorAll(s)
  const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))

  console.log('\n[1] 启动与示例笔记库')
  check('React 应用挂载（.app 存在）', !!$('.app'))
  check('内置示例笔记已注入 localStorage', Object.keys(JSON.parse(window.localStorage.getItem('xnote:lib') || '{}')).length >= 5)
  check('文件树渲染多个节点', $$('.tree-node').length >= 5)
  check('标签栏渲染出激活标签', !!$('.tab.active'))
  check('编辑器载入欢迎笔记内容', $('.editor-textarea')?.value.includes('欢迎使用 X-Note'))

  console.log('\n[2] Markdown 实时预览（分屏）')
  check('预览渲染出 H1 标题', !!$('.md-body h1'))
  const ta = $('.editor-textarea')
  ta.value = '# 冒烟测试标题\n\n**加粗内容**\n\n$$\nE=mc^2\n$$\n'
  ta.dispatchEvent(new window.Event('input', { bubbles: true }))
  await sleep(100) // 预览是同步 effect
  check('输入后预览出现新标题', $('.md-body')?.textContent.includes('冒烟测试标题'))
  check('KaTeX 行内公式渲染（katex 元素）', !!$('.md-body .katex'))
  await sleep(600) // 等待自动保存防抖
  const lib = JSON.parse(window.localStorage.getItem('xnote:lib'))
  check('自动保存已写入 localStorage', Object.values(lib).some(m => m.content.includes('冒烟测试标题')))
  check('状态栏显示已保存', document.body.textContent.includes('已保存'))

  console.log('\n[3] 视图切换 / 主题 / 大纲 / 标签')
  const btns = $$('.view-switch button')
  click(btns[2]) // 预览
  check('切到预览模式（编辑器隐藏）', document.querySelector('.workbench').className.includes('view-preview'))
  click(btns[1]) // 分屏
  check('切回分屏模式', document.querySelector('.workbench').className.includes('view-split'))
  const tabsBtn = $$('.panel-tabs button')
  click(tabsBtn[1]) // 标签
  check('标签面板渲染标签列表', $$('.tag-list li').length >= 1)
  click(tabsBtn[2]) // 大纲
  check('大纲面板渲染标题导航', $$('.outline-list li').length >= 1)
  click(tabsBtn[3]) // 反链
  check('反链面板渲染（含欢迎被引用）', $$('.backlink-list li').length >= 1)

  console.log('\n[4] 插件系统（内置云同步 + 外部 hello-world）')
  check('云同步插件注册的「同步」顶栏命令出现', Array.from($$('.tb-btn')).some(b => b.textContent === '同步'))
  check('外部 hello-world 插件命令出现', Array.from($$('.tb-btn')).some(b => b.textContent === 'Hello 世界'))
  click(Array.from($$('.tb-btn')).find(b => b.textContent === 'Hello 世界'))
  await sleep(100)
  check('外部插件 toast 提示显示', $$('.toast').length >= 1)

  console.log('\n[5] 全文搜索')
  const search = $('.sidebar-search')
  search.value = 'mermaid'
  search.dispatchEvent(new window.Event('input', { bubbles: true }))
  await sleep(50)
  check('搜索 mermaid 命中流程图笔记', $$('.search-results li').length >= 1)

  console.log('\n[6] 双向链接渲染')
  check('预览中出现 wikilink（[[欢迎]]）', $$('.md-body .wikilink').length >= 1)

  console.log(`\n========== 结果: ${passed} 通过, ${failed} 失败 ==========`)
  window.close()
  process.exit(failed ? 1 : 0)
})().catch(e => { console.error('测试出错:', e); process.exit(1) })
