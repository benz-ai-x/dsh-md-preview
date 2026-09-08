/**
 * The document-sidebar toggle: a Session Header utility sitting next to
 * the shipped Session-log download capsule. One entry with one meaning
 * (#21): closed enters workspace browsing (the tree face), open requests the
 * collapse — both through the common leave-intent entry, so a dirty draft is
 * asked about before the panel folds. The panel owns docking and carries
 * an X close control while the paperclip header entry stays mounted.
 */

import { useEffect, type ReactElement } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { MdPreviewState } from './preview-state.ts'
import type { LeaveIntentSeat } from './leave-intent.ts'
import { latestTurnPreviewable, type TurnOutputsSnapshot } from './turn-files.ts'
import { PanelToggle } from './PanelToggle.tsx'

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
 * Render the document sidebar toggle for the showing Session.
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
  // A disclosure with an expanded state: open parks the tree in the
  // panel; already open dismisses it. The carrier is the Session the
  // header shows.
  const toggle = (): void => {
    if (open) leave.request({ kind: 'close' })
    else leave.request({ kind: 'open', target: { sessionId, path: '', face: 'browse' } })
  }
  return (
    <PanelToggle
      entry
      open={open}
      label={open ? t('panel.close') : t('dock.expand')}
      onClick={toggle}
    />
  )
}
