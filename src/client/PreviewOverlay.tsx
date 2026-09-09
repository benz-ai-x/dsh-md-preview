/**
 * The right-docked preview panel, contributed into the additive
 * `shell.overlay` list, with a reversible frame-space adapter. Rendering,
 * geometry, and locale only: the preview session — read lifecycle, edit
 * face, guarded save, prompts — lives in the PreviewSession machine behind
 * usePanelDocumentSession, and every leave (close, face switch, opening
 * another document) arrives through the leave-intent seat, which this panel
 * guards and executes. With no target only the hidden layout anchor remains.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { MarkdownText, Tooltip, IconChevronLeftOutline14, IconEllipsisOutline16, IconFolderClose16, IconSearchOutline16, IconQuestionOutline14, IconRefreshOutline16, type MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { EditorView } from '@codemirror/view'
import { openSearchPanel } from '@codemirror/search'
import { redo, undo } from '@codemirror/commands'
import type { MdPreviewFile, MdPreviewListResult, MdPreviewSearchResult, MdPreviewWriteResult } from '../protocol.ts'
import type { MdPreviewState, MdPreviewTarget } from './preview-state.ts'
import { basename } from './preview-state.ts'
import { DocumentIcon } from './DocumentIcon.tsx'
import { documentParent, workspaceDisplayPath } from './document-path.ts'
import { isDirty } from './preview-session.ts'
import type { LeaveIntentSeat } from './leave-intent.ts'
import type { ReadingPosition, ReadingStore } from './reading.ts'
import { applyReadingPosition, captureViewPosition } from './reading.ts'
import type { PanelPreferenceStore, RailTab } from './preferences.ts'
import { clampPanelWidth, clampRailWidth } from './preferences.ts'
import { activeIndexForLine, activeIndexForScroll, extractOutline, findHeadingElement } from './outline.ts'
import { enhanceDiagrams, fenceLanguages, findDiagramBlocks } from './diagrams.ts'
import { MarkdownEditor, type EditorStatus, type SearchStatus } from './editor.tsx'
import { WorkspaceBrowser } from './WorkspaceBrowser.tsx'
import { usePanelDocumentSession } from './use-preview-session.ts'
import { PanelToggle, PREVIEW_PANEL_ID } from './PanelToggle.tsx'
import { usePanelDock } from './use-panel-dock.ts'

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
  /** One workspace document search; the transport carries the AbortSignal. */
  search(
    sessionId: SessionId,
    query: string,
    signal: AbortSignal,
  ): Promise<import('@deepseek-ai/dsh-typert-protocol').RemoteResult<MdPreviewSearchResult>>
  /** The reading record store (#25): per-(session, path) positions. */
  reading: ReadingStore
  /** The current-turn outputs seat (#31): the session header's published
   * view of the newest turn's produced documents. */
  turnOutputs?: SnapshotStore<{ readonly sessionId: SessionId; readonly paths: readonly string[] } | null>
  /** The panel preference record (#26): manual geometry and navigation choices. */
  preferences: PanelPreferenceStore
}

/** Full composed panel props. */
export type PreviewOverlayProps =
  & PropsRuntime<'shell.overlay'>
  & InjectFace<PreviewOverlayInjected>
  & PropsLocale<'md-preview'>

/** Panel width from which the rail shows beside the document (#11). */
const RAIL_MIN_WIDTH = 640

/** Panel width below which low-frequency header tools fold into the ⋯ menu (#22). */
const OVERLAY_COMPACT_WIDTH = 560

/** The no-quick-entries stand-in for benches that pass no turn-outputs seat. */
const NO_TURN_OUTPUTS = {
  getSnapshot: (): null => null,
  subscribe: (): (() => void) => () => {},
}

/** The overlay's own width bounds (the default preset lives in the
 * preference clamps — #26); draggable 360–1200. */
const OVERLAY_MIN_WIDTH = 360
const OVERLAY_MAX_WIDTH = 1200

/**
 * Shared pointer-drag width driver: pointer capture with rAF-coalesced deltas.
 * `sign` maps the drag direction to growth — the rail widens with the pointer
 * (+1); the right-anchored overlay widens against it (−1). `onSettled` fires
 * once when a drag ends (pointer up), the moment a manual choice is complete.
 */
