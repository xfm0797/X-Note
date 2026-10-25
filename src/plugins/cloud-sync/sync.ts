// ===== 同步引擎（决策/冲突收集/裁决应用，纯函数可单测） =====

export interface SyncFileInfo { hash: string; updated: number }

export type SyncDecision = 'none' | 'push' | 'pull' | 'conflict' | 'delete-local' | 'delete-remote'

/** 内容指纹（简单 FNV-1a） */
export function contentHash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(16)
}

/** 单文件同步决策（base = 上次同步基线） */
export function decideSync(
  local: SyncFileInfo | null,
  remote: SyncFileInfo | null,
  base: SyncFileInfo | null
): SyncDecision {
  const same = (x: SyncFileInfo | null, y: SyncFileInfo | null) =>
    (!x && !y) || (!!x && !!y && x.hash === y.hash)

  if (same(local, remote)) return 'none'                       // 两侧一致
  if (!base) {
    // 首次同步（无基线）：绝不删除任何一侧，只做新增/冲突
    if (local && !remote) return 'push'                        // 仅本地有 → 推送
    if (!local && remote) return 'pull'                        // 仅远端有 → 拉取
    return 'conflict'                                          // 两侧都有但无基线 → 冲突裁决
  }
  if (!remote && local && local.hash !== base.hash) return 'push'      // 远端删除但本地改过 → 推回（保留本地）
  if (!remote) return 'delete-local'                           // 远端删除且本地未改 → 同步删除
  if (!local) return 'pull'                                    // 本地无 → 拉取
  const localChanged = local.hash !== base.hash
  const remoteChanged = remote.hash !== base.hash
  if (localChanged && remoteChanged) return 'conflict'         // 两侧都改 → 冲突
  if (localChanged) return 'push'
  return 'pull'
}

export interface ConflictItem { path: string; local: string; remote: string }
export type ConflictChoice = 'local' | 'remote' | 'both'

/** 冲突裁决结果 → 应执行的动作（纯函数） */
export function resolveConflict(path: string, choice: ConflictChoice, local: string, remote: string) {
  switch (choice) {
    case 'local': return [{ path, content: local }]
    case 'remote': return [{ path, content: remote }]
    case 'both': return [
      { path, content: local },
      { path: path.replace(/\.md$/i, '') + '.conflict.md', content: remote }
    ]
  }
}
