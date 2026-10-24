// ===== 本地文件夹镜像（Web 模式用 localStorage 模拟远端） =====
import type { SyncProvider } from './types'
import type { SyncFileInfo } from '../sync'
import { contentHash } from '../sync'

const KEY = 'xnote:cloud-remote'

interface RemoteFile { content: string; updated: number }

function readRemote(): Record<string, RemoteFile> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}
function writeRemote(r: Record<string, RemoteFile>) {
  localStorage.setItem(KEY, JSON.stringify(r))
}

export function createLocalFolderProvider(): SyncProvider {
  return {
    id: 'localFolder',
    label: '本地文件夹镜像',
    async test() { return { ok: true, message: 'Web 模式使用 localStorage 模拟远端镜像' } },
    async list() {
      const out: Record<string, SyncFileInfo> = {}
      for (const [p, f] of Object.entries(readRemote()))
        out[p] = { hash: contentHash(f.content), updated: f.updated }
      return out
    },
    async pull(path) { return readRemote()[path]?.content ?? '' },
    async push(path, content) {
      const r = readRemote(); r[path] = { content, updated: Date.now() }; writeRemote(r)
    },
    async remove(path) { const r = readRemote(); delete r[path]; writeRemote(r) },
    async afterSync() { /* 本地镜像无需收尾 */ }
  }
}
