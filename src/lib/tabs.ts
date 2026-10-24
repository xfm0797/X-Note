// ===== 标签页顺序操作（纯函数） =====
export function moveTab<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice()
  const [item] = copy.splice(from, 1)
  copy.splice(Math.max(0, Math.min(copy.length, to)), 0, item)
  return copy
}
