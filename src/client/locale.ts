/** `md-preview` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'md-preview'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'panel.title': 'Markdown 预览',
  'panel.close': '关闭预览',
  'panel.loading': '正在加载…',
  'panel.empty': '没有可预览的文档',
  'panel.error': '加载失败',
  'panel.retry': '重试',
  'chip.preview': '预览 {name}',
  'chip.open': '打开 {name}',
  'action.label': '预览文档',
  'action.open': '预览 {name}',
  'copy': '复制',
  'copied': '已复制',
  'footnotes': '脚注',
}

/** English dictionary (same key set). */
export const en: Record<MdPreviewKey, string> = {
  'panel.title': 'Markdown preview',
  'panel.close': 'Close preview',
  'panel.loading': 'Loading…',
  'panel.empty': 'No document to preview',
  'panel.error': 'Failed to load',
  'panel.retry': 'Retry',
  'chip.preview': 'Preview {name}',
  'chip.open': 'Open {name}',
  'action.label': 'Preview documents',
  'action.open': 'Preview {name}',
  'copy': 'Copy',
  'copied': 'Copied',
  'footnotes': 'Footnotes',
}

/** Union of this namespace's dictionary keys. */
export type MdPreviewKey = keyof typeof zh
