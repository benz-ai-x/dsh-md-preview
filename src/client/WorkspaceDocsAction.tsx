/**
 * The header browse action: a file-tree button in the conversation header
 * that opens the right preview panel on its browse face — the workspace
 * tree shows first, and opening a file reads it in the document face.
 */

import type { ReactElement } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** The composed props of the header action: slot kit + inject face + locale. */
export type WorkspaceDocsActionProps =
  PropsRuntime<'conversation.session.header.actions'>
  & InjectFace<{
    setTarget(target: { sessionId: SessionId; path: string; face: 'browse' }): void
  }>
  & PropsLocale<'md-preview'>

/**
 * Render the header browse button for one session.
 * @param props - the composed action props.
 * @returns the header button.
 */
export function WorkspaceDocsAction(props: WorkspaceDocsActionProps): ReactElement {
  const { sessionId, setTarget, t } = props
  return (
    <button
      type="button" className="dsh-md-preview-icon"
      aria-label={t('dock.browse')} title={t('dock.browse')}
      onClick={() => { setTarget({ sessionId, path: '', face: 'browse' }) }}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
        <path d="M1.5 3.5h4l1.5 2h7.5v7h-13z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
