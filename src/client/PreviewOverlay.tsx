/**
 * The right-docked preview panel, contributed into the additive
 * `shell.overlay` list as a layer stacked over the frame. Rendering,
 * geometry, and locale only: the preview session — read lifecycle, edit
 * face, guarded save, prompts — lives in the PreviewSession machine behind
 * usePanelDocumentSession, and every leave (close, face switch, opening
 * another document) arrives through the leave-intent seat, which this panel
 * guards and executes. The panel renders null while no preview target
 * is set.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { MarkdownText, type MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { EditorView } from '@codemirror/view'
import { openSearchPanel } from '@codemirror/search'
import { redo, undo } from '@codemirror/commands'
import type { MdPreviewFile, MdPreviewListResult, MdPreviewWriteResult } from '../protocol.ts'
import type { MdPreviewState, MdPreviewTarget } from './preview-state.ts'
import { isEditable } from './preview-state.ts'
import { isDirty } from './preview-session.ts'
import type { LeaveIntentSeat } from './leave-intent.ts'
import { activeIndexForLine, activeIndexForScroll, extractOutline, findHeadingElement } from './outline.ts'
import { enhanceDiagrams, fenceLanguages, findDiagramBlocks } from './diagrams.ts'
import { MarkdownEditor, type EditorStatus, type SearchStatus } from './editor.tsx'
import { WorkspaceBrowser } from './WorkspaceBrowser.tsx'
import { usePanelDocumentSession } from './use-preview-session.ts'

/** Read/write/list RPCs and panel dismissal, created in the plugin's apply world. */
export interface PreviewOverlayInjected {
  hooks: {
    /** Current preview target; null while the panel is closed. */
    previewTarget: SnapshotStore<MdPreviewState>
  }
  /** The common leave-intent entry every plugin outlet shares (#21). */
  leave: LeaveIntentSeat
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

/** Panel width from which the rail shows beside the document (#11). */
const RAIL_MIN_WIDTH = 640

/** The overlay's own width bounds: default 720 (rail docks immediately),
 * draggable 360–1200. */
const OVERLAY_MIN_WIDTH = 360
const OVERLAY_MAX_WIDTH = 1200
const OVERLAY_DEFAULT_WIDTH = 720

/**
 * The opening width: the 720 preset, or half the viewport when that is
 * narrower — a small window still gets a sane, draggable column.
 */
function initialOverlayWidth(): number {
  const half = typeof window === 'undefined' ? OVERLAY_DEFAULT_WIDTH : window.innerWidth * 0.5
  return Math.min(OVERLAY_DEFAULT_WIDTH, Math.max(OVERLAY_MIN_WIDTH, Math.round(half)))
}

/**
 * Shared pointer-drag width driver: pointer capture with rAF-coalesced deltas.
 * `sign` maps the drag direction to growth — the rail widens with the pointer
 * (+1); the right-anchored overlay widens against it (−1).
 */
function useDragWidth(
  min: number,
  max: number,
  sign: 1 | -1,
  set: React.Dispatch<React.SetStateAction<number>>,
): (e: React.PointerEvent<HTMLDivElement>) => void {
  const drag = useRef<{ active: boolean; origin: number; latest: number; frame: number | null }>({
    active: false, origin: 0, latest: 0, frame: null,
  })
  return useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (e.type === 'pointerdown') {
      e.preventDefault()
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* drag over the strip */ }
      current.active = true
      current.origin = e.clientX
      current.latest = e.clientX
      return
    }
    if (!current.active) return
    if (e.type === 'pointermove') {
      current.latest = e.clientX
      current.frame ??= requestAnimationFrame(() => {
        current.frame = null
        const next = current.latest - current.origin
        current.origin = current.latest
        set(width => Math.min(max, Math.max(min, width + sign * next)))
      })
      return
    }
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    } catch { /* release is advisory */ }
    if (current.frame !== null) { cancelAnimationFrame(current.frame); current.frame = null }
    current.active = false
  }, [min, max, sign, set])
}

function markdownLabels(t: PreviewOverlayProps['t']): MarkdownLabels {
  return {
    code: { copyLabel: t('copy'), copiedLabel: t('copied') },
    footnotes: t('footnotes'),
  }
}

