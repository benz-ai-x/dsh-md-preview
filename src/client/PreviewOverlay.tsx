/**
 * The right-docked preview panel, contributed into the additive
 * `shell.overlay` list. Rendering, geometry, and locale only: the preview
 * session — read lifecycle, edit face, guarded save, prompts — lives in the
 * PreviewSession machine behind usePanelDocumentSession. The panel renders
 * null while no preview target is set.
 */
import { useCallback, useRef, useState } from 'react'
import { MarkdownText, type MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { MdPreviewFile, MdPreviewListResult, MdPreviewWriteResult } from '../protocol.ts'
import type { MdPreviewState, MdPreviewTarget } from './preview-state.ts'
import { basename, isEditable } from './preview-state.ts'
import { MarkdownEditor } from './editor.tsx'
import { WorkspaceBrowser } from './WorkspaceBrowser.tsx'
import { usePanelDocumentSession } from './use-preview-session.ts'

/** Read/write/list RPCs and panel dismissal, created in the plugin's apply world. */
export interface PreviewOverlayInjected {
  hooks: {
    /** Current preview target; null while the panel is closed. */
    previewTarget: SnapshotStore<MdPreviewState>
  }
  /** Dismiss the panel and drop the target. */
  close(): void
  /** Set the preview target (the browser face's file-open handoff). */
  setTarget(target: MdPreviewTarget | null): void
  /** One bounded read; the transport carries the AbortSignal. */
  read(
    sessionId: SessionId,
    path: string,
    signal: AbortSignal,
  ): Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<MdPreviewFile>>
  /** One guarded write; `fingerprint` comes from the backing read. */
  write(
    sessionId: SessionId,
    path: string,
    content: string,
    fingerprint: string | undefined,
    force: boolean,
    signal: AbortSignal,
  ): Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<MdPreviewWriteResult>>
  /** One workspace directory listing; blank path lists the root. */
  list(
    sessionId: SessionId,
    path: string,
    signal: AbortSignal,
  ): Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<MdPreviewListResult>>
}

/** Full composed panel props. */
export type PreviewOverlayProps =
  & PropsRuntime<'shell.overlay'>
  & InjectFace<PreviewOverlayInjected>
  & PropsLocale<'md-preview'>

/** Docked width bounds in CSS pixels. */
const MIN_WIDTH = 320
const MAX_WIDTH = 1280
const DEFAULT_WIDTH = 500

function markdownLabels(t: PreviewOverlayProps['t']): MarkdownLabels {
  return {
    code: { copyLabel: t('copy'), copiedLabel: t('copied') },
    footnotes: t('footnotes'),
  }
}

/**
 * Render the preview panel for the current target.
 * @param props - target hook, read/write RPCs, dismissal, and the locale seat.
 * @returns the docked panel, or null while closed.
 */
export function PreviewOverlay({ usePreviewTarget, close, setTarget, read, write, list, t }: PreviewOverlayProps) {
  const target = usePreviewTarget(state => state)
  const session = usePanelDocumentSession({ read, write, close }, target)
  const { state, canSave, actions } = session
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  // The browser face: entered from the header, kept mounted once entered so
  // its expansion state survives face switches (UI-local viewing state).
  const [face, setFace] = useState<'document' | 'browse'>('document')
  const [browserEverOpened, setBrowserEverOpened] = useState(false)
  const labels = markdownLabels(t)

  const openFromBrowser = useCallback((path: string): void => {
    if (target === null) return
    setTarget({ sessionId: target.sessionId, path })
    setFace('document')
  }, [setTarget, target])

  // The panel stays mounted across targets and opens; the user's width
  // persists for the whole app session (min/max clamped in the handler).
  const onResize = useCallback((deltaX: number) => {
    setWidth(current => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, current - deltaX)))
  }, [])

  if (target === null) return null
  return (
    <div className="dsh-md-preview-dock">
      <div className="dsh-md-preview-panel" style={{ width: `${width}px` }}>
        <div className="dsh-md-preview-header">
          <span className="dsh-md-preview-icon" aria-hidden>📄</span>
          <div className="dsh-md-preview-title" title={target.path}>{basename(target.path)}</div>
          <span className="dsh-md-preview-version" aria-hidden>{process.env.MD_PREVIEW_VERSION}</span>
          {face === 'document' ? (
            <button
              type="button" className="dsh-md-preview-icon" aria-label={t('browse.open')}
              title={t('browse.open')} onClick={() => {
                setBrowserEverOpened(true)
                setFace('browse')
              }}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                <path d="M1.5 3.5h4l1.5 2h7.5v7h-13z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <button
              type="button" className="dsh-md-preview-icon" aria-label={t('browse.back')}
              title={t('browse.back')} onClick={() => { setFace('document') }}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                <path d="M9.5 3.5L5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {face === 'document' && state.face === 'view' && state.content.state === 'ready' && isEditable(target.path) && (
            <button
              type="button" className="dsh-md-preview-icon" aria-label={t('panel.edit')}
              title={t('panel.edit')} onClick={actions.enterEdit}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                <path d="M11.5 2.5l2 2L6 12l-3 1 1-3zM10 4l2 2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {face === 'document' && state.face === 'edit' && (
            <>
              <button
                type="button" className="dsh-md-preview-icon" aria-label={t('panel.save')}
                title={t('panel.save')} disabled={!canSave}
                onClick={() => { actions.save(false) }}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                  <path d="M2 2h9l3 3v9H2zM5 2v4h6V2M4 14V9h8v5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button" className="dsh-md-preview-icon" aria-label={t('panel.cancel')}
                title={t('panel.cancel')} onClick={actions.cancelEdit}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            </>
          )}
          <button
            type="button" className="dsh-md-preview-icon" aria-label={t('panel.close')}
            onClick={actions.requestClose}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="dsh-md-preview-body">
          {browserEverOpened && (
            <div className="dsh-md-preview-browser" hidden={face !== 'browse'}>
              {target !== null && (
                <WorkspaceBrowser
                  sessionId={target.sessionId}
                  list={list}
                  onOpenFile={openFromBrowser}
                  currentPath={target.path}
                  t={t}
                />
              )}
            </div>
          )}
          <div className="dsh-md-preview-document" hidden={face !== 'document'}>
          {state.toast && state.face === 'view' && (
            <div className="dsh-md-preview-toast" role="status">✓ {t('panel.saved')}</div>
          )}
          {state.unsavedPrompt && (
            <div className="dsh-md-preview-bar" role="alert">
              <span>{t('panel.unsaved.title')}</span>
              <button type="button" onClick={actions.discard}>{t('panel.unsaved.discard')}</button>
              <button type="button" onClick={actions.keepEditing}>{t('panel.unsaved.keep')}</button>
            </div>
          )}
          {state.saveError !== null && state.face === 'edit' && (
            <div className="dsh-md-preview-bar" role="alert">
              <span>
                {t('panel.saveError')} · {state.saveError.code}
                {state.saveError.message.length > 0 ? ` — ${state.saveError.message}` : ''}
              </span>
              <button type="button" disabled={state.saving} onClick={() => { actions.save(false) }}>
                {t('panel.save.retry')}
              </button>
            </div>
          )}
          {state.conflicted && state.face === 'edit' && (
            <div className="dsh-md-preview-bar" role="alert">
              <span>{t('panel.conflict.title')}</span>
              <button type="button" onClick={actions.reload}>
                {t('panel.conflict.reload')}
              </button>
              <button type="button" disabled={state.saving} onClick={() => { actions.save(true) }}>{t('panel.conflict.force')}</button>
            </div>
          )}
          {state.face === 'edit' ? (
            <MarkdownEditor
              initialValue={state.content.state === 'ready' ? state.content.file.content : ''}
              onChange={actions.edit}
              onSave={() => { actions.save(false) }}
            />
          ) : (
            <>
              {state.content.state === 'loading' && <div className="dsh-md-preview-state">{t('panel.loading')}</div>}
              {state.content.state === 'failed' && (
                <div className="dsh-md-preview-state">
                  <div className="dsh-md-preview-error">{t('panel.error')} · {state.content.code}</div>
                  <div>{state.content.message}</div>
                  <button
                    type="button" className="dsh-md-preview-retry"
                    onClick={actions.retryRead}
                  >
                    {t('panel.retry')}
                  </button>
                </div>
              )}
              {state.content.state === 'ready' && (
                isEditable(target.path)
                  ? <MarkdownText text={state.content.file.content} labels={labels} />
                  : <pre className="dsh-md-preview-plaintext">{state.content.file.content}</pre>
              )}
            </>
          )}
          </div>
        </div>
        <ResizeHandle onResize={onResize} />
      </div>
    </div>
  )
}