function useDragWidth(
  min: number,
  max: number,
  sign: 1 | -1,
  set: React.Dispatch<React.SetStateAction<number>>,
  onSettled?: () => void,
): (e: React.PointerEvent<HTMLDivElement>) => void {
  const drag = useRef<{ active: boolean; origin: number; latest: number; frame: number | null; moved: boolean }>({
    active: false, origin: 0, latest: 0, frame: null, moved: false,
  })
  return useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current
    if (e.type === 'pointerdown') {
      e.preventDefault()
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* drag over the strip */ }
      current.active = true
      current.origin = e.clientX
      current.latest = e.clientX
      current.moved = false
      return
    }
    if (!current.active) return
    if (e.type === 'pointermove') {
      current.latest = e.clientX
      current.frame ??= requestAnimationFrame(() => {
        current.frame = null
        const next = current.latest - current.origin
        current.origin = current.latest
        if (next !== 0) current.moved = true
        set(width => Math.min(max, Math.max(min, width + sign * next)))
      })
      return
    }
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    } catch { /* release is advisory */ }
    if (current.frame !== null) { cancelAnimationFrame(current.frame); current.frame = null }
    const settled = current.moved
    current.active = false
    current.moved = false
    if (settled) onSettled?.()
  }, [min, max, sign, set, onSettled])
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
 * @returns the docked panel and its hidden shell anchor.
 */