/**
 * Render the preview panel for the current target.
 * @param props - target hook, leave seat, read/write RPCs, dismissal, and the locale seat.
 * @returns the docked panel, or null while closed.
 */
export function PreviewOverlay({ usePreviewTarget, leave, close, setTarget, read, write, list, t }: PreviewOverlayProps) {
  const target = usePreviewTarget(state => state)
  const session = usePanelDocumentSession({ read, write, close }, target)
  const { state, canSave, actions } = session
  // The pending leave intent: the panel is the guard's only owner — external
  // entries (chips, the preview action, the docs capsule, tree rows) request
  // into the seat, and this single consumer executes or holds them (#21).
  const pendingLeave = useSyncExternalStore(leave.subscribe, leave.getSnapshot)
  // The overlay owns its width: a right-anchored layer stacked over the
  // frame, dragged wider/narrower from its left edge; it persists across
  // targets and closes for the whole app session (min/max clamped in the drag).
  const [width, setWidth] = useState(initialOverlayWidth)
  // Maximize (the B ask): a full-frame preset over the remembered width —
  // restore returns to it exactly; the edge handle hides while taken.
  const [maximized, setMaximized] = useState(false)
  // The browser face: entered from the header, kept mounted once entered so
  // its expansion state survives face switches (UI-local viewing state).
  const [face, setFace] = useState<'document' | 'browse'>('document')
  const [browserEverOpened, setBrowserEverOpened] = useState(false)
  // A target that asks for the browse face opens on the tree (the header
  // file action); anything else opens on the document as before.
  useEffect(() => {
    if (target?.face === 'browse') {
      setBrowserEverOpened(true)
      setFace('browse')
    }
  }, [target])
  // The rail (#11): shown from RAIL_MIN_WIDTH unless manually collapsed;
  // below the threshold the browse-face swap remains the fallback. Both are
  // component-local geometry state, like the dragged width.
  const [railCollapsed, setRailCollapsed] = useState(false)
  const widePanel = maximized || width >= RAIL_MIN_WIDTH
  const railVisible = widePanel && !railCollapsed
  // Which rail mini-tab is showing (#12); remembered across collapses.
  const [railTab, setRailTab] = useState<'files' | 'outline'>('files')
  // The rail's dragged width (user feedback): persists like the panel width.
  const [railWidth, setRailWidth] = useState(148)
  const onRailResize = useDragWidth(120, 320, 1, setRailWidth)
  const onEdgeResize = useDragWidth(OVERLAY_MIN_WIDTH, OVERLAY_MAX_WIDTH, -1, setWidth)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [activeOutline, setActiveOutline] = useState(-1)
  const documentRef = useRef<HTMLDivElement>(null)
  const outlineRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const labels = markdownLabels(t)
  const [searchStatus, setSearchStatus] = useState<SearchStatus | null>(null)
  const [editorStatus, setEditorStatus] = useState<EditorStatus | null>(null)
  // The resident saved-at stamp (#15): set when the save toast fires, kept
  // after it fades; a new target resets it until the next save.
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  useEffect(() => { if (state.toast && state.face === 'view') setSavedAt(new Date()) }, [state.toast, state.face])
  useEffect(() => { setSavedAt(null) }, [target])
  // The dirty-draft guard is the pending leave intent itself (#21): a dirty
  // draft holds the first intent behind the 放弃修改/继续编辑 bar; a clean one
  // executes it at once. The effect also runs while the panel is closed —
  // external entries from a closed panel (the docs capsule) execute directly.
  const requestClose = actions.requestClose
  const cancelEdit = actions.cancelEdit
  useEffect(() => {
    if (pendingLeave === null) return
    const intent = pendingLeave
    // Document identity is (session, the path the host resolved on the read
    // that opened this session): re-opening the document already showing
    // resets nothing — no guard, no new edit session, no re-read, no scroll
    // reset (#21). The client never guesses symlink equivalences.
    if (intent.kind === 'open' && target !== null
      && target.sessionId === intent.target.sessionId
      && target.path === intent.target.path) {
      leave.clear()
      if (face === 'browse') setFace('document')
      return
    }
    if (state.face === 'edit' && isDirty(state)) return
    leave.clear()
    if (intent.kind === 'close') {
      requestClose()
    } else if (intent.kind === 'switchFace') {
      cancelEdit()
    } else {
      setTarget(intent.target)
      if (intent.target.face !== 'browse') setFace('document')
    }
  }, [pendingLeave, state, target, face, leave, setTarget, setFace, requestClose, cancelEdit])
  // Focus handback after 「继续编辑」 (#21): the button only flags it — the
  // focus lands once the dismissed guard has left the tree, so the editor
  // keeps it through the re-render.
  const refocusEditor = useRef(false)
  useEffect(() => {
    if (pendingLeave !== null || !refocusEditor.current) return
    refocusEditor.current = false
    editorViewRef.current?.focus()
  }, [pendingLeave])
  // The keymap help popover (#16): button or '?' outside the editor.
  const [keysOpen, setKeysOpen] = useState(false)
  // The inline-HTML warning (#17): once per edit session.
  const [htmlWarnDismissed, setHtmlWarnDismissed] = useState(false)
  useEffect(() => { setKeysOpen(false); setHtmlWarnDismissed(false) }, [state.face])
  const searchPhrases = useMemo(() => ({
    Find: t('find.phrases.find'),
    Replace: t('find.phrases.replace'),
    next: t('find.phrases.next'),
    previous: t('find.phrases.previous'),
    all: t('find.phrases.all'),
    'match case': t('find.phrases.matchCase'),
    regexp: t('find.phrases.regexp'),
    'by word': t('find.phrases.byWord'),
    'replace all': t('find.phrases.replaceAll'),
    close: t('find.phrases.close'),
  }), [t])

  const outline = useMemo(
    () => state.content.state === 'ready' ? extractOutline(state.content.file.content) : [],
    [state.content],
  )
  // The outline popover dies with the face switch and the editor view with
  // its mount; both are navigation aids, not session state.
  useEffect(() => { setOutlineOpen(false) }, [face])
  const onEditorView = useCallback((view: EditorView | null): void => { editorViewRef.current = view }, [])

  // The diagram pass rides the settled rendered document; a replaced DOM (new
  // read, edit round-trip) simply runs it again over the fresh blocks.
  const renderedFences = useMemo(
    () => state.content.state === 'ready' ? fenceLanguages(state.content.file.content) : [],
    [state.content],
  )
  useEffect(() => {
    const container = documentRef.current
    if (container === null || face !== 'document' || state.face !== 'view' || state.content.state !== 'ready') return
    if (findDiagramBlocks(container, renderedFences).length === 0) return
    void enhanceDiagrams(container, state.content.file.content, { error: t('diagram.error') })
  }, [face, state.face, state.content, renderedFences, t])

  const computeViewActive = useCallback((): void => {
    const container = documentRef.current
    if (container === null || state.face !== 'view' || state.content.state !== 'ready') return
    const base = container.getBoundingClientRect().top - container.scrollTop
    const tops = outline.map((_, index) => {
      const heading = findHeadingElement(container, outline, index)
      return heading === undefined ? Number.POSITIVE_INFINITY : heading.getBoundingClientRect().top - base
    })
    // The reading anchor sits a little below the viewport top, so the first
    // heading owns the document's very top instead of "nothing".
    setActiveOutline(activeIndexForScroll(tops, container.scrollTop + 24))
  }, [outline, state.face, state.content])

  // The active outline entry follows the rendered document's scroll; the
  // capture listener also covers any descendant that owns the scrollbar.
  // The immediate call covers content-settle (a fresh read at the top marks
  // the first heading without waiting for a scroll).
  useEffect(() => {
    const container = documentRef.current
    if (container === null) return
    const onScroll = (): void => { computeViewActive() }
    container.addEventListener('scroll', onScroll, { capture: true, passive: true })
    computeViewActive()
    return () => { container.removeEventListener('scroll', onScroll, { capture: true }) }
  }, [computeViewActive])

  // A new target re-reads; the active entry resets until the scroll reports.
  useEffect(() => { setActiveOutline(-1) }, [target])

  // The highlighted entry stays visible inside the open popover.
  useEffect(() => {
    if (!outlineOpen) return
    outlineRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeOutline, outlineOpen])

  /** One outline button list feeds the narrow popover and the rail alike. */
  const renderOutlineList = (popover: boolean) => outline.map((entry, index) => (
    <button
      key={`${entry.line}-${entry.text}`} type="button"
      role={popover ? 'menuitem' : undefined}
      className={index === activeOutline ? 'dsh-md-preview-outline-active' : undefined}
      style={{ paddingLeft: `${8 + (entry.level - 1) * 12}px` }}
      title={entry.text}
      aria-current={index === activeOutline ? 'true' : undefined}
      onClick={() => { jumpToOutline(index) }}
    >
      {entry.text}
    </button>
  ))

  const jumpToOutline = useCallback((index: number): void => {
    setOutlineOpen(false)
    const entry = outline[index]
    if (entry === undefined) return
    // The session's edit face (state.face), not the panel's browse face.
    if (state.face === 'edit') {
      const view = editorViewRef.current
      if (view === null) return
      const line = Math.min(Math.max(entry.line, 1), view.state.doc.lines)
      view.dispatch({ selection: { anchor: view.state.doc.line(line).from }, scrollIntoView: true })
      view.focus()
      return
    }
    findHeadingElement(documentRef.current, outline, index)?.scrollIntoView({ block: 'start' })
  }, [outline, state.face])

  // Navigation shortcuts (#12): outline and files, routed by the width —
  // rail tab wide, popover/face swap narrow. Esc dismisses the popover.
  const onPanelKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      // The current popover closes first, then the editor's own find panel
      // keeps its Esc (CodeMirror's keymap owns it); only then does Esc
      // request the panel close through the leave entry — never a discard.
      if (outlineOpen || keysOpen) { setOutlineOpen(false); setKeysOpen(false) }
      else if (state.face === 'edit'
        && (event.target as HTMLElement).closest('.cm-editor') !== null
        && documentRef.current?.querySelector('.cm-panel.cm-search') != null) return
      else leave.request({ kind: 'close' })
      return
    }
    // '?' toggles the keymap help only outside the editor (inside it types).
    if (event.key === '?' && state.face === 'edit'
      && (event.target as HTMLElement).closest('.cm-editor') === null) {
      event.preventDefault()
      setKeysOpen(value => !value)
    }
    if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return
    const key = event.key.toLowerCase()
    if (key === 'o') {
      event.preventDefault()
      if (widePanel) { setRailCollapsed(false); setRailTab('outline') }
      else setOutlineOpen(true)
    } else if (key === 'e') {
      event.preventDefault()
      if (widePanel) { setRailCollapsed(false); setRailTab('files') }
      else { setBrowserEverOpened(true); setFace('browse') }
    }
  }, [outlineOpen, keysOpen, state.face, width, leave])

  const openFromBrowser = useCallback((path: string): void => {
    if (target === null) return
    // A dirty draft never dies silently: the open routes through the common
    // leave entry and the guard asks first (#21).
    leave.request({ kind: 'open', target: { sessionId: target.sessionId, path } })
  }, [leave, target])

  // The tree mounts once anything shows it (rail or browse face) and stays
  // mounted so expansion state survives every switch.
  useEffect(() => {
    if (railVisible || face === 'browse') setBrowserEverOpened(true)
  }, [railVisible, face])

  // Opening the panel hands focus to the tree filter (#9): Esc and the
  // tree's keyboard model go live without a click first. One frame late —
  // the tree itself mounts in the effect pass above.
  const opened = target !== null
  useEffect(() => {
    if (!opened) return
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>('.dsh-md-preview-treefilter')?.focus()
    })
    return () => { cancelAnimationFrame(frame) }
  }, [opened])

  // Crossing the threshold up while browsing returns the face: the tree now
  // lives in the rail and the document takes the stage back.
  useEffect(() => {
    if (railVisible && face === 'browse') setFace('document')
  }, [railVisible, face])

  // The panel stays mounted across targets and opens; the user's widths
  // (overlay edge and rail) persist for the whole app session.


  if (target === null) return null
  return (
    <div
      className="dsh-md-preview-overlay" data-width={width}
      data-maximized={maximized || undefined}
      style={maximized ? undefined : { width: `${width}px` }} onKeyDown={onPanelKeyDown}
    >
      {!maximized && (
        <div
          aria-hidden
          className="dsh-md-preview-edgehandle"
          onDoubleClick={() => { setMaximized(value => !value) }}
          onPointerDown={onEdgeResize}
          onPointerMove={onEdgeResize}
          onPointerUp={onEdgeResize}
        />
      )}
      <div className="dsh-md-preview-panel">
        <div className="dsh-md-preview-header">
          {target.path === '' ? (
            // No document yet: the panel carries its own name instead of
            // empty crumbs — the tree face is the identity.
            <>
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden className="dsh-md-preview-titleicon">
                <path d="M1.5 3.5h4l1.5 2h7.5v7h-13z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
              <span className="dsh-md-preview-title">{t('dock.browse')}</span>
            </>
          ) : (
            <>
              <span className="dsh-md-preview-icon" aria-hidden>📄</span>
              <div className="dsh-md-preview-crumbs" title={`${target.path} · ${process.env.MD_PREVIEW_VERSION}`}>
                {target.path.split('/').map((segment, index, all) => (
                  <span
                    key={`${index}-${segment}`}
                    className="dsh-md-preview-crumb"
                    aria-current={index === all.length - 1 ? 'page' : undefined}
                  >{segment}</span>
                ))}
              </div>
            </>
          )}
          {state.face === 'edit' && isDirty(state) && (
            <span className="dsh-md-preview-dirty" title={t('panel.unsaved.title')} aria-hidden>●</span>
          )}
          {outline.length > 0 && state.content.state === 'ready' && (
            <span className="dsh-md-preview-anchor">
              <button
                type="button" className="dsh-md-preview-icon" aria-label={t('outline.open')}
                aria-expanded={widePanel ? undefined : outlineOpen} title={t('outline.open')}
                onClick={() => {
                  if (widePanel) { setRailCollapsed(false); setRailTab('outline') }
                  else setOutlineOpen(value => !value)
                }}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                  <path d="M2.5 3.5h11M5 8h8.5M2.5 12.5h11M2.5 8h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
              {outlineOpen && (
                <div className="dsh-md-preview-outline" role="menu" ref={outlineRef}>
                  {renderOutlineList(true)}
                </div>
              )}
            </span>
          )}
          {face === 'document' ? (
            <button
              type="button" className="dsh-md-preview-icon" aria-label={t('browse.open')}
              title={t('browse.open')} onClick={() => {
                setBrowserEverOpened(true)
                // Wide: the workspace action folds the rail in and out; the
                // document stays. Narrow: the browse-face swap remains.
                if (widePanel) setRailCollapsed(value => !value)
                else setFace('browse')
              }}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                <path d="M1.5 3.5h4l1.5 2h7.5v7h-13z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            // The back arrow only exists when a document waits behind the
            // tree; the capsule's fresh-browse entry has nothing to return to.
            target.path !== '' && (
              <button
                type="button" className="dsh-md-preview-icon" aria-label={t('browse.back')}
                title={t('browse.back')} onClick={() => { setFace('document') }}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                  <path d="M9.5 3.5L5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )
          )}
          {face === 'document' && state.content.state === 'ready' && isEditable(target.path) && (
            <div className="dsh-md-preview-seg" role="group" aria-label={t('panel.face')}>
              <button
                type="button" aria-label={t('panel.view')} aria-pressed={state.face === 'view'}
                onClick={() => {
                  if (state.face !== 'edit') return
                  // A dirty draft switches through the guard, never silently.
                  leave.request({ kind: 'switchFace' })
                }}
              >{t('panel.view')}</button>
              <button
                type="button" className="dsh-md-preview-editcta" aria-label={t('panel.edit')} aria-pressed={state.face === 'edit'}
                onClick={() => { if (state.face !== 'edit') actions.enterEdit() }}
              >{t('panel.edit')}</button>
            </div>
          )}
          {face === 'document' && state.face === 'edit' && (
            <>
              <button
                type="button" className="dsh-md-preview-icon" aria-label={t('panel.undo')}
                title={`${t('panel.undo')} · Mod-Z`} disabled={editorStatus === null || !editorStatus.canUndo}
                onClick={() => { const view = editorViewRef.current; if (view !== null) undo(view) }}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                  <path d="M6 3.5L2.5 7 6 10.5M2.5 7h7a4 4 0 1 1 0 8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button" className="dsh-md-preview-icon" aria-label={t('panel.redo')}
                title={`${t('panel.redo')} · Mod-Shift-Z`} disabled={editorStatus === null || !editorStatus.canRedo}
                onClick={() => { const view = editorViewRef.current; if (view !== null) redo(view) }}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                  <path d="M10 3.5L13.5 7 10 10.5M13.5 7h-7a4 4 0 1 0 0 8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button" className="dsh-md-preview-icon" aria-label={t('panel.find')}
                title={`${t('panel.find')} · Mod-F`} onClick={() => {
                  const view = editorViewRef.current
                  if (view !== null) openSearchPanel(view)
                }}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                  <path d="M7 12a5 5 0 1 1 4.3-2.5L14 12.2 12.2 14l-2.7-2.7A5 5 0 0 1 7 12zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill="currentColor" opacity="0.9" />
                </svg>
              </button>
              {searchStatus !== null && (
                <span className="dsh-md-preview-findcount" aria-label={t('find.status')}>
                  {searchStatus.index}/{searchStatus.count}
                </span>
              )}
              <button
                type="button" className="dsh-md-preview-icon" aria-label={t('panel.save')}
                title={`${t('panel.save')} · Mod-S`} disabled={!canSave}
                onClick={() => { actions.save(false) }}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                  <path d="M2 2h9l3 3v9H2zM5 2v4h6V2M4 14V9h8v5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button" className="dsh-md-preview-icon" aria-label={t('panel.keys')}
                title={t('panel.keys')} aria-expanded={keysOpen} onClick={() => { setKeysOpen(value => !value) }}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                  <path d="M5.2 6a2.8 2.8 0 1 1 4 2.6c-.8.4-1.2 1-1.2 1.9v.3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                  <circle cx="8" cy="13" r=".9" fill="currentColor" />
                </svg>
              </button>
              {keysOpen && (
                <div className="dsh-md-preview-keypop" role="dialog" aria-label={t('panel.keys')}>
                  <dl>
                    <dt>Mod-B</dt><dd>{t('keys.bold')}</dd>
                    <dt>Mod-I</dt><dd>{t('keys.italic')}</dd>
                    <dt>Mod-K</dt><dd>{t('keys.link')}</dd>
                    <dt>Mod-F</dt><dd>{t('keys.find')}</dd>
                    <dt>Mod-S</dt><dd>{t('keys.save')}</dd>
                    <dt>Mod-Z</dt><dd>{t('keys.undo')}</dd>
                    <dt>Mod-⇧-O</dt><dd>{t('keys.outline')}</dd>
                    <dt>Mod-⇧-E</dt><dd>{t('keys.files')}</dd>
                    <dt>? / Mod-/</dt><dd>{t('keys.help')}</dd>
                    <dt>Esc</dt><dd>{t('keys.dismiss')}</dd>
                  </dl>
                </div>
              )}
            </>
          )}
          <button
            type="button" className="dsh-md-preview-icon"
            aria-label={maximized ? t('panel.restore') : t('panel.maximize')}
            title={maximized ? t('panel.restore') : t('panel.maximize')}
            onClick={() => { setMaximized(value => !value) }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              {maximized
                ? <path d="M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                : <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />}
            </svg>
          </button>
          <button
            type="button" className="dsh-md-preview-icon" aria-label={t('panel.close')}
            onClick={() => { leave.request({ kind: 'close' }) }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="dsh-md-preview-body">
          {browserEverOpened && (
            <div
              className="dsh-md-preview-browser"
              data-open={railVisible || undefined}
              hidden={!railVisible && face !== 'browse'}
              style={railVisible ? { width: `${railWidth}px` } : undefined}
            >
              {railVisible && (
                <div
                  aria-hidden
                  className="dsh-md-preview-railhandle"
                  onPointerDown={onRailResize}
                  onPointerMove={onRailResize}
                  onPointerUp={onRailResize}
                />
              )}
              {railVisible && (
                <div className="dsh-md-preview-railtabs" role="tablist">
                  <button type="button" role="tab" aria-selected={railTab === 'files' ? 'true' : 'false'} onClick={() => { setRailTab('files') }}>{t('rail.files')}</button>
                  <button type="button" role="tab" aria-selected={railTab === 'outline' ? 'true' : 'false'} onClick={() => { setRailTab('outline') }}>{t('rail.outline')}</button>
                </div>
              )}
              {railVisible && (
                <div className="dsh-md-preview-railoutline" hidden={railTab !== 'outline'}>
                  {outline.length === 0 && <div className="dsh-md-preview-treehint" role="presentation">{t('rail.noHeadings')}</div>}
                  {renderOutlineList(false)}
                </div>
              )}
              {target !== null && (
                <div hidden={railVisible && railTab !== 'files'} className="dsh-md-preview-railfiles">
                  <WorkspaceBrowser
                    sessionId={target.sessionId}
                    active={railVisible || face === 'browse'}
                    list={list}
                    onOpenFile={openFromBrowser}
                    currentPath={target.path}
                    t={t}
                  />
                </div>
              )}
            </div>
          )}
          <div className="dsh-md-preview-document" hidden={face !== 'document'} ref={documentRef}>
          {state.toast && state.face === 'view' && (
            <div className="dsh-md-preview-toast" role="status">✓ {t('panel.saved')}</div>
          )}
          {pendingLeave !== null && state.face === 'edit' && isDirty(state) && (
            <div className="dsh-md-preview-bar" role="alert">
              <span>{t('panel.unsaved.title')}</span>
              <button type="button" aria-label={t('panel.unsaved.discard')} onClick={() => {
                // The draft dies here; the still-pending intent then executes
                // exactly once through the leave consumer above.
                actions.cancelEdit()
              }}>{t('panel.unsaved.discard')}</button>
              <button type="button" aria-label={t('panel.unsaved.keep')} onClick={() => {
                leave.clear()
                refocusEditor.current = true
              }}>{t('panel.unsaved.keep')}</button>
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
            <>
            {state.content.state === 'ready' && state.content.file.content.includes('</') && !htmlWarnDismissed && (
              <div className="dsh-md-preview-warnbar" role="status">
                <span>{t('warn.html')}</span>
                <button type="button" aria-label={t('warn.dismiss')} title={t('warn.dismiss')} onClick={() => { setHtmlWarnDismissed(true) }}>✕</button>
              </div>
            )}
            <MarkdownEditor
              initialValue={state.content.state === 'ready' ? state.content.file.content : ''}
              onChange={actions.edit}
              onSave={() => { actions.save(false) }}
              onView={onEditorView}
              onCursorLine={line => { setActiveOutline(activeIndexForLine(outline, line)) }}
              onStatus={setEditorStatus}
              onOpenKeys={() => { setKeysOpen(true) }}
              searchPhrases={searchPhrases}
              onSearchStatus={setSearchStatus}
            />
            {editorStatus !== null && (
              <div className="dsh-md-preview-statusbar">
                <span>{`Ln ${editorStatus.line}, Col ${editorStatus.col}`}</span>
                <span>{`${editorStatus.chars} ${t('status.chars')}`}</span>
                <span>
                  {isDirty(state) ? t('status.unsaved')
                    : savedAt === null ? t('status.clean')
                    : `${t('status.saved')} ${String(savedAt.getHours()).padStart(2, '0')}:${String(savedAt.getMinutes()).padStart(2, '0')}`}
                </span>
              </div>
            )}
            </>
          ) : (
            // An empty path has no read behind it — the placeholder points at
            // the tree instead of an eternal "loading".
            target.path === '' ? <div className="dsh-md-preview-state">{t('panel.pickFile')}</div> : <>
              {state.content.state === 'loading' && <div className="dsh-md-preview-state">{t('panel.loading')}</div>}
              {state.content.state === 'failed' && (
                <div className="dsh-md-preview-state">
                  <div className="dsh-md-preview-error">
                    {t(state.content.code === 'md-preview/unsupported-extension' ? 'panel.unsupported' : 'panel.error')} · {state.content.code}
                  </div>
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
          )
          }
          </div>
        </div>
        <div className="dsh-md-preview-foot" aria-hidden>{process.env.MD_PREVIEW_VERSION}</div>
      </div>
    </div>
  )
}
