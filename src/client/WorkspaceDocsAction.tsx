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
  PropsRuntime<'shell.overlay'>
  & InjectFace<{
    setTarget(target: { sessionId: SessionId; path: string; face: 'browse' }): void
    /** The host layout's details control (opens the column we render into). */
    layout?: { openDetails(): void } | undefined
  }>
  & PropsLocale<'md-preview'>

/**
 * Render the header browse button for one session.
 * @param props - the composed action props.
 * @returns the header button.
 */
export function WorkspaceDocsAction(props: WorkspaceDocsActionProps): ReactElement {
  const { setTarget, layout, t } = props
  // The root entry opens the tree on the details column; the host column
  // expands through its own control. A blank sessionId means "no conversation
  // yet" — the tree still needs a workspace, so we defer to the first one.
  const open = (): void => {
    layout?.openDetails()
    setTarget({ sessionId: '' as SessionId, path: '', face: 'browse' })
  }
  return (
    <button
      type="button" className="dsh-md-preview-icon dsh-md-preview-rootdocs"
      aria-label={t('dock.browse')} title={t('dock.browse')}
      onClick={open}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
        <path d="M1.5 3.5h4l1.5 2h7.5v7h-13z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
