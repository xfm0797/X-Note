// ===== 关于对话框（软件信息与开发者信息） =====
import React, { useEffect, useState } from 'react'
import pkg from '../../package.json'

/** 桌面端读 tauri.conf.json 版本，浏览器端回退到 package.json 版本 */
function useAppVersion(): string {
  const [ver, setVer] = useState<string>(pkg.version)
  useEffect(() => {
    ;(async () => {
      try {
        const { isTauri } = await import('../lib/storage')
        if (isTauri()) {
          const { getVersion } = await import('@tauri-apps/api/app')
          setVer(await getVersion())
        }
      } catch { /* 保持 package.json 版本 */ }
    })()
  }, [])
  return ver
}

export function AboutModal({ onClose }: { onClose(): void }) {
  const ver = useAppVersion()
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal about-modal" onClick={e => e.stopPropagation()}>
        <div className="about-logo">📝</div>
        <div className="about-name">X-Note 笔记</div>
        <div className="about-ver">版本 {ver} · 本地优先 · Tauri 2 + React 18</div>
        <div className="about-desc">
          笔记即标准 .md 文件，离线可用、隐私无忧。<br />
          支持实时预览、双向链接、关系图谱、版本历史与云同步插件。
        </div>
        <div className="about-author">
          开发者：<a href="https://www.lovou.pw" target="_blank" rel="noopener noreferrer">XFM</a>
          {' · '}
          <a href="https://github.com/xfm0797" target="_blank" rel="noopener noreferrer">GitHub @xfm0797</a>
        </div>
        <button className="btn primary" onClick={onClose}>确定</button>
      </div>
    </div>
  )
}
