# X-Note 笔记

本地优先的 Windows 桌面端 Markdown 笔记软件。笔记即标准 .md 文件，离线可用、隐私无忧。

- **技术栈**：Tauri 2（Rust 外壳 + fs/dialog/shell/http 插件）+ React 18 + TypeScript + Vite
- **体积**：桌面安装包仅约数 MB（Rust 内核 + 系统 WebView2，无内嵌浏览器）
- **开发者**：[XFM](https://www.lovou.pw) · GitHub [@xfm0797](https://github.com/xfm0797)
- **核心特性**：Markdown 实时预览、本地笔记库与文件树、全文搜索、文档大纲、自动保存、导入/导出（PDF/HTML/MD）、亮/暗主题、设置面板、KaTeX 数学公式、Mermaid 流程图、双向链接 `[[笔记]]`、反链面板、关系图谱、标签分类、拖拽排序、插件系统（内置云同步插件【WebDAV / 本地镜像 / Git 后端 + 冲突解决面板】+ 外部插件目录动态加载，含 GitHub / Gitee Gist 备份、AI 写作助手等官方插件与 hello-world 开发样板及开发文档）、多窗口、版本历史与 diff 对比、多窗口布局记忆、标签页（可拖拽排序）、编辑器增强、关于（开发者 XFM）

## 一、两种运行模式

本项目前端用 Web 技术（React）实现，通过 Tauri 套上 Windows 桌面外壳：

| 模式 | 说明 | 数据存储 |
| ---- | ---- | -------- |
| 桌面端（Tauri） | 真实 Windows 应用，读写你选择的本地文件夹 | 真实 .md 文件 |
| 浏览器预览（Web） | 在浏览器中直接运行，用于开发验证 | 浏览器 localStorage（内置示例笔记） |

前端代码完全复用，两套环境的差异仅由 `src/lib/storage.ts` 这一个抽象层隔离。

## 二、开发 / 浏览器预览

```bash
npm install
npm run dev        # 启动 Vite dev server，浏览器打开 http://localhost:5173
# 或
npm run preview    # 预览生产构建（dist）
```

浏览器模式下会自动加载一组示例笔记，所有功能（编辑、预览、文件树、搜索、导出、主题）均可完整交互。

## 三、打包 Windows 桌面应用

### 前置依赖（在 Windows 上）

- Node.js ≥ 18
- Rust 工具链（含 cargo）
- WebView2 运行时（Win11 已内置；Win10 需安装）

### 构建命令

```bash
npm install
npm run tauri:dev     # 开发模式，热重载，弹出水桌面窗口
npm run tauri:build   # 生产构建，生成安装包
```

构建完成后，安装包位于：

```
src-tauri/target/release/bundle/
├── nsis/X-Note_0.1.0_x64_zh-CN.exe   # Windows 安装程序（NSIS）
└── msi/X-Note_0.1.0_x64_en-US.msi    # MSI 安装包
```

首次构建前，若图标缺失，可运行 `npm run tauri icon` 由源图 `src-tauri/icons/icon.png` 重新生成各平台图标。

说明：最终 .exe/.msi 建议在 Windows 机器或 Windows CI（GitHub Actions）上构建，结果最稳妥。

### 方式二：GitHub Actions 自动出包（推荐）

仓库已内置 `.github/workflows/release.yml`，推送到 GitHub 后自动执行：

| 触发方式 | 行为 |
| -------- | ---- |
| 推送 `v*` 标签（如 `git tag v0.1.0 && git push origin v0.1.0`） | 在 Windows runner 上构建 .exe(NSIS) 与 .msi，上传 Artifact 并自动创建 GitHub Release 附带安装包 |
| Actions 页手动 Run workflow | 仅构建并上传 Artifact，用于验证出包流程 |

工作流步骤：Checkout → Node 20 → Rust stable → cargo 缓存 → `npm ci` → `npm run tauri:build` → 上传产物 →（标签时）发布 Release。无需额外 secret（Release 使用内置 GITHUB_TOKEN）。

## 四、项目结构

```
X-Note/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx                 # 入口
│   ├── App.tsx                  # 主逻辑（状态、自动保存、搜索、主题、导入导出、插件宿主接入）
│   ├── types.ts                 # 全局类型
│   ├── styles/global.css        # 主题变量、布局、Markdown 排版、代码高亮配色
│   ├── lib/
│   │   ├── storage.ts           # 存储抽象层（Tauri 真实文件 / Web localStorage）
│   │   ├── markdown.ts          # Markdown 渲染（marked + DOMPurify + KaTeX + 双向链接扩展）+ 大纲/标签提取
│   │   ├── export.ts            # 导入/导出（MD / HTML / PDF，含公式与流程图）
│   │   ├── tree.ts              # 树操作纯函数（标签过滤、重排、排序清单）
│   │   ├── history.ts           # 版本历史（快照记录/预算裁剪，Web 与 Tauri 双后端）
│   │   ├── diff.ts              # 行级 diff（LCS + 粗粒度回退，纯函数可单测）
│   │   ├── editorFmt.ts         # 编辑器格式化纯函数（加粗/标题/列表/链接/续写/字数统计）
│   │   ├── tabs.ts              # 标签页顺序操作（moveTab 纯函数）
│   │   ├── assets.ts            # 图片资源保存（Tauri 写 assets/，Web 转 dataURL）
│   │   └── window.ts            # 多窗口（URL 参数打开指定笔记并继承布局）
│   ├── plugins/                 # 插件系统
│   │   ├── types.ts             # 插件契约（PluginContext / EditorApi / HttpApi / PluginDialog）
│   │   ├── host.ts              # 插件宿主（注册表 + UI API + 命令归属跟踪）
│   │   ├── editor-api.ts        # ctx.editor 实现（当前笔记读写 / 选区替换 / 内容订阅）
│   │   ├── net.ts               # ctx.http 实现（桌面端经 Rust 发起，绕开 WebView CORS）
│   │   ├── registry.ts          # 内置插件注册表
│   │   ├── external.ts          # 外部插件目录动态加载（.xnote-plugins/ + Blob URL import）
│   │   └── cloud-sync/          # 云同步插件
│   │       ├── index.tsx        # 插件入口：「同步」命令 + 设置面板（含冲突面板接线）
│   │       ├── sync.ts          # 同步引擎（决策/冲突收集/裁决应用，纯函数可单测）
│   │       ├── ConflictModal.tsx # 冲突解决面板（本地版/远端版/都保留）
│   │       └── providers/       # webdav.ts / localFolder.ts / git.ts
│   └── components/
│       ├── MenuBar.tsx          # 菜单栏（文件/编辑/搜索/视图/插件/设置）+ 常用工具按钮行
│       ├── Sidebar.tsx          # 侧边栏（库名、搜索、文件树、标签、大纲、反链）
│       ├── FileTree.tsx         # 文件树（展开/选中/重命名/删除/拖拽排序）
│       ├── TabBar.tsx           # 标签栏（多笔记标签，可拖拽排序）
│       ├── Editor.tsx           # Markdown 编辑器（格式工具条、快捷键、列表续写、图片插入）
│       ├── Preview.tsx          # 实时预览（代码高亮 + Mermaid + 双向链接）
│       ├── GraphModal.tsx       # 关系图谱（力导引 SVG）
│       ├── HistoryModal.tsx     # 版本历史面板（快照/查看/diff/恢复）
│       ├── AboutModal.tsx       # 关于对话框
│       ├── HelpModal.tsx        # 帮助（Markdown 语法速查）
│       ├── PluginModal.tsx      # 插件自定义弹窗外壳（ctx.ui.showDialog 渲染端）
│       └── SettingsModal.tsx    # 设置面板（外观、自动更新）
└── src-tauri/                   # Tauri 桌面端外壳（Rust）
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/default.json
    ├── build.rs
    ├── src/main.rs
    └── icons/
xnote-external-plugins/          # 官方外部插件（github-gist / gitee-gist / hello-world + 开发文档）
.github/workflows/release.yml    # Windows CI：自动构建 .exe/.msi 并发布 Release
```

## 五、功能清单

- [x] Markdown 编辑 + 实时预览（分屏 / 单栏编辑 / 单栏预览 三种视图可切换）
- [x] 本地笔记库：选择文件夹为库，侧边栏多级文件树
- [x] 笔记管理：新建 / 重命名 / 删除 / 移动（拖拽排序）
- [x] 自动保存（编辑即存，状态栏显示「保存中 / 已保存」）
- [x] 全文搜索（标题 + 正文，结果可点击跳转）
- [x] 文档大纲（标题导航，点击定位）
- [x] 导入（.md 拖入窗口 / 放入库目录）/ 导出（PDF / HTML / .md）
- [x] 亮 / 暗主题（可设为跟随系统）
- [x] 设置面板（主题、字号、默认导出格式、字体）
- [x] 数学公式（KaTeX）：行内 `$E=mc^2$`，块级 `$$...$$`
- [x] 流程图（Mermaid）：```mermaid 代码块自动渲染为图
- [x] 双向链接：`[[笔记名]]` 或 `[[笔记名|别名]]`，点击跳转到同名笔记
- [x] 反链面板：侧边栏展示引用当前笔记的全部笔记（含上下文片段、计数徽标；自引用自动过滤）
- [x] 关系图谱：顶栏「图谱」打开全库关系图（基于 `[[链接]]`，力导引布局）；节点大小随连接数增长，当前笔记及邻居高亮、孤立笔记灰色；滚轮缩放、节点拖拽、单击跳转
- [x] 标签分类：正文 `#标签` 自动汇总，侧边栏点击按标签筛选（支持中文标签；标题行与代码块内不识别）
- [x] 拖拽排序 / 移动：文件树内拖拽重排顺序、拖入文件夹；顺序持久化，重启保持一致
- [x] 插件系统：内置注册式插件宿主，插件可注册菜单命令、设置面板，访问存储/设置/编辑器/网络/自定义弹窗等能力
- [x] 插件 API 扩展（v0.3.0）：`ctx.editor`（读取当前笔记与选区、替换选区/插入/替换全文、内容订阅）、`ctx.http`（桌面端经 Rust 侧请求，绕开 WebView CORS）、`ctx.ui.showDialog`（插件自己的弹窗）
- [x] 云同步插件：WebDAV / 本地文件夹镜像 / Git 三种后端；冲突面板逐项裁决（保留本地版 / 远端版 / 都保留），不再静默覆盖
- [x] 多窗口：顶栏「新窗」在当前笔记的独立窗口中打开，URL 参数定位笔记
- [x] 多窗口布局记忆：侧栏可折叠、可拖拽调宽（180–480px），布局随设置持久化并经 URL 参数传给新窗口
- [x] 版本历史：每次自动保存前将旧内容存为快照（单篇上限 30 个、总预算自动淘汰）；「历史」可查看、预览并恢复
- [x] 版本 diff 对比：「对比当前」做行级对比（LCS，超大文本自动降级粗粒度），新增绿色 / 删除红色并统计增删行数
- [x] 标签页：多笔记标签、点击切换、✕ 关闭；状态按窗口记忆（sessionStorage）+ 全局回退（localStorage）；重命名/移动/删除时同步
- [x] 标签页拖拽排序：拖拽调整顺序，顺序随标签状态持久化
- [x] 外部插件目录动态加载：`.xnote-plugins/` 每个子目录一个插件（plugin.json + main.js，ESM default 导出），Blob URL 动态 import；单插件损坏不影响其他；「设置 → 外部插件」查看状态 / 重载 / 移除 / 一键停用
- [x] .zip 插件包安装：「设置 → 外部插件 → 安装 .zip 插件包」自动解压放入插件目录（含嵌套目录/覆盖安装/非法包校验）
- [x] 插件中心：可配置插件源（GitHub / Gitee 仓库的 index.json），列表展示 + 一键安装 / 更新 / 卸载，多源自动回退与强刷缓存；插件配置项独立在「插件设置」里；自建插件源只需一个公开仓库（见「插件系统」章节）
- [x] 自动更新：基于 Tauri updater（minisign 签名校验 + latest.json 清单），「设置 → 自动更新」检查 / 下载 / 安装 / 重启，配置说明见「自动更新」章节
- [x] 官方外部插件：GitHub / Gitee Gist 备份、AI 写作助手、全库待办看板、批量查找替换、链接健康检查 + hello-world 样板（插件中心一键安装，源码在 [X-Note-Plugins](https://github.com/xfm0797/X-Note-Plugins)）
- [x] 关于：顶栏「关于」展示软件信息与开发者 XFM 主页（www.lovou.pw）与 GitHub（@xfm0797）
- [x] 编辑器增强：
  - 格式工具条：加粗 / 斜体 / 删除线 / 行内代码 / H1–H3 / 链接 / 无序·有序·任务列表 / 引用 / 代码块
  - 快捷键：Ctrl+B 加粗、Ctrl+I 斜体、Tab 两空格缩进
  - Enter 智能续写：无序 / 有序（编号自动 +1）/ 任务 / 引用自动续行，空项再按 Enter 退出
  - 图片插入：粘贴或拖入图片自动存入 assets/（Tauri）或转 dataURL（Web，限 512KB）
  - 状态栏实时显示 行/列 与 字数/词数（中文按字、英文按词）

### 语法速查

| 语法 | 写法 | 说明 |
| ---- | ---- | ---- |
| 行内公式 | `$a^2+b^2=c^2$` | KaTeX 渲染 |
| 块级公式 | `$$ \int_a^b f(x)dx $$` | 独立成行居中 |
| 流程图 | ` ```mermaid ` + graph TD … | 自动渲染为矢量图 |
| 双向链接 | `[[笔记名]]` / `[[笔记名\|别名]]` | 按文件名（去 .md）匹配跳转 |
| 标签 | `#标签` | 正文任意位置；标题行与代码块内不识别 |
| 拖拽 | 鼠标拖拽文件树节点 | 拖到文件夹=移入；拖到文件=前插重排 |

### 编辑器快捷键

| 按键 | 作用 |
| ---- | ---- |
| Ctrl+B / Ctrl+I | 加粗 / 斜体 |
| Tab | 插入两空格缩进 |
| Enter | 列表 / 任务 / 引用自动续写（空项再按退出） |
| 粘贴 / 拖入图片 | 自动存入 assets/ 并插入 `![]()` |

## 六、插件系统

插件契约：

```ts
interface XNotePlugin {
  manifest: { id: string; name: string; version: string; description?: string }
  activate(ctx: PluginContext): void | Promise<void>
  deactivate?(ctx: PluginContext): void
}
```

`PluginContext` 能力分区：

| 能力 | 说明 |
| --- | --- |
| `ctx.storage` | 读写笔记库（`loadAll / readFile / writeFile / deletePath / reloadLibrary`） |
| `ctx.editor` | 当前编辑器：`active() / getContent() / setContent() / getSelection() / replaceSelection() / insertText() / replaceRange() / select() / focus() / onChange()` |
| `ctx.http` | 网络请求：`request() / postJSON() / getJSON()`（桌面端在 Rust 侧发出，不受 WebView CORS 限制） |
| `ctx.settings` | 插件独立设置，按 `xnote:plugin:<插件id>:<key>` 命名空间隔离 |
| `ctx.ui` | `registerCommand`（插件菜单项）/ `registerSettingsPanel`（插件设置面板）/ `showDialog`（插件自己的弹窗）/ `closeDialog` / `showToast` |
| `ctx.log` | 带插件 id 前缀的控制台日志 |

`ctx.editor` 的写入走应用同一条自动保存与历史快照链路（用户可用 Ctrl+Z 撤销），因此插件不必自己写文件：

```js
// 选中内容 + 生成结果替换回去（AI 写作助手的核心三步）
const sel = ctx.editor.getSelection()          // { text, start, end }
const out = await ctx.http.postJSON(url, body, { Authorization: 'Bearer ' + key })
ctx.editor.replaceSelection(out.data.choices[0].message.content)

// 只想追加：insertText / replaceRange；整篇重写：setContent / replaceRange(0, len, ...)
ctx.editor.onChange(c => console.log('正文变化', c.length))   // 返回取消订阅函数
```

`ctx.ui.showDialog` 让插件拥有自己的窗口（宿主只提供外壳：标题、宽度、关闭、Esc）：

```js
ctx.ui.showDialog({
  id: 'my-plugin',
  title: '我的工具',
  width: 720,
  render: () => window.XNoteReact.createElement(MyPanel, { ctx })
})
```

外部插件用 `ctx.http` 调第三方 API（OpenAI 兼容接口、WebDAV、图床等）：桌面端请求由 Rust 侧发出，绕开浏览器同源策略；浏览器预览模式退回 `fetch`，需要目标服务允许跨域。

### 云同步插件

- **多后端抽象**：`SyncProvider` 接口统一 `list / pull / push / remove / test`（含可选 afterSync 收尾钩子）
  - WebDAV：Nextcloud / 群晖等
  - 本地文件夹镜像：Web 预览模式用 localStorage 模拟远端
  - Git 仓库：笔记库即工作树，fetch 远端后逐文件比对，本地改动统一 add/commit/push（仅桌面端，需 git）
- 同步引擎单文件决策为纯函数（可单测）；冲突弹面板逐项选择「保留本地版 / 保留远端版 / 都保留」（本地版另存为 `xxx.conflict.md`）
- 使用：顶栏「同步」一键同步；冲突时引导至「设置 → 云同步」裁决

### AI 写作助手（官方插件）

插件中心安装「AI 写作助手」后，菜单「插件」下会出现 5 个入口：打开助手 / 润色选中内容 / 翻译选中内容 / 全文摘要 / 生成标题与标签。

- **自带接口配置**：任意 OpenAI 兼容的 `/chat/completions` 服务，填 baseURL + API Key + 模型名即可（内置 DeepSeek / Kimi / 通义千问 / 智谱 GLM / OpenAI 预设，自建网关、Ollama 之类也能填）；「测试连接」当场验证 Key 与模型名
- **写回方式**：结果可先手动修改，再「替换选区 / 插入到光标 / 替换全文」（替换全文需二次确认）；标题标签模式下可分别「应用标题」（替换或插入 H1）与「应用标签」（写到标题下一行，已存在的自动跳过）
- **隐私**：Key 只存在本机 localStorage（`xnote:plugin:ai-writer:cfg`），请求直接从你的电脑发往你填的接口，不经过任何中转

### 外部插件目录（动态加载）

```
<笔记库>/.xnote-plugins/
└── my-plugin/
    ├── plugin.json     # { id, name, version, description?, main? }
    └── main.js         # ESM，default 导出插件对象
```

启动与「重载插件目录」时自动扫描加载；单个插件损坏只影响自身，错误展示在「设置 → 外部插件」。安全提示：外部插件以应用的完整权限执行代码，请仅安装信任来源的插件。

在外部插件中构建设置面板：不能 import 'react'，宿主把 React 挂在 `window.XNoteReact` 上，用 `createElement` + hooks 即可。

## 七、数据说明

- **桌面端**：所有笔记是笔记库文件夹中的标准 .md 文件。辅助数据（均以 `.` 开头）：
  - `.xnote-order.json`：文件树排序清单
  - `.xnote-history/`：版本历史快照（每篇一个 JSON，单篇上限 30 个）
  - `assets/`：粘贴 / 拖入的图片
  - `.xnote-plugins/`：外部插件目录
- **浏览器预览模式**：数据保存在 localStorage，仅用于演示
- **多窗口**：新窗口 URL 参数 `?note=路径&view=视图&sidebar=侧栏&sw=侧栏宽度`
- **标签页**：sessionStorage（`xnote:tabs:session`）+ localStorage（`xnote:tabs:last`）
- **插件配置**：localStorage（`xnote:plugin:<键>`）

## 八、自动更新（Tauri updater）

应用内置自动更新：`设置 → 自动更新` 可检查更新 → 下载并安装 → 重启生效。更新包经 minisign 私钥签名，应用内置公钥校验，防篡改。

### 涉及的全部配置

| 配置位置 | 配置项 | 当前值 / 说明 |
| ---- | ---- | ---- |
| `src-tauri/tauri.conf.json` | `bundle.createUpdaterArtifacts` | `true`——构建时生成更新产物及 `.sig` 签名文件 |
| `src-tauri/tauri.conf.json` | `plugins.updater.pubkey` | minisign 公钥（与应用安装包内置一致，换钥需重新发版） |
| `src-tauri/tauri.conf.json` | `plugins.updater.endpoints` | `https://github.com/xfm0797/X-Note/releases/latest/download/latest.json`——固定指向最新 Release 的清单文件 |
| `src-tauri/Cargo.toml` | `tauri-plugin-updater` / `tauri-plugin-process` | 更新器与重启插件（Rust 侧） |
| `src-tauri/capabilities/default.json` | `updater:default` / `process:allow-restart` | 前端调用更新 / 重启的权限 |
| `.github/workflows/release.yml` | `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | **仓库 Secrets**（见下），CI 构建时用于签名 |
| `scripts/gen-latest.mjs` | — | CI 在打 tag 构建后生成 `latest.json`（版本号、签名、安装包下载地址）并随 Release 上传 |

### 发版前的一次性配置（必须）

1. 在 GitHub 仓库 `X-Note` → Settings → Secrets and variables → Actions → New repository secret：
   - Name：`TAURI_SIGNING_PRIVATE_KEY`，Value：私钥文件 `xnote.key` 的**完整内容**（含 untrusted comment 行和 base64 串；私钥不在仓库中，注意备份）
   - Name：`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`，Value：私钥密码（当前密钥为空密码，填空即可；不建也可以，CI 会传空串）
2. 未配置私钥时 CI 构建会在签名步骤失败（tauri build 检测到 `createUpdaterArtifacts: true` 但无签名密钥）。

### 更新流程

1. 改代码 → 把 3 个版本文件（`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`）升到新版本号
2. `git tag v0.x.y && git push origin v0.x.y` → CI 构建 NSIS/MSI + 签名 → 生成 `latest.json` → 全部上传到 Release
3. 已安装的用户在「设置 → 自动更新」点「检查更新」：应用从 endpoints 拉取 `latest.json`，比对版本号 → 下载安装包 → 公钥校验签名 → 安装 → 重启

### latest.json 格式

```json
{
  "version": "0.2.0",
  "notes": "X-Note 0.2.0 更新。详情见 Release 页面。",
  "pub_date": "2026-10-25T04:00:00.000Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<安装包 .sig 文件内容>",
      "url": "https://github.com/xfm0797/X-Note/releases/download/v0.2.0/X-Note_0.2.0_x64-setup.exe"
    }
  }
}
```

## 九、插件中心与 .zip 插件包安装

### 安装 .zip 插件包

「插件 → 插件中心 → ⬆ 安装 .zip 插件包」选择 zip 文件即可，应用自动完成：
- 解压并定位 `plugin.json`（根目录或单个顶层目录包装均可）
- 校验清单（缺 id/name 报错）与入口文件（`main` 字段或默认 `main.js`）
- 桌面端解压写入 `<笔记库>/.xnote-plugins/<插件名>/`（同名插件覆盖更新）；Web 预览模式存入 localStorage 模拟目录

### 插件中心（GitHub / Gitee 仓库作插件源）

应用默认插件源为官方中心 [X-Note-Plugins](https://github.com/xfm0797/X-Note-Plugins)（经 jsDelivr CDN 分发，国内访问友好）：
`https://cdn.jsdelivr.net/gh/xfm0797/X-Note-Plugins@main/index.json`

