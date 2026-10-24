// ===== Git 仓库适配器（Tauri shell 执行 git，仅桌面端） =====
import type { SyncProvider } from './types'
import type { SyncFileInfo } from '../sync'
import { contentHash } from '../sync'
import { isTauri } from '../../../lib/storage'

export interface GitConfig { remote?: string; branch?: string }

/** Git 命令构造（纯函数，可单测） */
export const gitCmd = {
  fetch: (branch: string, remote: string): [string, string[]] => ['git', ['fetch', remote]],
  refOf: (remote: string, branch: string): string => `${remote}/${branch}`,
  show: (ref: string, path: string): [string, string[]] => ['git', ['show', `${ref}:${path}`]],
  lsTree: (ref: string): [string, string[]] => ['git', ['ls-tree', '-r', '--name-only', ref]],
  addCommitPush: (msg: string): [string, string[]] => ['git', ['add', '-A']],
  commit: (msg: string): [string, string[]] => ['git', ['commit', '-m', msg]],
  push: (remote: string, branch: string): [string, string[]] => ['git', ['push', remote, branch]]
}

async function runGit(args: string[]): Promise<string> {
  if (!isTauri()) throw new Error('Git 同步仅桌面端可用（需 Tauri shell 执行 git）')
  const { Command } = await import('@tauri-apps/plugin-shell')
  const cmd = Command.create('git', args)
  const out = await cmd.execute()
  if (out.code !== 0) throw new Error(out.stderr || `git ${args[0]} 退出码 ${out.code}`)
  return out.stdout
}

export function createGitProvider(cfg: GitConfig): SyncProvider {
  const remote = cfg.remote || 'origin'
  const branch = cfg.branch || 'main'
  const ref = gitCmd.refOf(remote, branch)
  return {
    id: 'git',
    label: 'Git 仓库',
    async test() {
      try {
        await runGit(gitCmd.fetch(branch, remote)[1])
        return { ok: true, message: `已 fetch ${ref}` }
      } catch (e) { return { ok: false, message: String(e) } }
    },
    async list() {
      const out: Record<string, SyncFileInfo> = {}
      const files = (await runGit(gitCmd.lsTree(ref)[1])).split('\n').filter(f => f.toLowerCase().endsWith('.md'))
      for (const f of files) {
        try {
          const content = await runGit(gitCmd.show(ref, f)[1])
          out[f] = { hash: contentHash(content), updated: 0 }
        } catch { /* 单文件失败跳过 */ }
      }
      return out
    },
    async pull(path) { return runGit(gitCmd.show(ref, path)[1]) },
    async push(_path, _content) { /* 内容改动走统一 add/commit/push */ },
    async remove(_path) { /* 删除同样走统一提交 */ },
    async afterSync() {
      await runGit(gitCmd.addCommitPush('x-note sync')[1])
      try { await runGit(gitCmd.commit('x-note sync')[1]) } catch { /* 无改动时 commit 失败可忽略 */ }
      await runGit(gitCmd.push(remote, branch)[1])
    }
  }
}
