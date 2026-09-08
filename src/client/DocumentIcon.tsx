import { IconFolderClose16, IconFolderOpen16 } from '@deepseek-ai/dsh-client-ui-primitives'

/** One 16px icon family for document identity, tree rows and quick entries. */
export function DocumentIcon({ kind = 'markdown', expanded = false, className }: {
  kind?: 'directory' | 'markdown' | 'image' | 'text' | 'file'
  expanded?: boolean
  className?: string
}) {
  if (kind === 'directory') return expanded
    ? <IconFolderOpen16 className={className} />
    : <IconFolderClose16 className={className} />
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className={className}>
      <path d="M3.5 1.5h5L12.5 5v9.5h-9zM8.5 1.5V5h4" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      {kind === 'markdown'
        ? <path d="M5.5 11V8.2l1.6 1.6 1.6-1.6V11" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
        : kind === 'image'
          ? <path d="M5.5 11l1.6-2 1.4 1 1.5-2 1 3z" fill="none" stroke="currentColor" strokeLinejoin="round" />
          : <path d="M5.5 8h5M5.5 10.5h4" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />}
    </svg>
  )
}
