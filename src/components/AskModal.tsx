// ===== 应用内对话框服务：替代原生 prompt/confirm/alert =====
// Tauri WebView 下原生对话框标题显示为 "tauri://localhost"（Tauri.local），
// 且无法定制，故统一改用应用内自绘对话框 + Toast。
import React, { useEffect, useState } from 'react'

type MenuOption = { id: string; label: string; danger?: boolean }

type Req =
  | { kind: 'text'; title: string; def: string; resolve: (v: string | null) => void }
  | { kind: 'confirm'; title: string; danger: boolean; resolve: (v: boolean) => void }
  | { kind: 'menu'; title: string; items: MenuOption[]; resolve: (v: string | null) => void }

const queue: Req[] = []
let current: Req | null = null
const dialogSubs = new Set<() => void>()

function emitDialog() { dialogSubs.forEach(f => f()) }
function pump() {
  if (current || !queue.length) { emitDialog(); return }
  current = queue.shift()!
  emitDialog()
}
function finish(req: Req, value: unknown) {
  if (current !== req) return
  current = null
  ;(req.resolve as (v: unknown) => void)(value)
  pump()
}

/** 文本输入对话框（返回 null 表示取消） */
export function askText(title: string, def = ''): Promise<string | null> {
  return new Promise(resolve => { queue.push({ kind: 'text', title, def, resolve }); pump() })
}

/** 确认对话框 */
export function askConfirm(title: string, danger = false): Promise<boolean> {
  return new Promise(resolve => { queue.push({ kind: 'confirm', title, danger, resolve }); pump() })
}

/** 选项菜单对话框（右键菜单等，返回 null 表示取消） */
export function askMenu(title: string, items: MenuOption[]): Promise<string | null> {
  return new Promise(resolve => { queue.push({ kind: 'menu', title, items, resolve }); pump() })
}

/* ---------- 全局 Toast（替代 alert） ---------- */
type Toast = { id: number; text: string; kind: string }
let toastSeq = 0
const toasts: Toast[] = []
const toastSubs = new Set<() => void>()
function emitToast() { toastSubs.forEach(f => f()) }

export function appToast(text: string, kind: 'info' | 'success' | 'error' = 'info') {
  const t: Toast = { id: ++toastSeq, text, kind }
  toasts.push(t)
  emitToast()
  setTimeout(() => {
    const i = toasts.indexOf(t)
    if (i >= 0) toasts.splice(i, 1)
    emitToast()
  }, 3200)
}

/* ---------- 渲染宿主（挂在 App 根部一次即可） ---------- */
export function DialogHost() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const d = () => setTick(x => x + 1)
    dialogSubs.add(d); toastSubs.add(d)
    return () => { dialogSubs.delete(d); toastSubs.delete(d) }
  }, [])

  const onKey = (e: React.KeyboardEvent) => {
    const cur = current
    if (!cur) return
    if (e.key === 'Escape') {
      e.stopPropagation()
      finish(cur, cur.kind === 'confirm' ? false : null)
    } else if (e.key === 'Enter' && cur.kind === 'text') {
      e.stopPropagation()
      finish(cur, cur.def)
    }
  }

  const dismiss = () => {
    const c = current
    if (!c) return
    finish(c, c.kind === 'confirm' ? false : null)
  }

  return (
    <>
      {current && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) dismiss() }} onKeyDown={onKey}>
          <div className="modal dlg" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{current.title}</div>
            {current.kind === 'text' && (
              <input
                className="dlg-input" autoFocus
                defaultValue={current.def}
                ref={el => el && requestAnimationFrame(() => { el.focus(); el.select() })}
                onChange={e => { if (current?.kind === 'text') current.def = e.target.value }}
              />
            )}
            {current.kind === 'menu' && (
              <div className="dlg-menu">
                {current.items.map(it => (
                  <div key={it.id} className={`dlg-menu-item ${it.danger ? 'danger' : ''}`}
                    onClick={() => finish(current!, it.id)}>{it.label}</div>
                ))}
              </div>
            )}
            <div className="modal-btns">
              {current.kind === 'confirm' ? (
                <>
                  <button className="btn" onClick={() => finish(current!, false)}>取消</button>
                  <button className={`btn primary ${current.danger ? 'danger' : ''}`} onClick={() => finish(current!, true)} autoFocus>
                    {current.danger ? '删除' : '确定'}
                  </button>
                </>
              ) : current.kind === 'text' ? (
                <>
                  <button className="btn" onClick={() => finish(current!, null)}>取消</button>
                  <button className="btn primary" onClick={() => { if (current) finish(current, (current as { def: string }).def) }}>确定</button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
      <div className="toasts">
        {toasts.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
      </div>
    </>
  )
}
