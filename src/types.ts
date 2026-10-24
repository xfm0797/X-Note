// ===== X-Note 全局类型定义 =====

/** 笔记文件（路径 -> 内容） */
export interface NoteMeta {
  content: string
  updated: number
}

/** 文件树节点 */
export interface TreeItem {
  type: 'dir' | 'file'
  name: string
  path: string
  children?: TreeItem[]
}

export type ViewMode = 'edit' | 'split' | 'preview'
export type ThemeMode = 'light' | 'dark' | 'system'

export interface Settings {
  theme: ThemeMode
  fontSize: number
  fontFamily: string
  exportFormat: 'md' | 'html' | 'pdf'
  sidebarVisible: boolean
  sidebarWidth: number
  view: ViewMode
}

export interface Heading { level: number; text: string; id: string; line: number }

export interface Backlink { source: string; sourceTitle: string; snippets: string[] }

export interface HistorySnapshot { ts: number; content: string }

export type DiffRowType = 'same' | 'add' | 'del'
export interface DiffRow { type: DiffRowType; text: string }

export interface ToastMsg { id: number; text: string; kind: 'success' | 'error' | 'info' }
