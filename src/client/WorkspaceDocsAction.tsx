/**
 * The workspace-docs browse capsule: a Session Header utility sitting next to
 * the shipped Session-log download capsule. It opens the right overlay layer
 * on the panel's browse face — the workspace tree shows first, and opening a
 * file reads it in the document face.
 */

import type { ReactElement } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** The composed props of the header utility: slot kit + inject face + locale. */
export type WorkspaceDocsActionProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & InjectFace<{
    setTarget(target: { sessionId: SessionId; path: string; face: 'browse' }): void
  }>
  & PropsLocale<'md-preview'>

/**
 * Render the browse capsule for the showing Session.
 * @param props - the composed action props.
 * @returns the header utility button.
 */
export function WorkspaceDocsAction(props: WorkspaceDocsActionProps): ReactElement {
  const { sessionId, setTarget, t } = props
  // The capsule opens the overlay on the tree for the Session the header
  // shows; the layer appears on target set, no host column involved.
  const open = (): void => {
    setTarget({ sessionId, path: '', face: 'browse' })
  }
  return (
    <button
      type="button" className="dsh-md-preview-docsbtn"
      aria-label={t('dock.browse')} title={t('dock.browse')}
      onClick={open}
    >
      <span>{t('dock.browse')}</span>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
        <path d="M1.5 3.5h4l1.5 2h7.5v7h-13z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
