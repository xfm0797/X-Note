// ===== 关系图谱（力导引 SVG，缩放/拖拽/点击跳转） =====
import React, { useEffect, useRef, useState } from 'react'

export interface GraphNode { id: string; label: string; degree: number; active: boolean; neighbor: boolean; isolated: boolean }
export interface GraphEdge { source: string; target: string; unresolved?: boolean }

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onOpenNote(path: string): void
  onClose(): void
}

interface P { x: number; y: number; vx: number; vy: number }

export function GraphModal({ nodes, edges, onOpenNote, onClose }: Props) {
  const W = 900, H = 560
  const [positions, setPositions] = useState<Record<string, P>>(() => {
    const init: Record<string, P> = {}
    nodes.forEach((n, i) => {
      const a = (i / Math.max(1, nodes.length)) * Math.PI * 2
      init[n.id] = { x: W / 2 + Math.cos(a) * 260, y: H / 2 + Math.sin(a) * 200, vx: 0, vy: 0 }
    })
    return init
  })
  const [zoom, setZoom] = useState(1)
  const dragging = useRef<{ id: string | null; ox: number; oy: number }>({ id: null, ox: 0, oy: 0 })
  const raf = useRef(0)
  const posRef = useRef(positions)
  posRef.current = positions

  // 力导引模拟（有限次迭代后收敛）
  useEffect(() => {
    let tick = 0
    const step = () => {
      tick++
      const pos = { ...posRef.current }
      const ks = Object.keys(pos)
      // 斥力
      for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
        const a = pos[ks[i]], b = pos[ks[j]]
        let dx = b.x - a.x, dy = b.y - a.y
        let d2 = dx * dx + dy * dy
        if (d2 < 1) { dx = 1; dy = 1; d2 = 2 }
        const f = 42000 / d2
        const d = Math.sqrt(d2)
        a.vx -= (dx / d) * f; a.vy -= (dy / d) * f
        b.vx += (dx / d) * f; b.vy += (dy / d) * f
      }
      // 弹簧（连边）
      for (const e of edges) {
        const a = pos[e.source], b = pos[e.target]
        if (!a || !b) continue
        const dx = b.x - a.x, dy = b.y - a.y
        const d = Math.max(1, Math.hypot(dx, dy))
        const f = (d - 170) * 0.012
        a.vx += (dx / d) * f; a.vy += (dy / d) * f
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f
      }
      // 积分 + 阻尼 + 向心
      for (const k of ks) {
        const n = pos[k]
        n.vx += (W / 2 - n.x) * 0.003
        n.vy += (H / 2 - n.y) * 0.003
        n.vx *= 0.82; n.vy *= 0.82
        if (dragging.current.id !== k) { n.x += n.vx; n.y += n.vy }
        n.x = Math.max(30, Math.min(W - 30, n.x))
        n.y = Math.max(30, Math.min(H - 30, n.y))
      }
      setPositions(pos)
      if (tick < 600) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [edges])

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(0.4, Math.min(2.5, z * (e.deltaY > 0 ? 0.92 : 1.08))))
  }

  const nodeR = (n: GraphNode) => 14 + Math.min(22, n.degree * 5)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal graph-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">关系图谱 <span className="modal-sub">滚轮缩放 · 拖拽节点 · 单击跳转 · 灰色为未解析链接统计</span></div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="graph-svg"
          onWheel={onWheel}
          onMouseMove={e => {
            const d = dragging.current
            if (!d.id) return
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
            const x = ((e.clientX - rect.left) / rect.width) * W / zoom
            const y = ((e.clientY - rect.top) / rect.height) * H / zoom
            setPositions(s => ({ ...s, [d.id!]: { ...s[d.id!], x: x / 1, y: y / 1, vx: 0, vy: 0 } }))
          }}
          onMouseUp={() => { dragging.current.id = null }}
          onMouseLeave={() => { dragging.current.id = null }}
        >
          <g transform={`scale(${zoom})`}>
            {edges.map((e, i) => {
              const a = positions[e.source], b = positions[e.target]
              if (!a || !b) return null
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                className={`graph-edge${e.unresolved ? ' unresolved' : ''}`} />
            })}
            {nodes.map(n => {
              const pos = positions[n.id]
              if (!pos) return null
              return (
                <g key={n.id}
                  transform={`translate(${pos.x},${pos.y})`}
                  className={`graph-node ${n.active ? 'active' : n.neighbor ? 'neighbor' : n.isolated ? 'isolated' : ''}`}
                  onMouseDown={e => { dragging.current = { id: n.id, ox: e.clientX, oy: e.clientY } }}
                  onClick={() => { if (!n.isolated) onOpenNote(n.id) }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle r={nodeR(n)} />
                  <text y={nodeR(n) + 14} textAnchor="middle">{n.label}</text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>
    </div>
  )
}