「插件 → 插件中心」刷新列表即可浏览官方插件并一键**安装 / 更新 / 卸载**：列表会标出「未安装 / 已是最新 / 可更新（已装 vX）」，
已装插件在「已安装」分区也能直接卸载（删除 `<笔记库>/.xnote-plugins/<插件名>/`，不影响笔记内容）。

插件的配置项不在插件中心，走「插件 → 插件设置…」——只放各插件自己的 `registerSettingsPanel` 面板，装多了也不会把安装列表顶下去。

**自建插件中心**同样可行——插件中心就是一个「索引 + 插件包」的静态仓库：

1. 新建公开仓库（GitHub 或 Gitee 均可；桌面端索引与插件包都由 Rust 侧请求，不受 WebView 同源策略限制）
2. 仓库根放 `index.json`：
   ```json
   [
     { "id": "demo", "name": "演示插件", "version": "1.0.0",
       "description": "示例", "author": "XFM",
       "zip": "https://gitee.com/<user>/<repo>/releases/download/v1/demo.zip" }
   ]
   ```
   也支持对象格式 `{ "plugins": [...] }`。`zip` 地址可指向同一仓库的 Release 资产（推荐，可下大文件）或仓库内直接提交的 zip 的 raw 地址
3. 把插件按「外部插件目录」规范打好 zip 上传
4. 应用内「插件 → 插件中心」填入 raw 索引地址（如 `https://gitee.com/<user>/<repo>/raw/main/index.json` 或 `https://raw.githubusercontent.com/<user>/<repo>/main/index.json`）→ 刷新列表 → 安装

注意事项：
- Gitee raw 有访问频率限制且仓库必须公开，且**不返回 CORS 头**（所以只在桌面端可用，Web 预览模式会失败）
- GitHub raw 在国内部分网络环境可能不稳定，可换用 jsDelivr CDN 镜像（`https://cdn.jsdelivr.net/gh/<user>/<repo>@main/index.json`）
- CDN 会缓存索引（jsDelivr 默认 7 天），应用每次刷新都会加时间戳绕过缓存；自建源若也走 CDN，改完 index.json 记得刷新一次

### 后续可扩展

更多同步后端（对象存储等）/ 插件中心签名校验 / 标签页拖拽到窗口外分离 / 历史版本两两对比。
