/**
 * The workspace-docs browse capsule: a Session Header utility sitting next to
 * the shipped Session-log download capsule. It toggles the right overlay
 * layer — closed parks it on the tree face (the workspace tree shows first,
 * and opening a file reads it in the document face), open dismisses it.
 */

import type { ReactElement } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { MdPreviewState } from './preview-state.ts'

/** The composed props of the header utility: slot kit + inject face + locale. */
export type WorkspaceDocsActionProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & InjectFace<{
    hooks: { previewTarget: SnapshotStore<MdPreviewState> }
    setTarget(target: { sessionId: SessionId; path: string; face: 'browse' } | null): void
  }>
  & PropsLocale<'md-preview'>

/**
 * Render the browse capsule toggle for the showing Session.
 * @param props - the composed action props.
 * @returns the header utility button.
 */
export function WorkspaceDocsAction({ sessionId, usePreviewTarget, setTarget, t }: WorkspaceDocsActionProps): ReactElement {
  const open = usePreviewTarget(state => state !== null)
  // A true switch, pressed state included: open parks the tree on the
  // overlay; already open dismisses it. The carrier is the Session the
  // header shows.
  const toggle = (): void => {
    if (open) setTarget(null)
    else setTarget({ sessionId, path: '', face: 'browse' })
  }
  return (
    <button
      type="button" className="dsh-md-preview-docsbtn"
      aria-label={t('dock.browse')} title={t('dock.browse')}
      aria-pressed={open}
      onClick={toggle}
    >
      <span>{t('dock.browse')}</span>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
        <path d="M1.5 3.5h4l1.5 2h7.5v7h-13z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
