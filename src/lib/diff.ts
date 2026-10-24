// ===== 行级 diff（LCS + 超大文本粗粒度回退，纯函数） =====
import type { DiffRow } from '../types'

const COARSE_LIMIT = 1_000_000 // a.length*b.length 上限，超出则降级

/** 经典 LCS 行级 diff */
export function diffLines(aText: string, bText: string): DiffRow[] {
  const a = aText.split('\n')
  const b = bText.split('\n')
  if (a.length * b.length > COARSE_LIMIT) return diffCoarse(a, b)

  const m = a.length, n = b.length
  const dp = new Int32Array((m + 1) * (n + 1))
  const at = (i: number, j: number) => i * (n + 1) + j
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[at(i, j)] = a[i] === b[j] ? dp[at(i + 1, j + 1)] + 1 : Math.max(dp[at(i + 1, j)], dp[at(i, j + 1)])

  const rows: DiffRow[] = []
  let i = 0, j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) { rows.push({ type: 'same', text: a[i] }); i++; j++ }
    else if (dp[at(i + 1, j)] >= dp[at(i, j + 1)]) { rows.push({ type: 'del', text: a[i] }); i++ }
    else { rows.push({ type: 'add', text: b[j] }); j++ }
  }
  while (i < m) { rows.push({ type: 'del', text: a[i++] }) }
  while (j < n) { rows.push({ type: 'add', text: b[j++] }) }
  return rows
}

/** 粗粒度回退：按 50 行块哈希做 LCS，块内行保持原样输出 */
function diffCoarse(a: string[], b: string[]): DiffRow[] {
  const chunk = (arr: string[]) => {
    const out: { key: string; lines: string[] }[] = []
    for (let i = 0; i < arr.length; i += 50) {
      const lines = arr.slice(i, i + 50)
      out.push({ key: lines.join('\u0001'), lines })
    }
    return out
  }
  const ac = chunk(a), bc = chunk(b)
  const m = ac.length, n = bc.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = ac[i].key === bc[j].key ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const rows: DiffRow[] = []
  let i = 0, j = 0
  while (i < m && j < n) {
    if (ac[i].key === bc[j].key) { rows.push({ type: 'same', text: ac[i].lines.join('\n') }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { rows.push({ type: 'del', text: ac[i++].lines.join('\n') }) }
    else { rows.push({ type: 'add', text: bc[j++].lines.join('\n') }) }
  }
  while (i < m) rows.push({ type: 'del', text: ac[i++].lines.join('\n') })
  while (j < n) rows.push({ type: 'add', text: bc[j++].lines.join('\n') })
  return rows
}

export function diffStats(rows: DiffRow[]): { added: number; removed: number } {
  let added = 0, removed = 0
  for (const r of rows) { if (r.type === 'add') added++; if (r.type === 'del') removed++ }
  return { added, removed }
}
