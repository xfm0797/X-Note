// ===== WebDAV 适配器（Nextcloud / 群晖等） =====
import type { SyncProvider } from './types'
import type { SyncFileInfo } from '../sync'
import { contentHash } from '../sync'

export interface WebDAVConfig { url: string; user: string; password: string; dir?: string }

function joinUrl(base: string, dir: string, name: string): string {
  const clean = base.replace(/\/+$/, '')
  const d = dir ? '/' + dir.replace(/^\/+|\/+$/g, '') : ''
  return `${clean}${d}/${name.split('/').map(encodeURIComponent).join('/')}`
}

function dirUrl(cfg: WebDAVConfig): string {
  const clean = cfg.url.replace(/\/+$/, '')
  return cfg.dir ? `${clean}/${cfg.dir.replace(/^\/+|\/+$/g, '')}` : clean
}

function authHeader(cfg: WebDAVConfig): Record<string, string> {
  return { Authorization: 'Basic ' + btoa(`${cfg.user}:${cfg.password}`) }
}

export function createWebDAVProvider(cfg: WebDAVConfig): SyncProvider {
  return {
    id: 'webdav',
    label: 'WebDAV',
    async test() {
      try {
        const res = await fetch(dirUrl(cfg) + '/', {
          method: 'PROPFIND',
          headers: { ...authHeader(cfg), Depth: '0' }
        })
        return res.ok || res.status === 207
          ? { ok: true, message: '连接成功' }
          : { ok: false, message: `服务器返回 ${res.status}` }
      } catch (e) { return { ok: false, message: '连接失败：' + String(e) } }
    },
    async list() {
      const out: Record<string, SyncFileInfo> = {}
      const res = await fetch(dirUrl(cfg) + '/', {
        method: 'PROPFIND',
        headers: { ...authHeader(cfg), Depth: '1' }
      })
      if (!res.ok && res.status !== 207) throw new Error(`PROPFIND ${res.status}`)
      const xml = await res.text()
      const doc = new DOMParser().parseFromString(xml, 'application/xml')
      const base = dirUrl(cfg)
      for (const node of Array.from(doc.getElementsByTagName('*'))) {
        if (node.localName !== 'response') continue
        const href = node.getElementsByTagNameNS('*', 'href')[0]?.textContent || ''
        const lm = node.getElementsByTagNameNS('*', 'getlastmodified')[0]?.textContent
        const name = decodeURIComponent(href.split('/').filter(Boolean).pop() || '')
        if (!name.toLowerCase().endsWith('.md')) continue
        if (!href.startsWith(new URL(base + '/', location.href).pathname) && !href.includes(base.replace(/^https?:\/\/[^/]+/, ''))) {
          // 根目录自身的 response 也带 .md 时跳过（通过 Depth:1 第一项是目录本身）
        }
        try {
          const content = await (await fetch(joinUrl(cfg.url, cfg.dir || '', name), { headers: authHeader(cfg) })).text()
          out[name] = { hash: contentHash(content), updated: lm ? new Date(lm).getTime() : 0 }
        } catch { /* 单文件失败跳过 */ }
      }
      return out
    },
    async pull(path) {
      const res = await fetch(joinUrl(cfg.url, cfg.dir || '', path), { headers: authHeader(cfg) })
      if (!res.ok) throw new Error(`GET ${res.status}`)
      return res.text()
    },
    async push(path, content) {
      const res = await fetch(joinUrl(cfg.url, cfg.dir || '', path), {
        method: 'PUT',
        headers: { ...authHeader(cfg), 'Content-Type': 'text/markdown;charset=utf-8' },
        body: content
      })
      if (!res.ok) throw new Error(`PUT ${res.status}`)
    },
    async remove(path) {
      await fetch(joinUrl(cfg.url, cfg.dir || '', path), { method: 'DELETE', headers: authHeader(cfg) })
    }
  }
}
