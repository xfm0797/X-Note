// ===== 多窗口（Tauri WebviewWindow / Web window.open） =====
import { isTauri } from './storage'

/** 新窗口打开指定笔记并继承布局参数 */
export async function openNoteWindow(params: Record<string, string>): Promise<void> {
  const qs = new URLSearchParams(params).toString()
  if (isTauri()) {
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      const label = `xnote-win-${Date.now().toString(36)}`
      const win = new WebviewWindow(label, {
        url: `${window.location.pathname}?${qs}`,
        title: 'X-Note',
        width: 1100, height: 760
      })
      win.once('tauri://error', () => { /* 窗口创建失败时静默 */ })
      return
    } catch { /* fallthrough to web */ }
  }
  window.open(`${window.location.pathname}?${qs}`, '_blank')
}

/** 解析当前窗口 URL 参数 */
export function windowParams(): URLSearchParams {
  return new URLSearchParams(window.location.search)
}