export function PreviewOverlay({ usePreviewTarget, useSessions, leave, close, setTarget, read, write, list, search, reading, turnOutputs, preferences, t }: PreviewOverlayProps) {
  const target = usePreviewTarget(state => state)
  // The platform owns cwd. This selector only formats identity for display;
  // no client path resolution or alternative open/save key is introduced.
  const workspaceRoot = useSessions?.(snapshot => target === null ? undefined : snapshot.byId[target.sessionId]?.cwd)
  const recordRead = useCallback((sessionId: SessionId, path: string): void => {
    try {
      const position = reading?.get(sessionId, path) ?? { anchor: null, index: -1, offsetIntoSection: 0, fraction: 0 }
      reading?.record(sessionId, path, { ...position, at: Date.now() })
    } catch { /* Reading records never decide whether opening succeeds. */ }
  }, [reading])
  const session = usePanelDocumentSession({ read, write, close, onRead: recordRead }, target)
  const { state, canSave, actions } = session
  // The pending leave intent: the panel is the guard's only owner — external
  // entries (chips, the preview action, the docs capsule, tree rows) request
  // into the seat, and this single consumer executes or holds them (#21).
  const pendingLeave = useSyncExternalStore(leave.subscribe, leave.getSnapshot)
  // The panel follows the frame's top edge, reserving space on wide screens
  // and covering it on narrow screens or when maximized (ADR-0004).
  const overlayRef = useRef<HTMLDivElement>(null)
  // The panel owns its width preference, dragged from its left edge. Space
  // concessions alter only the applied width. The manual choice
  // persists through the preference record (#26) — restored clamped to the
  // live viewport, derived from it when nothing was ever chosen (never a
  // bogus zero-to-min fall), and untouched by maximize round-trips. The
  // live viewport is tracked (#26): a window shrunk after open re-clamps
  // the APPLIED width (the stored choice survives to return when it grows
  // back), so the panel never exceeds the screen and its controls stay
  // reachable.
  const [width, setWidth] = useState(() => {
    let remembered: number | null = null
    try { remembered = preferences?.geometry().panelWidth ?? null } catch { /* hostile store */ }
    return clampPanelWidth(remembered, typeof window === 'undefined' ? 0 : window.innerWidth)
  })
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth))
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = (): void => { setViewportWidth(window.innerWidth) }
    window.addEventListener('resize', onResize, { passive: true })
    return () => { window.removeEventListener('resize', onResize) }
  }, [])
  const appliedWidth = clampPanelWidth(width, viewportWidth)
  const widthRef = useRef(width)
  widthRef.current = width
  // Maximize (the B ask): a full-frame preset over the remembered width —
  // restore returns to it exactly; the edge handle hides while taken.
  const [maximized, setMaximized] = useState(false)
  const dock = usePanelDock(target !== null, appliedWidth, maximized)
  const wasOpen = useRef(false)
  useLayoutEffect(() => {
    if (target === null && wasOpen.current) {
      document.querySelector<HTMLButtonElement>('button[data-md-preview-toggle]')?.focus()
    }
    wasOpen.current = target !== null
  }, [target])
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
  // component-local geometry state, like the dragged width — and the manual
  // collapse choice persists through the preference record (#26).
  // The rail's collapse state (#11/#26/#27): a manual choice — this
  // session's or the remembered one — or, until any exists, the open's
  // intent: a direct document entry gives the body priority, an explicit
  // workspace-browse entry expands the navigation. Derived at render so
  // the first paint already carries the arrangement (no flash, no eager
  // tree mount), and nothing re-decides a manual choice.
  const [manualRailCollapsed, setManualRailCollapsed] = useState<boolean | null>(() => {
    try { return preferences?.geometry().railCollapsed ?? null } catch { return null }
  })
  const railCollapsed = manualRailCollapsed ?? target?.face !== 'browse'
  const visibleWidth = dock.bounds?.width ?? (maximized ? viewportWidth : appliedWidth)
  const widePanel = visibleWidth >= RAIL_MIN_WIDTH
  const railVisible = widePanel && !railCollapsed
  // Which rail mini-tab is showing (#12); the choice is document-related
  // navigation state, so it restores per session (#26).
  const [railTab, setRailTab] = useState<RailTab>('files')
  // The compact header (#22): below OVERLAY_COMPACT_WIDTH the low-frequency
  // tools (outline, undo/redo/find, keymap help) fold into a ⋯ menu; save,
  // the face control, maximize, and close stay directly clickable, and the
  // identity shrinks instead of pushing them off the row.
  const compact = visibleWidth < OVERLAY_COMPACT_WIDTH
  const [moreOpen, setMoreOpen] = useState(false)
  // The rail's dragged width (user feedback): persists like the panel width.
  const [railWidth, setRailWidth] = useState(() => {
    let remembered: number | null = null
    try { remembered = preferences?.geometry().railWidth ?? null } catch { /* hostile store */ }
    return clampRailWidth(remembered)
  })
  const railWidthRef = useRef(railWidth)
  railWidthRef.current = railWidth
  /** Manual geometry is complete when a drag ends — one record per choice. */
  const recordDraggedGeometry = useCallback((): void => {
    try { preferences?.recordGeometry({ panelWidth: widthRef.current, railWidth: railWidthRef.current }) } catch { /* hostile store */ }
  }, [preferences])
  const onRailResize = useDragWidth(120, 320, 1, setRailWidth, recordDraggedGeometry)
  const onEdgeResize = useDragWidth(OVERLAY_MIN_WIDTH, OVERLAY_MAX_WIDTH, -1, setWidth, recordDraggedGeometry)
  /** A user's rail collapse choice becomes the restore basis (#26) and
   * ends the automatic intent arrangement (#27). */
  const collapseRail = useCallback((next: boolean): void => {
    setManualRailCollapsed(next)
    try { preferences?.recordGeometry({ railCollapsed: next }) } catch { /* hostile store */ }
  }, [preferences])
  /** The files/outline choice is remembered per owning session (#26). */
  const chooseRailTab = useCallback((tab: RailTab): void => {
    setRailTab(tab)
    if (target === null) return
    try { preferences?.recordRailTab(target.sessionId, tab) } catch { /* hostile store */ }
  }, [preferences, target])
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
  useEffect(() => { setKeysOpen(false); setHtmlWarnDismissed(false); setMoreOpen(false) }, [state.face])
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
    () => state.content.state === 'ready' && state.content.file.kind === 'markdown' ? extractOutline(state.content.file.content) : [],
    [state.content],
  )

  // Reading continuity (#25). One restore per open: `openId` increments at
  // every open boundary (target change, close→reopen) and a restore may
  // fire only while its open has not consumed one. The pending restore
  // rides one animation frame so the freshly rendered document settles
  // first (diagram pass included); a scroll or outline navigation before
  // that frame cancels it — the reader who moved first is never pulled
  // back. Positions capture synchronously from the scroll events and flush
  // to the store on close, switch, unmount, and (debounced) while reading,
  // so a reload without a close still persists.
  const [openId, setOpenId] = useState(0)
  const openIdentity = useRef<{ sessionId: SessionId; path: string } | null>(null)
  const lastOpenKey = useRef('')
  const latestPosition = useRef<ReadingPosition | null>(null)
  const restorePending = useRef<{ frame: number } | null>(null)
  const restoredOpen = useRef(-1)
  const writeTimer = useRef<number | null>(null)
  const flushPosition = useCallback((): void => {
    if (writeTimer.current !== null) {
      window.clearTimeout(writeTimer.current)
      writeTimer.current = null
    }
    const identity = openIdentity.current
    const position = latestPosition.current
    openIdentity.current = null
    latestPosition.current = null
    if (reading === undefined || identity === null || position === null) return
    try { reading.record(identity.sessionId, identity.path, position) } catch { /* hostile store: reading state only */ }
  }, [reading])
  const flushRef = useRef(flushPosition)
  flushRef.current = flushPosition
  useEffect(() => {
    if (target === null) {
      // The open is over (closed): record what the last scroll observed.
      flushPosition()
      lastOpenKey.current = ''
      return
    }
    const key = `${target.sessionId}\0${target.path}`
    if (lastOpenKey.current === key) return
    // A different document takes the stage: the previous open's position
    // is already captured in the ref — flush it, then start the new open.
    flushPosition()
    lastOpenKey.current = key
    openIdentity.current = { sessionId: target.sessionId, path: target.path }
    restoredOpen.current = -1
    // The files/outline choice is document navigation state: restore the
    // owning session's remembered choice, files by default (#26).
    setRailTab(() => {
      try { return preferences?.railTab(target.sessionId) ?? 'files' } catch { return 'files' as const }
    })
    setOpenId(value => value + 1)
  }, [target, flushPosition])
  // Unmount (dispose) still records: the position survives the teardown.
  useEffect(() => () => { flushRef.current() }, [])

  // Arm the one restore of this open once the fresh content is rendered.
  useEffect(() => {
    if (reading === undefined || target === null || target.path === '') return
    if (face !== 'document' || state.face !== 'view' || state.content.state !== 'ready') return
    if (restoredOpen.current === openId) return
    restoredOpen.current = openId
    let position: ReadingPosition | null = null
    try { position = reading.get(target.sessionId, target.path) } catch { /* hostile store: no restore */ }
    if (position === null) return
    const restore = position
    const frame = requestAnimationFrame(() => {
      restorePending.current = null
      const container = documentRef.current
      if (container === null) return
      applyReadingPosition(container, outline, restore)
    })
    restorePending.current = { frame }
    return () => {
      if (restorePending.current?.frame === frame) {
        cancelAnimationFrame(frame)
        restorePending.current = null
      }
    }
  }, [reading, target, openId, face, state.face, state.content.state, outline])

  // The capture listener: cancels a pending restore (the reader moved
  // first) and keeps the latest observed position; the store write itself
  // is debounced so a reading burst costs nothing.
  useEffect(() => {
    const container = documentRef.current
    if (container === null) return
    const capture = (): ReadingPosition | null => {
      if (target === null || target.path === '' || face !== 'document'
        || state.face !== 'view' || state.content.state !== 'ready') return null
      return captureViewPosition(container, outline, Date.now())
    }
    const onScroll = (): void => {
      if (restorePending.current !== null) {
        cancelAnimationFrame(restorePending.current.frame)
        restorePending.current = null
      }
      const captured = capture()
      if (captured !== null) latestPosition.current = captured
      if (writeTimer.current === null) {
        writeTimer.current = window.setTimeout(() => {
          writeTimer.current = null
          const identity = openIdentity.current
          const position = latestPosition.current
          if (reading === undefined || identity === null || position === null) return
          try { reading.record(identity.sessionId, identity.path, position) } catch { /* hostile store */ }
        }, 600)
      }
    }
    container.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      container.removeEventListener('scroll', onScroll, { capture: true })
      if (writeTimer.current !== null) {
        window.clearTimeout(writeTimer.current)
        writeTimer.current = null
      }
    }
  }, [reading, target, face, state.face, state.content, outline])

  // The outline popover dies with the face switch and the editor view with
  // its mount; both are navigation aids, not session state.
  useEffect(() => { setOutlineOpen(false) }, [face])
  const onEditorView = useCallback((view: EditorView | null): void => { editorViewRef.current = view }, [])

  // The diagram pass rides the settled rendered document; a replaced DOM (new
  // read, edit round-trip) simply runs it again over the fresh blocks.
  const renderedFences = useMemo(
    () => state.content.state === 'ready' && state.content.file.kind === 'markdown' ? fenceLanguages(state.content.file.content) : [],
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
    // Navigation is the reader acting first (#25): a restore still waiting
    // for its frame is dead — the jump wins, the old position never returns.
    if (restorePending.current !== null) {
      cancelAnimationFrame(restorePending.current.frame)
      restorePending.current = null
    }
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
    if (event.altKey && !event.metaKey && !event.ctrlKey && event.key.toLowerCase() === 'r'
      && face === 'document' && state.face === 'view' && target !== null && target.path !== '') {
      event.preventDefault()
      actions.retryRead()
      return
    }
    if (event.key === 'Escape') {
      // The current popover closes first, then the editor's own find panel
      // keeps its Esc (CodeMirror's keymap owns it); only then does Esc
      // request the panel close through the leave entry — never a discard.
      if (outlineOpen || keysOpen || moreOpen) { setOutlineOpen(false); setKeysOpen(false); setMoreOpen(false) }
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
      if (widePanel) { collapseRail(false); chooseRailTab('outline') }
      else setOutlineOpen(true)
    } else if (key === 'e') {
      event.preventDefault()
      if (widePanel) { collapseRail(false); chooseRailTab('files') }
      else { setBrowserEverOpened(true); setFace('browse') }
    }
  }, [outlineOpen, keysOpen, moreOpen, state.face, width, leave, collapseRail, chooseRailTab, face, target, actions.retryRead])

  const openFromBrowser = useCallback((path: string): void => {
    if (target === null) return
    // A dirty draft never dies silently: the open routes through the common
    // leave entry and the guard asks first (#21).
    leave.request({ kind: 'open', target: { sessionId: target.sessionId, path } })
  }, [leave, target])

  // The continue-reading target (#28): the session's most recent reading
  // record, offered by the browse area. It is the record's path and nothing
  // else — no second body, no guessing from conversation text — and opening
  // it rides the same leave entry as every other open.
  let continueTarget: { readonly path: string } | null = null
  if (target !== null) {
    try { continueTarget = reading?.latest(target.sessionId) ?? null } catch { continueTarget = null }
  }
  // The quick entries' two sources (#31): the session header's published
  // current-turn outputs (only the target session's entry may show) and the
  // reading record's recency list. Derived views over owning facts — the
  // panel copies nothing.
  const outputsStore = turnOutputs ?? NO_TURN_OUTPUTS
  const publishedOutputs = useSyncExternalStore(outputsStore.subscribe, outputsStore.getSnapshot)
  const quickTurnOutputs = target !== null && publishedOutputs !== null && publishedOutputs.sessionId === target.sessionId
    ? publishedOutputs.paths
    : null
  let quickRecent: ReadonlyArray<{ readonly path: string }> = []
  if (target !== null && reading !== undefined) {
    try { quickRecent = reading.recent(target.sessionId, 8) } catch { quickRecent = [] }
  }
  const continueFromBrowser = useCallback((): void => {
    if (target === null || continueTarget === null) return
    leave.request({ kind: 'open', target: { sessionId: target.sessionId, path: continueTarget.path } })
  }, [leave, target, continueTarget])

  // The tree mounts once anything shows it (rail or browse face) and stays
  // mounted so expansion state survives every switch.
  useEffect(() => {
    if (railVisible || face === 'browse') setBrowserEverOpened(true)
  }, [railVisible, face])

  // Opening the panel hands focus to the search box (#9): Esc and the
  // tree's keyboard model go live without a click first. One frame late —
  // the tree itself mounts in the effect pass above.
  const opened = target !== null
  useEffect(() => {
    if (!opened) return
    const focusAtOpen = document.activeElement
    const frame = requestAnimationFrame(() => {
      const panel = overlayRef.current
      if (panel === null) return
      const active = document.activeElement
      // A reader may have focused a row before the deferred mount settles.
      // Never take that focus back, or focus another panel's search field.
      if (active !== null && panel.contains(active)) return
      if (active !== focusAtOpen && active !== document.body) return
      panel.querySelector<HTMLInputElement>('.dsh-md-preview-searchinput')?.focus()
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

  // The low-frequency header tools (#22): rendered inline on the wide row,
  // folded into the ⋯ menu when compact. One definition, two homes.
  const showOutlineControl = outline.length > 0 && state.content.state === 'ready'
  const outlineTool = (
    <button
      type="button" className="dsh-md-preview-icon" aria-label={t('outline.open')}
      aria-expanded={widePanel ? undefined : outlineOpen} title={t('outline.open')}
      onClick={() => {
        if (widePanel) { collapseRail(false); chooseRailTab('outline') }
        else setOutlineOpen(value => !value)
      }}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
        <path d="M2.5 3.5h11M5 8h8.5M2.5 12.5h11M2.5 8h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </button>
  )
  const undoTool = (
    <button
      type="button" className="dsh-md-preview-icon" aria-label={t('panel.undo')}
      title={`${t('panel.undo')} · Mod-Z`} disabled={editorStatus === null || !editorStatus.canUndo}
      onClick={() => { const view = editorViewRef.current; if (view !== null) undo(view) }}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
        <path d="M6 3.5L2.5 7 6 10.5M2.5 7h7a4 4 0 1 1 0 8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
  const redoTool = (
    <button
      type="button" className="dsh-md-preview-icon" aria-label={t('panel.redo')}
      title={`${t('panel.redo')} · Mod-Shift-Z`} disabled={editorStatus === null || !editorStatus.canRedo}
      onClick={() => { const view = editorViewRef.current; if (view !== null) redo(view) }}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
        <path d="M10 3.5L13.5 7 10 10.5M13.5 7h-7a4 4 0 1 0 0 8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
  const findTool = (
    <button
      type="button" className="dsh-md-preview-icon" aria-label={t('panel.find')}
      title={`${t('panel.find')} · Mod-F`} onClick={() => {
        const view = editorViewRef.current
        if (view !== null) openSearchPanel(view)
      }}
    >
      <IconSearchOutline16 />
    </button>
  )
  const keysTool = (
    <button
      type="button" className="dsh-md-preview-icon" aria-label={t('panel.keys')}
      title={t('panel.keys')} aria-expanded={keysOpen} onClick={() => { setKeysOpen(value => !value) }}
    >
      <IconQuestionOutline14 size={16} />
    </button>
  )
  /** The compact ⋯ menu carrying whatever low-frequency tools exist here. */
  const renderMoreMenu = (tools: React.ReactNode): React.ReactNode => (
    <span className="dsh-md-preview-anchor">
      <button
        type="button" className="dsh-md-preview-icon" aria-label={t('panel.more')}
        title={t('panel.more')} aria-expanded={moreOpen}
        onClick={() => { setMoreOpen(value => !value) }}
      >
        <IconEllipsisOutline16 />
      </button>
      {moreOpen && (
        <div className="dsh-md-preview-more" role="menu" onClickCapture={() => { setMoreOpen(false) }}>
          {tools}
        </div>
      )}
    </span>
  )

  const panel = target === null ? null : (
    <div
      ref={overlayRef}
      id={PREVIEW_PANEL_ID}
      role="complementary" aria-label={t('dock.browse')}
      className="dsh-md-preview-overlay" data-width={visibleWidth}
      data-docked={(dock.bounds !== null && dock.bounds.reserved > 0) || undefined}
      data-maximized={maximized || undefined}
      data-compact={compact || undefined}
      data-narrow={visibleWidth <= 420 || undefined}
      style={{
        ...(dock.bounds === null
          ? (maximized ? {} : { width: `${appliedWidth}px` })
          : { position: 'fixed', left: dock.bounds.left, top: dock.bounds.top, width: dock.bounds.width, height: dock.bounds.height, right: 'auto', bottom: 'auto', zIndex: 20 }),
      }} onKeyDown={onPanelKeyDown}
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
              <IconFolderClose16 className="dsh-md-preview-titleicon" />
              <Tooltip label={`${t('panel.title')} · ${process.env.MD_PREVIEW_VERSION}`} side="bottom" delayMs={450}>
                <span className="dsh-md-preview-title" tabIndex={0} title={`${t('panel.title')} · ${process.env.MD_PREVIEW_VERSION}`}>{t('dock.browse')}</span>
              </Tooltip>
            </>
          ) : (
            <>
              <div className="dsh-md-preview-identity">
                <DocumentIcon kind={state.content.state === 'ready' ? state.content.file.kind : 'file'} />
                <Tooltip label={`${target.path} · ${process.env.MD_PREVIEW_VERSION}`} side="bottom" delayMs={450} maxWidth={420}>
                  <div className="dsh-md-preview-crumbs" tabIndex={0} title={`${target.path} · ${process.env.MD_PREVIEW_VERSION}`}>
                    {documentParent(workspaceDisplayPath(target.path, workspaceRoot)) !== '.' && (
                      <span className="dsh-md-preview-crumb">{documentParent(workspaceDisplayPath(target.path, workspaceRoot))}</span>
                    )}
                    <span className="dsh-md-preview-crumb" aria-current="page">{basename(target.path)}</span>
                  </div>
                </Tooltip>
              </div>
            </>
          )}
          {state.face === 'edit' && isDirty(state) && (
            <span className="dsh-md-preview-dirty" title={t('panel.unsaved.title')} aria-hidden>●</span>
          )}
          {showOutlineControl && (
            <span className="dsh-md-preview-anchor dsh-md-preview-outlineanchor">
              {!compact && outlineTool}
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
                if (widePanel) collapseRail(!railCollapsed)
                else setFace('browse')
              }}
            >
              <IconFolderClose16 />
            </button>
          ) : (
            // The back arrow only exists when a document waits behind the
            // tree; the capsule's fresh-browse entry has nothing to return to.
            target.path !== '' && (
              <button
                type="button" className="dsh-md-preview-icon" aria-label={t('browse.back')}
                title={t('browse.back')} onClick={() => { setFace('document') }}
              >
                <IconChevronLeftOutline14 />
              </button>
            )
          )}
          {face === 'document' && state.face === 'view' && target.path !== '' && (
            <button
              type="button" className="dsh-md-preview-icon" aria-label={t('panel.refresh')}
              title={`${t('panel.refresh')} · Alt-R`} aria-keyshortcuts="Alt+R"
              aria-busy={state.content.state === 'loading' || undefined}
              onClick={actions.retryRead}
            ><IconRefreshOutline16 /></button>
          )}
          {face === 'document' && state.content.state === 'ready' && state.content.file.editable && (
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
              {!compact && <>{undoTool}{redoTool}{findTool}</>}
              <button
                type="button" className="dsh-md-preview-icon" aria-label={t('panel.save')}
                title={`${t('panel.save')} · Mod-S`} disabled={!canSave} aria-busy={state.saving || undefined}
                onClick={() => { actions.save(false) }}
              >
                {state.saving
                  ? <span className="dsh-md-preview-savebusy" aria-hidden />
                  : <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
                      <path d="M2 2h9l3 3v9H2zM5 2v4h6V2M4 14V9h8v5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
                    </svg>}
              </button>
              {!compact && keysTool}
              {compact && renderMoreMenu(<>{showOutlineControl ? outlineTool : undefined}{undoTool}{redoTool}{findTool}{keysTool}</>)}
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
          {compact && state.face !== 'edit' && showOutlineControl && renderMoreMenu(outlineTool)}
          <span className="dsh-md-preview-paneltools">
            <button
              type="button" className="dsh-md-preview-icon"
              aria-label={maximized ? t('panel.restore') : t('panel.maximize')}
              title={maximized ? t('panel.restore') : t('panel.maximize')}
              onClick={() => { setMaximized(value => !value) }}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
                {maximized
                  ? <path d="M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  : <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />}
              </svg>
            </button>
            <PanelToggle
              open label={t('panel.close')}
              onClick={() => { leave.request({ kind: 'close' }) }}
            />
          </span>
        </div>
        <div className="dsh-md-preview-body">
          {browserEverOpened && (
            <div
              className="dsh-md-preview-browser"
              data-open={railVisible || undefined}
              data-narrow={(railVisible && railWidth <= 180) || undefined}
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
                  <button type="button" role="tab" aria-selected={railTab === 'files' ? 'true' : 'false'} onClick={() => { chooseRailTab('files') }}>{t('rail.files')}</button>
                  <button type="button" role="tab" aria-selected={railTab === 'outline' ? 'true' : 'false'} onClick={() => { chooseRailTab('outline') }}>{t('rail.outline')}</button>
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
                    search={search}
                    onOpenFile={openFromBrowser}
                    turnOutputs={quickTurnOutputs}
                    recentReads={quickRecent}
                    currentPath={workspaceDisplayPath(target.path, workspaceRoot)}
                    workspaceRoot={workspaceRoot}
                    continueTarget={continueTarget}
                    onContinue={continueFromBrowser}
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
              <span className="dsh-md-preview-barhint">{t('panel.conflict.hint')}</span>
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
                {searchStatus !== null && (
                  <span className="dsh-md-preview-findcount" aria-label={t('find.status')}>
                    {t('find.status')} · {searchStatus.index}/{searchStatus.count}
                  </span>
                )}
                <span>
                  {state.saving ? t('status.saving')
                    : state.saveError !== null ? `${t('status.saveFailed')} · ${state.saveError.code}`
                    : isDirty(state) ? t('status.unsaved')
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
              {state.content.state === 'failed' && state.savedPendingRead && (
                // The write landed; only the confirming re-read failed (#23).
                // Both results are stated — never a write failure, never the
                // stale pre-save body — and the read has its own retry.
                <div className="dsh-md-preview-state">
                  <div className="dsh-md-preview-error">{t('panel.saved.readFailed')}</div>
                  <div>{state.content.code} — {state.content.message}</div>
                  <button
                    type="button" className="dsh-md-preview-retry"
                    onClick={actions.retryRead}
                  >
                    {t('panel.retry')}
                  </button>
                </div>
              )}
              {state.content.state === 'failed' && !state.savedPendingRead && (
                <div className="dsh-md-preview-state">
                  <div className="dsh-md-preview-error">
                    {t(state.content.code === 'md-preview/unsupported-extension' ? 'panel.unsupported'
                      : state.content.code === 'md-preview/not-text' ? 'panel.notText' : 'panel.error')} · {state.content.code}
                  </div>
                  <div>{state.content.message}</div>
                  <button
                    type="button" className="dsh-md-preview-retry"
                    onClick={actions.retryRead}
                  >
                    {t('panel.retry')}
                  </button>
                  {/* A moved, deleted, or unreadable document (#25): the way
                    * back to finding documents is one explicit click away. */}
                  <button
                    type="button" className="dsh-md-preview-retry"
                    aria-label={t('panel.failBrowse')}
                    onClick={() => { setBrowserEverOpened(true); setFace('browse') }}
                  >
                    {t('panel.failBrowse')}
                  </button>
                </div>
              )}
              {state.content.state === 'ready' && (
                // The read measure (#27): the body centers on a reading
                // measure instead of stretching with the panel — one
                // measure for normal widths, a wider one when maximized.
                <div className="dsh-md-preview-read">
                  {!state.content.file.editable && <div className="dsh-md-preview-readonly">{t('panel.readonly')}</div>}
                  {state.content.file.kind === 'markdown'
                    ? <MarkdownText text={state.content.file.content} labels={labels} />
                    : <pre className="dsh-md-preview-plaintext">{state.content.file.content}</pre>}
                </div>
              )}
            </>
          )
          }
          </div>
        </div>
      </div>
    </div>
  )
  return <><span ref={dock.anchor} hidden aria-hidden />{dock.container === null ? panel : createPortal(panel, dock.container)}</>
}
