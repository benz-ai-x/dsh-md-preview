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
  'panel.edit': '编辑',
  'panel.save': '保存',
  'panel.cancel': '取消编辑',
  'panel.saved': '已保存',
  'panel.saveError': '保存失败',
  'panel.save.retry': '重试',
  'panel.conflict.title': '文件已在别处被修改',
  'panel.conflict.reload': '重新加载',
  'panel.conflict.force': '强制覆盖',
  'panel.unsaved.title': '有未保存的修改',
  'panel.unsaved.discard': '放弃修改',
  'panel.unsaved.keep': '继续编辑',
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
  'panel.edit': 'Edit',
  'panel.save': 'Save',
  'panel.cancel': 'Cancel editing',
  'panel.saved': 'Saved',
  'panel.saveError': 'Save failed',
  'panel.save.retry': 'Retry',
  'panel.conflict.title': 'The file changed elsewhere',
  'panel.conflict.reload': 'Reload',
  'panel.conflict.force': 'Overwrite',
  'panel.unsaved.title': 'You have unsaved changes',
  'panel.unsaved.discard': 'Discard changes',
  'panel.unsaved.keep': 'Keep editing',
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
