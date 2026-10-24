// ===== 文件树：构建 / 排序 / 拖拽重排（纯函数） =====
import type { NoteMeta, TreeItem } from '../types'

const ORDER_KEY = 'xnote:order'

export function loadOrder(): string[] {
  try { return JSON.parse(localStorage.getItem(ORDER_KEY) || '[]') } catch { return [] }
}
export function saveOrder(order: string[]) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(order))
}

/** 由路径集合构建多级文件树 */
export function buildTree(lib: Record<string, NoteMeta>): TreeItem[] {
  const root: TreeItem = { type: 'dir', name: '', path: '', children: [] }
  for (const path of Object.keys(lib)) {
    const parts = path.split('/')
    let cur = root
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1
      const p = parts.slice(0, i + 1).join('/')
      if (isLast) {
        cur.children!.push({ type: 'file', name: parts[i], path: p })
      } else {
        let next = cur.children!.find(c => c.type === 'dir' && c.path === p)
        if (!next) { next = { type: 'dir', name: parts[i], path: p, children: [] }; cur.children!.push(next) }
        cur = next
      }
    }
  }
  return sortTree(root.children!, loadOrder())
}

/** 按排序清单排序（清单优先，其余按名称），目录在前 */
export function sortTree(items: TreeItem[], order: string[]): TreeItem[] {
  const idx = (it: TreeItem) => { const i = order.indexOf(it.path); return i === -1 ? 1e9 : i }
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    const d = idx(a) - idx(b)
    return d !== 0 ? d : a.name.localeCompare(b.name, 'zh-CN')
  })
  for (const it of items) if (it.type === 'dir' && it.children) sortTree(it.children, order)
  return items
}

/** 过滤树（按关键词或标签命中的路径集合） */
export function filterTree(items: TreeItem[], keep: Set<string>): TreeItem[] {
  const out: TreeItem[] = []
  for (const it of items) {
    if (it.type === 'file') { if (keep.has(it.path)) out.push(it) }
    else {
      const kids = it.children ? filterTree(it.children, keep) : []
      if (kids.length) out.push({ ...it, children: kids })
    }
  }
  return out
}

/** 生成排序清单全量快照（桌面端可写入 .xnote-order.json） */
export function orderSnapshot(items: TreeItem[]): string[] {
  const list: string[] = []
  const walk = (arr: TreeItem[]) => { for (const it of arr) { list.push(it.path); if (it.children) walk(it.children) } }
  walk(items)
  return list
}

/**
 * 拖拽重排：拖到文件夹 = 移入末尾；拖到文件 = 前插重排。
 * 返回新的 order 清单。
 */
export function moveNode(order: string[], dragged: string, target: string): string[] {
  const list = order.slice()
  const at = (p: string) => list.indexOf(p)
  if (at(dragged) === -1) list.push(dragged)
  // 从原位置移除
  const di = list.indexOf(dragged)
  if (di !== -1) list.splice(di, 1)
  const ti = list.indexOf(target)
  if (ti === -1) list.push(dragged)
  else list.splice(ti, 0, dragged) // 前插
  return list
}

export function isDescendant(maybeChild: string, ancestor: string): boolean {
  return maybeChild.startsWith(ancestor + '/')
}

export function baseName(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

export function stripMd(name: string): string {
  return name.replace(/\.md$/i, '')
}
