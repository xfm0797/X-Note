// ===== 存储抽象层：Tauri 真实 .md 文件 / 浏览器 localStorage =====
import type { NoteMeta } from '../types'

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const LIB_KEY = 'xnote:lib'
const ROOT_KEY = 'xnote:root'

/** 示例笔记（浏览器预览模式首次运行时加载） */
function sampleLibrary(): Record<string, NoteMeta> {
  const now = Date.now()
  const mk = (content: string): NoteMeta => ({ content, updated: now })
  return {
    '欢迎.md': mk(`# 欢迎使用 X-Note 📝

本地优先的 Markdown 笔记软件。笔记即标准 .md 文件，离线可用、隐私无忧。

- 开发者：[XFM](https://www.lovou.pw) · GitHub [@xfm0797](https://github.com/xfm0797)
- 桌面端基于 Tauri 2，浏览器预览模式数据存于 localStorage

## 快速开始

1. 侧边栏文件树：新建 / 重命名 / 删除 / 拖拽排序
2. 顶栏切换 **编辑 / 分屏 / 预览** 三种视图
3. \`Ctrl+B\` 加粗、\`Ctrl+I\` 斜体，Enter 自动续写列表
4. 正文输入 \`#标签\` 即可自动归类，输入 \`[[笔记名]]\` 建立双向链接

#演示 #入门
`),
    '教程/数学公式.md': mk(`# 数学公式（KaTeX）

行内公式：质能方程 $E=mc^2$ 很著名。

块级公式：

$$
\\int_a^b f(x)\\,dx = F(b) - F(a)
$$

$$
a^2+b^2=c^2
$$
`),
    '教程/流程图.md': mk(`# 流程图（Mermaid）

\`\`\`mermaid
graph TD
  A[开始] --> B{是否登录?}
  B -- 是 --> C[进入笔记]
  B -- 否 --> D[注册账号]
  D --> B
  C --> E[书写笔记]
  E --> F[保存 .md 文件]
\`\`\`
`),
    '项目/双向链接演示.md': mk(`# 双向链接演示

用 \`[[笔记名]]\` 链接到库内其他笔记：

- 参考 [[欢迎]]
- 也可以起别名：[[欢迎|快速入门]]
- 链接到 [[数学公式]] 需要写文件名（去 .md）

侧边栏「反链」面板会列出引用了当前笔记的所有笔记。
相关：[[数学公式]]

#演示
`),
    '项目/同步与备份.md': mk(`# 云同步与备份

顶栏「同步」一键触发云同步插件，支持三种后端：

- **WebDAV**：Nextcloud / 群晖等
- **本地文件夹镜像**：离线备份
- **Git 仓库**：仅桌面端（需 git）

冲突时不再静默覆盖，会弹出冲突面板逐项裁决。

外部插件可从笔记库 \`.xnote-plugins/\` 目录动态加载，详见「设置 → 外部插件」。
`)
  }
}

/* ---------- 浏览器（Web）实现 ---------- */

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function lsSet(key: string, val: string) {
  try { localStorage.setItem(key, val) } catch { /* 容量满时忽略 */ }
}

export function webLoadAll(): Record<string, NoteMeta> {
  const raw = lsGet(LIB_KEY)
  if (raw) { try { return JSON.parse(raw) } catch { /* fallthrough */ } }
  const lib = sampleLibrary()
  lsSet(LIB_KEY, JSON.stringify(lib))
  return lib
}

export function webSaveAll(lib: Record<string, NoteMeta>) {
  lsSet(LIB_KEY, JSON.stringify(lib))
}

/* ---------- Tauri 实现（真实文件） ---------- */

async function tauriFs() {
  return import('@tauri-apps/plugin-fs')
}

export async function getLibraryRoot(): Promise<string | null> {
  if (isTauri()) return lsGet(ROOT_KEY)
  return null
}

export async function chooseLibraryRoot(): Promise<string | null> {
  if (!isTauri()) return null
  const { open } = await import('@tauri-apps/plugin-dialog')
  const dir = await open({ directory: true, title: '选择笔记库文件夹' })
  if (typeof dir === 'string') { lsSet(ROOT_KEY, dir); return dir }
  return null
}

async function tauriLoadAll(): Promise<Record<string, NoteMeta>> {
  const libRoot = await getLibraryRoot()
  if (!libRoot) return {}
  const fs = await tauriFs()
  const root: string = libRoot
  const lib: Record<string, NoteMeta> = {}
  async function walk(rel: string) {
    const full = rel ? `${root}/${rel}` : root
    const entries = await fs.readDir(full)
    for (const e of entries) {
      if (e.name.startsWith('.')) continue // 跳过 .xnote-* 辅助数据
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory) await walk(r)
      else if (e.name.toLowerCase().endsWith('.md')) {
        const st = await fs.stat(full + '/' + e.name)
        lib[r] = { content: await fs.readTextFile(full + '/' + e.name), updated: st?.mtime ? new Date(st.mtime).getTime() : Date.now() }
      }
    }
  }
  await walk('')
  return lib
}

/** 统一存储接口（App 只面向该接口） */
export const storage = {
  async loadAll(): Promise<Record<string, NoteMeta>> {
    return isTauri() ? tauriLoadAll() : webLoadAll()
  },
  async readFile(path: string): Promise<string | null> {
    if (isTauri()) {
      const root = await getLibraryRoot()
      if (!root) return null
      try { return (await tauriFs()).readTextFile(`${root}/${path}`) } catch { return null }
    }
    const lib = webLoadAll()
    return lib[path]?.content ?? null
  },
  async writeFile(path: string, content: string): Promise<void> {
    if (isTauri()) {
      const root = await getLibraryRoot()
      if (!root) return
      const fs = await tauriFs()
      const full = `${root}/${path}`
      const dir = full.slice(0, full.lastIndexOf('/'))
      if (dir && dir !== root) { try { await fs.mkdir(dir, { recursive: true }) } catch { /* 已存在 */ } }
      await fs.writeTextFile(full, content)
      return
    }
    const lib = webLoadAll()
    lib[path] = { content, updated: Date.now() }
    webSaveAll(lib)
  },
  async deletePath(path: string, isDir = false): Promise<void> {
    if (isTauri()) {
      const root = await getLibraryRoot()
      if (!root) return
      await (await tauriFs()).remove(`${root}/${path}`, { recursive: isDir })
      return
    }
    const lib = webLoadAll()
    const prefix = path + '/'
    for (const k of Object.keys(lib)) if (k === path || k.startsWith(prefix)) delete lib[k]
    webSaveAll(lib)
  },
  async renamePath(oldPath: string, newPath: string, isDir = false): Promise<void> {
    if (isTauri()) {
      const root = await getLibraryRoot()
      if (!root) return
      await (await tauriFs()).rename(`${root}/${oldPath}`, `${root}/${newPath}`)
      return
    }
    const lib = webLoadAll()
    const prefix = oldPath + '/'
    for (const k of Object.keys(lib)) {
      if (k === oldPath) { lib[newPath] = lib[k]; delete lib[k] }
      else if (isDir && k.startsWith(prefix)) { lib[newPath + k.slice(oldPath.length)] = lib[k]; delete lib[k] }
    }
    webSaveAll(lib)
  }
}
