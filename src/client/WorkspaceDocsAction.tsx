/**
 * The workspace-docs browse capsule: a Session Header utility sitting next to
 * the shipped Session-log download capsule. One entry with one meaning
 * (#21): closed enters workspace browsing (the tree face), open requests the
 * collapse — both through the common leave-intent entry, so a dirty draft is
 * asked about before the panel folds. The capsule also measures the session
 * header strip it lives in (#22): its published bottom is where the preview
 * panel starts, keeping this very entry visible and clickable whenever the
 * panel is open — measured geometry, never a preset offset.
 */

import { useLayoutEffect, useRef, type ReactElement } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { MdPreviewState } from './preview-state.ts'
import type { LeaveIntentSeat } from './leave-intent.ts'

/** The composed props of the header utility: slot kit + inject face + locale. */
export type WorkspaceDocsActionProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & InjectFace<{
    hooks: { previewTarget: SnapshotStore<MdPreviewState> }
    leave: LeaveIntentSeat
    headerStrip: SnapshotStore<number>
  }>
  & PropsLocale<'md-preview'>

/**
 * Render the browse capsule toggle for the showing Session.
 * @param props - the composed action props.
 * @returns the header utility button.
 */
export function WorkspaceDocsAction({ sessionId, usePreviewTarget, leave, headerStrip, t }: WorkspaceDocsActionProps): ReactElement {
  const open = usePreviewTarget(state => state !== null)
  // Measure the strip this capsule sits in: its own ancestor <header> — a
  // structural fact of the public slot's placement, not a host styling
  // guess. A hidden header (blank session) reports a zero rect → no strip.
  const buttonRef = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    const button = buttonRef.current
    if (button === null) return
    const header = button.closest('header')
    if (header === null) return
    const publish = (): void => {
      const bottom = Math.round(header.getBoundingClientRect().bottom)
      if (bottom > 0 && headerStrip.getSnapshot() !== bottom) headerStrip.set(bottom)
      else if (bottom <= 0 && headerStrip.getSnapshot() !== 0) headerStrip.set(0)
    }
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(header)
    return () => { observer.disconnect() }
  }, [headerStrip])
  // A true switch, pressed state included: open parks the tree on the
  // overlay; already open dismisses it. The carrier is the Session the
  // header shows.
  const toggle = (): void => {
    if (open) leave.request({ kind: 'close' })
    else leave.request({ kind: 'open', target: { sessionId, path: '', face: 'browse' } })
  }
  return (
    <button
      ref={buttonRef}
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
