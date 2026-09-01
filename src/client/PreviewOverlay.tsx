/**
 * The right-docked preview panel, contributed into the additive
 * `shell.overlay` list. Renders nothing while no preview target is set; when
 * one is, reads the document through the mounted MdPreview Remote and renders
 * it with the platform Markdown primitive. Target changes abort the previous
 * read; closing the panel aborts the in-flight one.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MarkdownText, type MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { MdPreviewFile } from '../protocol.ts'
import type { MdPreviewState } from './preview-state.ts'
import { basename } from './preview-state.ts'

/** Read RPC and panel dismissal, created in the plugin's apply world. */
export interface PreviewOverlayInjected {
  hooks: {
    /** Current preview target; null while the panel is closed. */
    previewTarget: SnapshotStore<MdPreviewState>
  }
  /** Dismiss the panel and drop the target. */
  close(): void
  /** One bounded read; the transport carries the AbortSignal. */
  read(
    sessionId: SessionId,
    path: string,
    signal: AbortSignal,
  ): Promise<RemoteResult<MdPreviewFile>>
}

/** Content lifecycle of one preview target. */
type PreviewContent =
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly file: MdPreviewFile }
  | { readonly state: 'failed'; readonly code: string; readonly message: string }

/** Full composed panel props. */
export type PreviewOverlayProps =
  & PropsRuntime<'shell.overlay'>
  & InjectFace<PreviewOverlayInjected>
  & PropsLocale<'md-preview'>

/** Docked width bounds in CSS pixels. */
const MIN_WIDTH = 320
const MAX_WIDTH = 960
const DEFAULT_WIDTH = 440

function markdownLabels(t: PreviewOverlayProps['t']): MarkdownLabels {
  return {
    code: { copyLabel: t('copy'), copiedLabel: t('copied') },
    footnotes: t('footnotes'),
  }
}

/**
 * Render the preview panel for the current target.
 * @param props - target hook, read RPC, dismissal, and the locale seat.
 * @returns the docked panel, or null while closed.
 */
export function PreviewOverlay({ usePreviewTarget, close, read, t }: PreviewOverlayProps) {
  const target = usePreviewTarget(state => state)
  const [content, setContent] = useState<PreviewContent>({ state: 'loading' })
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  // Manual retry bumps this; the read effect re-runs for the same target with
  // fresh cancellation instead of an ad-hoc untracked request.
  const [revision, setRevision] = useState(0)
  const labels = useMemo(() => markdownLabels(t), [t])

  // One read per target identity (plus retry revision); the previous read is
  // aborted by the effect cleanup when the identity changes or the panel unmounts.
  useEffect(() => {
    if (target === null) return
    setContent({ state: 'loading' })
    const controller = new AbortController()
    void read(target.sessionId, target.path, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      setContent(result.ok
        ? { state: 'ready', file: result.value }
        : { state: 'failed', code: result.error.code, message: result.error.message })
    })
    return () => { controller.abort() }
  }, [read, target, revision])

  // The panel stays mounted across targets and opens; the user's width
  // persists for the whole app session (min/max clamped in the handler).
  const wasOpen = useRef(false)
  useEffect(() => {
    if (target === null) wasOpen.current = false
    else if (!wasOpen.current) {
      wasOpen.current = true
    }
  }, [target])

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
          <button
            type="button" className="dsh-md-preview-icon" aria-label={t('panel.close')}
            onClick={() => { close() }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="dsh-md-preview-body">
          {content.state === 'loading' && <div className="dsh-md-preview-state">{t('panel.loading')}</div>}
          {content.state === 'failed' && (
            <div className="dsh-md-preview-state">
              <div className="dsh-md-preview-error">{t('panel.error')} · {content.code}</div>
              <div>{content.message}</div>
              <button
                type="button" className="dsh-md-preview-retry"
                onClick={() => { setRevision(value => value + 1) }}
              >
                {t('panel.retry')}
              </button>
            </div>
          )}
          {content.state === 'ready' && (
            <MarkdownText text={content.file.content} labels={labels} />
          )}
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
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
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
