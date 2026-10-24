# X-Note 官方外部插件

复制对应插件目录到你的笔记库 `.xnote-plugins/` 下，然后在 X-Note 中打开
「设置 → 外部插件 → 重载插件目录」即可加载。

## 插件列表

| 插件 | 功能 | 令牌要求 |
| ---- | ---- | -------- |
| `github-gist/` | 笔记库一键备份到 GitHub Gist，支持恢复 | GitHub Personal Access Token（需 `gist` 权限） |
| `gitee-gist/` | 笔记库一键备份到 Gitee 代码片段 | Gitee 私人令牌（需 `gists` + `user_info`） |
| `hello-world/` | 插件开发样板：命令 + 设置面板 + storage 读写 + 配置持久化 | 无 |

## 使用步骤

1. 打开 GitHub → Settings → Developer settings → Personal access tokens，勾选 `gist` 权限生成令牌
   （Gitee：设置 → 私人令牌，勾选 `gists` 与 `user_info`）
2. 备份：插件面板填入令牌后点击「备份到 Gist」
3. 恢复：点击「从 Gist 恢复」，远端笔记将写回本地库
4. 令牌仅保存在浏览器 localStorage（`xnote:plugin:<插件id>`），不上传到任何第三方

## CORS 说明

两个平台的 API 均支持浏览器跨域（CORS），因此桌面端与浏览器预览模式都可以直接调用，
无需任何代理。

## 目录结构

每个插件目录：

```
my-plugin/
├── plugin.json     # 清单：{ id, name, version, description?, main? }
└── main.js         # ESM 模块，default 导出插件对象
```

开发自己的插件：见 [插件开发指南.md](./插件开发指南.md)，从 `hello-world/` 样板开始。
