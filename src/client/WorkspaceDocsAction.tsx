/**
 * The workspace-docs browse capsule: a Session Header utility sitting next to
 * the shipped Session-log download capsule. One entry with one meaning
 * (#21): closed enters workspace browsing (the tree face), open requests the
 * collapse — both through the common leave-intent entry, so a dirty draft is
 * asked about before the panel folds. The panel owns top docking and its
 * own workspace/close entries while the host header is covered.
 */

import { useEffect, type ReactElement } from 'react'
import { IconFolderClose16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { MdPreviewState } from './preview-state.ts'
import type { LeaveIntentSeat } from './leave-intent.ts'
import { latestTurnPreviewable, type TurnOutputsSnapshot } from './turn-files.ts'

/** The composed props of the header utility: slot kit + inject face + locale. */
export type WorkspaceDocsActionProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & InjectFace<{
    hooks: { previewTarget: SnapshotStore<MdPreviewState> }
    leave: LeaveIntentSeat
    /** Publish the session's current-turn outputs into the shared seat (#31). */
    publishTurnOutputs?(sessionId: SessionId, paths: readonly string[]): void
  }>
  & PropsLocale<'md-preview'>
  & {
    /** The session binding's chat selector hook (ui-chat's standard source);
     * absent when that plugin is not composed — nothing publishes then. */
    useChat?: <T>(selector: (snapshot: TurnOutputsSnapshot) => T) => T
  }

/**
 * Render the browse capsule toggle for the showing Session.
 * @param props - the composed action props.
 * @returns the header utility button.
 */
export function WorkspaceDocsAction({ sessionId, usePreviewTarget, leave, publishTurnOutputs, useChat, t }: WorkspaceDocsActionProps): ReactElement {
  const open = usePreviewTarget(state => state !== null)
  // The current-turn outputs (#31): this capsule is the plugin's
  // always-mounted session-scoped seat, so it derives the newest turn's
  // previewable produced documents from the binding's chat facts and
  // publishes the view for the root-scoped panel. Pure derivation over the
  // owning service's data — turn and closing-seq boundaries included.
  const turnOutputs = useChat?.(latestTurnPreviewable) ?? null
  useEffect(() => {
    publishTurnOutputs?.(sessionId, turnOutputs ?? [])
  }, [sessionId, turnOutputs, publishTurnOutputs])
  // A true switch, pressed state included: open parks the tree on the
  // overlay; already open dismisses it. The carrier is the Session the
  // header shows.
  const toggle = (): void => {
    if (open) leave.request({ kind: 'close' })
    else leave.request({ kind: 'open', target: { sessionId, path: '', face: 'browse' } })
  }
  return (
    <button
      type="button" className="dsh-md-preview-docsbtn"
      aria-label={t('dock.browse')} title={t('dock.browse')}
      aria-pressed={open}
      onClick={toggle}
    >
      <span>{t('dock.browse')}</span>
      <IconFolderClose16 />
    </button>
  )
}
