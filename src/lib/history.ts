// ===== 版本历史：快照记录 / 预算裁剪（Web 与 Tauri 双后端） =====
import type { HistorySnapshot } from '../types'
import { isTauri } from './storage'

const MAX_PER_NOTE = 30
const TOTAL_BUDGET = 1500

const H_KEY = (p: string) => `xnote:history:${p}`
const ALL_KEY = 'xnote:history:__all__'

function safeName(path: string): string {
  return path.replace(/[^A-Za-z0-9._-]/g, '_')
}

function indexAll(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(ALL_KEY) || '{}') } catch { return {} }
}
function writeIndexAll(idx: Record<string, number>) {
  localStorage.setItem(ALL_KEY, JSON.stringify(idx))
}

/** 保存前调用：把旧内容存为快照 */
export async function pushSnapshot(path: string, oldContent: string): Promise<void> {
  if (!oldContent) return
  let list: HistorySnapshot[]
  if (isTauri()) {
    const fs = await import('@tauri-apps/plugin-fs')
    const { getLibraryRoot } = await import('./storage')
    const root = await getLibraryRoot()
    if (!root) return
    const file = `${root}/.xnote-history/${safeName(path)}.json`
    try { list = JSON.parse(await fs.readTextFile(file)) } catch { list = [] }
    list.unshift({ ts: Date.now(), content: oldContent })
    list = list.slice(0, MAX_PER_NOTE)
    await fs.writeTextFile(file, JSON.stringify(list))
    return
  }
  try { list = JSON.parse(localStorage.getItem(H_KEY(path)) || '[]') } catch { list = [] }
  list.unshift({ ts: Date.now(), content: oldContent })
  list = list.slice(0, MAX_PER_NOTE)
  localStorage.setItem(H_KEY(path), JSON.stringify(list))
  // 总预算淘汰
  const idx = indexAll()
  idx[path] = list.length
  let total = Object.values(idx).reduce((a, b) => a + b, 0)
  if (total > TOTAL_BUDGET) {
    for (const p of Object.keys(idx).sort((a, b) => (idx[a] || 0) - (idx[b] || 0))) {
      if (total <= TOTAL_BUDGET) break
      const remove = Math.min(idx[p] || 0, total - TOTAL_BUDGET)
      try {
        const arr: HistorySnapshot[] = JSON.parse(localStorage.getItem(H_KEY(p)) || '[]')
        arr.splice(arr.length - remove, remove)
        localStorage.setItem(H_KEY(p), JSON.stringify(arr))
        idx[p] = arr.length
        total -= remove
        if (!arr.length) { localStorage.removeItem(H_KEY(p)); delete idx[p] }
      } catch { break }
    }
    writeIndexAll(idx)
  } else {
    writeIndexAll(idx)
  }
}

export async function listSnapshots(path: string): Promise<HistorySnapshot[]> {
  if (isTauri()) {
    try {
      const fs = await import('@tauri-apps/plugin-fs')
      const { getLibraryRoot } = await import('./storage')
      const root = await getLibraryRoot()
      if (!root) return []
      return JSON.parse(await fs.readTextFile(`${root}/.xnote-history/${safeName(path)}.json`))
    } catch { return [] }
  }
  try { return JSON.parse(localStorage.getItem(H_KEY(path)) || '[]') } catch { return [] }
}

export async function deleteAllSnapshots(path: string): Promise<void> {
  if (isTauri()) {
    try {
      const fs = await import('@tauri-apps/plugin-fs')
      const { getLibraryRoot } = await import('./storage')
      const root = await getLibraryRoot()
      if (root) await fs.remove(`${root}/.xnote-history/${safeName(path)}.json`)
    } catch { /* ignore */ }
    return
  }
  localStorage.removeItem(H_KEY(path))
}
