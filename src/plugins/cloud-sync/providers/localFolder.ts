// ===== 本地文件夹镜像（桌面端：真实文件夹；浏览器预览：localStorage 模拟） =====
import type { SyncProvider } from './types'
import type { SyncFileInfo } from '../sync'
import { contentHash } from '../sync'
import { isTauri } from '../../../lib/storage'

const KEY = 'xnote:cloud-remote'      // Web 模式模拟远端
const DIR_KEY = 'xnote:sync-local-dir' // 桌面端镜像文件夹路径

interface RemoteFile { content: string; updated: number }

function readRemote(): Record<string, RemoteFile> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}
function writeRemote(r: Record<string, RemoteFile>) {
  localStorage.setItem(KEY, JSON.stringify(r))
}

export function getLocalMirrorDir(): string | null {
  try { return localStorage.getItem(DIR_KEY) } catch { return null }
}
export function setLocalMirrorDir(dir: string) {
  localStorage.setItem(DIR_KEY, dir)
}

async function tauriFs() {
  return import('@tauri-apps/plugin-fs')
}

export function createLocalFolderProvider(): SyncProvider {
  return {
    id: 'localFolder',
    label: '本地文件夹镜像',
    async test() {
      if (!isTauri()) return { ok: true, message: '浏览器预览模式：使用 localStorage 模拟远端镜像' }
      const dir = getLocalMirrorDir()
      if (!dir) return { ok: false, message: '请先选择镜像文件夹（下方按钮）' }
      try { await (await tauriFs()).readDir(dir); return { ok: true, message: `镜像文件夹可用：${dir}` } }
      catch { return { ok: false, message: `无法读取镜像文件夹：${dir}` } }
    },
    async list() {
      if (!isTauri()) {
        const out: Record<string, SyncFileInfo> = {}
        for (const [p, f] of Object.entries(readRemote()))
          out[p] = { hash: contentHash(f.content), updated: f.updated }
        return out
      }
      const dir = getLocalMirrorDir()
      if (!dir) return {}
      const base = dir
      const fs = await tauriFs()
      const out: Record<string, SyncFileInfo> = {}
      async function walk(rel: string) {
        const full = rel ? `${base}/${rel}` : base
        const entries = await fs.readDir(full)
        for (const e of entries) {
          if (e.name.startsWith('.')) continue
          const r = rel ? `${rel}/${e.name}` : e.name
          if (e.isDirectory) await walk(r)
          else if (e.name.toLowerCase().endsWith('.md')) {
            const content = await fs.readTextFile(full + '/' + e.name)
            out[r] = { hash: contentHash(content), updated: Date.now() }
          }
        }
      }
      await walk('')
      return out
    },
    async pull(path) {
      if (!isTauri()) return readRemote()[path]?.content ?? ''
      const dir = getLocalMirrorDir()
      if (!dir) return ''
      try { return await (await tauriFs()).readTextFile(`${dir}/${path}`) } catch { return '' }
    },
    async push(path, content) {
      if (!isTauri()) {
        const r = readRemote(); r[path] = { content, updated: Date.now() }; writeRemote(r)
        return
      }
      const dir = getLocalMirrorDir()
      if (!dir) throw new Error('未配置镜像文件夹，请到 设置 → 云同步 选择')
      const fs = await tauriFs()
      const full = `${dir}/${path}`
      const d = full.slice(0, full.lastIndexOf('/'))
      if (d && d !== dir) { try { await fs.mkdir(d, { recursive: true }) } catch { /* 已存在 */ } }
      await fs.writeTextFile(full, content)
    },
    async remove(path) {
      if (!isTauri()) {
        const r = readRemote(); delete r[path]; writeRemote(r)
        return
      }
      const dir = getLocalMirrorDir()
      if (!dir) return
      try { await (await tauriFs()).remove(`${dir}/${path}`) } catch { /* 文件可能不存在 */ }
    },
    async afterSync() { /* 本地镜像无需收尾 */ }
  }
}
