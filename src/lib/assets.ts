// ===== 图片资源保存（Tauri 写 assets/，Web 转 dataURL，限 512KB） =====
import { isTauri } from './storage'

const MAX_WEB_SIZE = 512 * 1024

export async function saveImage(file: File): Promise<{ ok: true; markdown: string } | { ok: false; error: string }> {
  if (isTauri()) {
    const fs = await import('@tauri-apps/plugin-fs')
    const { getLibraryRoot } = await import('./storage')
    const root = await getLibraryRoot()
    if (!root) return { ok: false, error: '未选择笔记库' }
    const name = `${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const buf = new Uint8Array(await file.arrayBuffer())
    await fs.writeFile(`${root}/assets/${name}`, buf)
    return { ok: true, markdown: `![${file.name}](assets/${name})` }
  }
  if (file.size > MAX_WEB_SIZE) return { ok: false, error: 'Web 预览模式图片限 512KB' }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('读取失败'))
    r.readAsDataURL(file)
  })
  return { ok: true, markdown: `![${file.name}](${dataUrl})` }
}
