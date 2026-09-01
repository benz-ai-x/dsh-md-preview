/**
 * The per-message preview action, contributed into the additive
 * `conversation.chat.assistant-actions` list. Shows nothing for messages
 * whose turn produced no markdown; one document opens it directly, several
 * open a small picker list.
 */
import { useMemo, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { ownedDeliverables, previewableOf } from './message-files.ts'
import { basename } from './preview-state.ts'

/** Panel admission for one conversation session. */
export interface PreviewActionInjected {
  /** Open the preview panel for a markdown document of this session. */
  openPreview(path: string): void
}

/** Full composed action props: the owner message id plus the locale seat. */
export type PreviewActionProps =
  & PropsRuntime<'conversation.chat.assistant-actions'>
  & PropsLocale<'md-preview'>
  & InjectFace<PreviewActionInjected>

/**
 * Render the preview-documents action for one finalized assistant message.
 * @param props - the durable message id, preview admission, and locale seat.
 * @returns the action button with its picker, or null without markdown.
 */
export function PreviewAction({ messageId, useChat, openPreview, t }: PreviewActionProps) {
  // The selector rides the snapshot's structural sharing: identity changes
  // only when the owning turn's deliverables data actually changes.
  const owned = useChat(snapshot => ownedDeliverables(snapshot, messageId))
  const files = useMemo(() => owned === undefined ? [] : previewableOf(owned), [owned])
  const [open, setOpen] = useState(false)
  if (files.length === 0) return null
  const first = files[0] as string
  return (
    <span className="dsh-md-preview-anchor">
      <button
        type="button" className="dsh-md-preview-doc"
        title={t('action.label')}
        onClick={() => {
          if (files.length === 1) openPreview(first)
          else setOpen(value => !value)
        }}
      >
        <span aria-hidden>📄</span>
        {t('action.label')}
      </button>
      {open && files.length > 1 && (
        <span className="dsh-md-preview-list" role="menu">
          {files.map((path) => (
            <button
              key={path} type="button" role="menuitem"
              title={t('action.open', { name: path })}
              onClick={() => {
                setOpen(false)
                openPreview(path)
              }}
            >
              {basename(path)}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
