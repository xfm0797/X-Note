// ===== 自动更新（Tauri updater 插件封装，浏览器模式不可用） =====
import { isTauri } from './storage'

export interface UpdateInfo {
  version: string
  currentVersion: string
  notes?: string
  date?: string
}

export type UpdateState =
  | { kind: 'idle' }
  | { kind: 'unavailable' }            // 浏览器模式
  | { kind: 'checking' }
  | { kind: 'up-to-date'; currentVersion: string }
  | { kind: 'available'; info: UpdateInfo }
  | { kind: 'downloading'; progress: string }
  | { kind: 'ready'; version: string }  // 已安装，待重启
  | { kind: 'error'; message: string }

export async function getCurrentVersion(): Promise<string> {
  if (isTauri()) {
    try {
      const { getVersion } = await import('@tauri-apps/api/app')
      return await getVersion()
    } catch { return '?' }
  }
  const { default: pkg } = await import('../../package.json')
  return pkg.version
}

/** 检查更新。返回最新版本信息；无更新返回 null */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) return null
  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check()
  if (!update) return null
  return {
    version: update.version,
    currentVersion: await getCurrentVersion(),
    notes: update.body || undefined,
    date: update.date || undefined
  }
}

/** 下载并安装更新（完成后由调用方决定是否重启） */
export async function downloadAndInstall(onProgress?: (pct: string) => void): Promise<void> {
  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check()
  if (!update) throw new Error('没有可用更新')
  let total = 0, received = 0
  await update.downloadAndInstall(event => {
    if (event.event === 'Started') { total = event.data.contentLength ?? 0 }
    else if (event.event === 'Progress') {
      received += event.data.chunkLength
      const pct = total ? `${Math.min(100, Math.round((received / total) * 100))}%` : `${(received / 1048576).toFixed(1)} MB`
      onProgress?.(pct)
    }
    else if (event.event === 'Finished') { onProgress?.('100%') }
  })
}

/** 重启应用以完成更新（仅桌面端） */
export async function relaunchApp(): Promise<void> {
  if (!isTauri()) return
  const { relaunch } = await import('@tauri-apps/plugin-process')
  await relaunch()
}