/** Left-edge drag handle; pointer capture (best effort) with rAF-throttled dx reports. */
function ResizeHandle(props: { onResize: (deltaX: number) => void }) {
  const [dragging, setDragging] = useState(false)
  const active = useRef(false)
  const origin = useRef(0)
  const latest = useRef(0)
  const frame = useRef<number | null>(null)
  const callback = useRef(props.onResize)
  callback.current = props.onResize

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    // Capture keeps off-element moves flowing with a real pointer; a failed
    // capture (synthetic events, detached node) must not break the drag.
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* drag still works over the strip */ }
    active.current = true
    origin.current = e.clientX
    latest.current = e.clientX
    setDragging(true)
  }, [])
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!active.current) return
    latest.current = e.clientX
    frame.current ??= requestAnimationFrame(() => {
      frame.current = null
      callback.current(latest.current - origin.current)
      origin.current = latest.current
    })
  }, [])
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!active.current) return
    // Best effort, like the capture in pointerDown: a partial pointer API
    // (synthetic events, jsdom) must not break the drag's completion.
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    } catch { /* release is advisory; the gesture is over either way */ }
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null }
    active.current = false
    setDragging(false)
  }, [])

  return (
    <div
      aria-hidden
      className="dsh-md-preview-handle"
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  )
}
