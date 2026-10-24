// ===== SyncProvider 接口（含 afterSync 收尾钩子） =====
import type { SyncFileInfo } from '../sync'

export interface SyncProvider {
  readonly id: string
  readonly label: string
  test(): Promise<{ ok: boolean; message: string }>
  list(): Promise<Record<string, SyncFileInfo>>
  pull(path: string): Promise<string>
  push(path: string, content: string): Promise<void>
  remove(path: string): Promise<void>
  afterSync?(): Promise<void>
}
