// ===== ctx.http 实现：桌面端走 Rust 侧请求（无 CORS），Web 预览退回 fetch =====
// 为什么不能只用 fetch：OpenAI 兼容接口（DeepSeek / Kimi / 通义…）几乎都不返回 CORS 头，
// WebView 里直接 fetch 会被浏览器拦掉；Tauri HTTP 插件在 Rust 侧发请求，不受同源策略限制。
import type { HttpApi, HttpRequestOptions, HttpResult, JsonResult } from './types'
import { isTauri } from '../lib/storage'

async function request(opts: HttpRequestOptions): Promise<HttpResult> {
  const method = (opts.method || 'GET').toUpperCase()
  const timeoutMs = opts.timeoutMs ?? 120_000
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    if (isTauri()) {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
      const res = await tauriFetch(opts.url, {
        method,
        headers: opts.headers,
        body: opts.body,
        signal: ctrl.signal
      })
      const headers: Record<string, string> = {}
      res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v })
      return { status: res.status, ok: res.ok, text: await res.text(), headers }
    }
    const res = await fetch(opts.url, { method, headers: opts.headers, body: opts.body, signal: ctrl.signal })
    const headers: Record<string, string> = {}
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v })
    return { status: res.status, ok: res.ok, text: await res.text(), headers }
  } catch (e) {
    const msg = String(e)
    if (/abort/i.test(msg)) throw new Error(`请求超时（${Math.round(timeoutMs / 1000)}s）：${opts.url}`)
    if (!isTauri()) throw new Error(`${msg}（浏览器预览模式受 CORS 限制，请用桌面版调用第三方 API）`)
    throw new Error(`请求失败：${msg}`)
  } finally {
    clearTimeout(timer)
  }
}

function parseJSON<T>(text: string): T | null {
  try { return JSON.parse(text) as T } catch { return null }
}

export const httpApi: HttpApi = {
  request,
  async postJSON<T = any>(url: string, body: any, headers?: Record<string, string>, timeoutMs?: number): Promise<JsonResult<T>> {
    const res = await request({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
      body: JSON.stringify(body ?? {}),
      timeoutMs
    })
    return { ...res, data: parseJSON<T>(res.text) }
  },
  async getJSON<T = any>(url: string, headers?: Record<string, string>, timeoutMs?: number): Promise<JsonResult<T>> {
    const res = await request({ url, method: 'GET', headers, timeoutMs })
    return { ...res, data: parseJSON<T>(res.text) }
  }
}
