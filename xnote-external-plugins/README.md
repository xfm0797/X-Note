# X-Note 官方外部插件（源码）

这里的目录是可直接运行的外部插件源码，也是插件开发的参考样板。

## 安装

三选一：

1. **整目录安装**：把插件目录复制到你的笔记库 `.xnote-plugins/` 下 → X-Note「插件 → 插件中心… → ↻ 重载目录」
2. **zip 安装**：把插件目录压成 zip → 「插件 → 插件中心… → ⬆ 安装 .zip 插件包」
3. **插件中心**：普通用户直接「插件 → 插件中心…」刷新列表，一键安装 / 更新

## 插件列表

| 插件 | 功能 | 令牌要求 |
| ---- | ---- | -------- |
| `github-gist/` | 笔记库一键备份到 GitHub Gist，支持恢复 | GitHub Personal Access Token（需 `gist` 权限） |
| `gitee-gist/` | 笔记库一键备份到 Gitee 代码片段 | Gitee 私人令牌（需 `gists` + `user_info`） |
| `hello-world/` | 插件开发样板：命令 + 设置面板 + storage 读写 + 配置持久化 | 无 |

更多官方插件（AI 写作助手、待办看板、批量查找替换、链接健康检查等）在插件中心仓库
[X-Note-Plugins](https://github.com/xfm0797/X-Note-Plugins) 上架，应用内「插件 → 插件中心…」即可安装。

## 使用步骤（Gist 备份）

1. 打开 GitHub → Settings → Developer settings → Personal access tokens，勾选 `gist` 权限生成令牌
   （Gitee：设置 → 私人令牌，勾选 `gists` 与 `user_info`）
2. 「插件 → 插件设置…」里填令牌
3. 备份：点「备份到 Gist」；恢复：点「从 Gist 恢复」，远端笔记写回本地库
4. 令牌只存在本机 localStorage（`xnote:plugin:<插件id>:<key>`），不上传到任何第三方

## CORS 说明

两个平台的 API 都支持浏览器跨域，桌面端与浏览器预览模式都能直接调用，无需代理。
需要调**不返回 CORS 头**的服务（OpenAI 兼容接口等）时，请用 `ctx.http` 的桌面端通道。

## 目录结构

```
my-plugin/
├── plugin.json     # 清单：{ id, name, version, description?, main? }
└── main.js         # 入口，ESM default 导出插件对象
```

开发自己的插件：见 **[插件开发指南.md](./插件开发指南.md)**，从 `hello-world/` 样板开始。
上线分发：按指南「发布插件」打成 zip，放进自己的插件中心索引（`index.json`）即可。
