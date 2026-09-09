/**
 * The browser face's workspace tree: a lazily expanded directory listing of
 * the session workspace, plus the workspace search (#30). Expansion state
 * (which directories are open, their loading/empty/error states) is UI-local
 * viewing state; a directory's children are fetched when its caret opens it
 * and discarded when it closes. The toolbar input is a workspace-wide
 * document search answered by the host — it covers directories this tree
 * never expanded — and while a query is live the results list replaces the
 * tree (kept mounted, hidden, so clearing the query restores the exact
 * browsing state). Single-clicking a file or a search result hands its path
 * to the panel as a preview target through the same guarded open path.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { IconChevronRightOutline14, IconCloseOutline16, IconRefreshOutline16, IconSearchOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { MdPreviewEntry, MdPreviewListResult, MdPreviewSearchResult } from '../protocol.ts'
import { basename, isPreviewable } from './preview-state.ts'
import { DocumentIcon } from './DocumentIcon.tsx'
import { documentParent, workspaceDisplayPath } from './document-path.ts'

/** Listing RPC, the search RPC, and the file-open handoff, created in the plugin's apply world. */
export interface WorkspaceBrowserProps {
  /** Owning session whose workspace the tree roots at. */
  sessionId: SessionId
  /** Whether the browse face is showing (refreshes revalidate on entry). */
  active: boolean
  /** One directory listing; the transport carries the AbortSignal. */
  list(
    sessionId: SessionId,
    path: string,
    signal: AbortSignal,
  ): Promise<RemoteResult<MdPreviewListResult>>
  /** One workspace document search; the transport carries the AbortSignal. */
  search(
    sessionId: SessionId,
    query: string,
    signal: AbortSignal,
  ): Promise<RemoteResult<MdPreviewSearchResult>>
  /** Open one file as the panel's preview target. */
  onOpenFile(path: string): void
  /** Previewable documents the session's newest turn produced (#31); null
   * while no owning-session facts were published, empty when it produced
   * none — the section hides either way. */
  turnOutputs?: readonly string[] | null
  /** The session's recently read documents, recency-first (#31). */
  recentReads?: ReadonlyArray<{ readonly path: string }>
  /** Workspace-relative path of the current preview target, if any. */
  currentPath: string | null
  /** Owning session's cwd, supplied by the platform selector, for display only. */
  workspaceRoot?: string | undefined
  /** The session's continue-reading target, or null without a record (#28). */
  continueTarget?: { readonly path: string } | null
  /** Open the continue-reading target through the unified leave entry (#28). */
  onContinue?: () => void
  /** Locale seat. */
  t(key: string): string
}

/** Expansion state of one opened directory. */
type DirState =
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly entries: readonly MdPreviewEntry[] }
  | { readonly state: 'failed' }

/** The workspace search's UI-local lifecycle (#30). */
type SearchState =
  /** No query: the tree is the face. */
  | { readonly state: 'idle' }
  /** A query is typed or in flight; no answer owns the box yet. */
  | { readonly state: 'searching'; readonly query: string }
  /** An answer landed for exactly this query. */
  | { readonly state: 'done'; readonly query: string; readonly result: MdPreviewSearchResult }
  /** The search itself failed for exactly this query. */
  | { readonly state: 'failed'; readonly query: string; readonly code: string; readonly message: string }

/** How long the search box waits for typing to settle before one RPC (#30). */
export const SEARCH_DEBOUNCE_MS = 200

/** Quick entries stay few (#31): the caps each section shows. */
export const QUICK_TURN_MAX = 5
export const QUICK_RECENT_MAX = 3

const OTHER_TYPE = 'other'

/** Visual kind of one file entry, decided by extension (icon + data-kind). */
function fileKind(name: string): 'markdown' | 'image' | 'text' | 'file' {
  if (/\.(?:md|markdown)$/i.test(name)) return 'markdown'
  if (/\.(?:png|jpe?g|gif|svg|webp|bmp|avif)$/i.test(name)) return 'image'
  if (/\.(?:txt|text|log|csv|json|ya?ml|toml)$/i.test(name)) return 'text'
  return 'file'
}

/**
 * Entries render unfiltered: while a query is live the whole tree hides
 * behind the results list (expansion state survives in `dirs`), so no
 * loaded-node narrowing runs anymore — the search covers everything.
 */

/** The file name with its search hit wrapped in <mark> (nothing when no hit). */
function highlightName(name: string, normalized: string): ReactNode {
  const at = normalized.length === 0 ? -1 : name.toLowerCase().indexOf(normalized)
  if (at < 0) return name
  return <>
    {name.slice(0, at)}
    <mark>{name.slice(at, at + normalized.length)}</mark>
    {name.slice(at + normalized.length)}
  </>
}

/** Keep the file-kind vocabulary while sharing the panel's icon family. */
function EntryIcon({ type, name, expanded = false }: { type: MdPreviewEntry['type']; name: string; expanded?: boolean }) {
  return <DocumentIcon kind={type === 'directory' ? 'directory' : type === OTHER_TYPE ? 'file' : fileKind(name)} expanded={expanded} className="dsh-md-preview-tree-icon" />
}

/**
 * Render the workspace tree (and, while a query is live, the search results)
 * for one session.
 * @param props - session identity, listing/search RPCs, file-open handoff, locale seat.
 * @returns the browse area's tree/search elements.
 */
export function WorkspaceBrowser({ sessionId, active, list, search, onOpenFile, turnOutputs, recentReads, currentPath, workspaceRoot, continueTarget, onContinue, t }: WorkspaceBrowserProps) {
  // Keyed by workspace-relative directory path; presence means expanded.
  const [dirs, setDirs] = useState<ReadonlyMap<string, DirState>>(new Map([['', { state: 'loading' }]]))
  const controllers = useRef(new Map<string, AbortController>())
  const dirsRef = useRef<ReadonlyMap<string, DirState>>(new Map())
  dirsRef.current = dirs
  // Roving focus (one tab stop): the workspace-relative path of the focused node.
  const [focusPath, setFocusPath] = useState<string | null>(null)
  // The workspace search (#30): the toolbar input's text drives a debounced,
  // cancellable host search. A blank query is the idle tree; a live query
  // swaps in the results list and hides the tree (kept mounted so clearing
  // restores the exact browsing state).
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const [searchState, setSearchState] = useState<SearchState>({ state: 'idle' })
  const searchController = useRef<AbortController | null>(null)
  const searchTimer = useRef<number | null>(null)
  const searchSession = useRef(sessionId)
  const treeRef = useRef<HTMLUListElement>(null)
  // The mount itself lists the root; only later activations revalidate.
  const everActive = useRef(false)

  useEffect(() => {
    if (focusPath !== null) return
    const first = treeRef.current?.querySelector<HTMLElement>('[role="treeitem"]') ?? null
    if (first !== null) setFocusPath(first.dataset.path ?? null)
  }, [focusPath, dirs])

  /** Visible treeitems in document order (collapsed children are absent). */
  const visibleItems = (): HTMLElement[] =>
    Array.from(treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])


  const load = useCallback((path: string): void => {
    setDirs(current => new Map(current).set(path, { state: 'loading' }))
    controllers.current.get(path)?.abort()
    const controller = new AbortController()
    controllers.current.set(path, controller)
    void list(sessionId, path, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      setDirs(current => new Map(current).set(path, result.ok
        ? { state: 'ready', entries: result.value.entries }
        : { state: 'failed' }))
    })
  }, [list, sessionId])

  /** Cancel any pending search work (timer and RPC alike) — the shared
   * teardown of query changes, session boundaries, and unmount. */
  const cancelSearch = useCallback((): void => {
    if (searchTimer.current !== null) {
      window.clearTimeout(searchTimer.current)
      searchTimer.current = null
    }
    searchController.current?.abort()
    searchController.current = null
  }, [])

  /** Fire one search for `raw`; only its own answer may land. */
  const runSearch = useCallback((raw: string): void => {
    cancelSearch()
    const trimmed = raw.trim()
    if (trimmed.length === 0) {
      setSearchState({ state: 'idle' })
      return
    }
    const session = searchSession.current
    setSearchState({ state: 'searching', query: trimmed })
    const controller = new AbortController()
    searchController.current = controller
    void search(session, trimmed, controller.signal).then(result => {
      // A superseded answer (new query, cleared box, session switch, or
      // unmount already aborted it) must not touch the face.
      if (controller.signal.aborted) return
      setSearchState(result.ok
        ? { state: 'done', query: trimmed, result: result.value }
        : { state: 'failed', query: trimmed, code: result.error.code, message: result.error.message })
    })
  }, [cancelSearch, search])

  useEffect(() => {
    // The root load also owns the session boundary: a new owning session
    // (load's identity changes with it) starts a fresh tree — stale
    // expansion content from the previous session must not survive, and the
    // search box resets with it (its query belonged to the old workspace).
    for (const controller of controllers.current.values()) controller.abort()
    controllers.current.clear()
    cancelSearch()
    searchSession.current = sessionId
    setQuery('')
    setSearchState({ state: 'idle' })
    setFocusPath(null)
    setDirs(new Map([['', { state: 'loading' }]]))
    load('')
    return () => {
      for (const controller of controllers.current.values()) controller.abort()
      cancelSearch()
    }
  }, [load, cancelSearch, sessionId])

  /** Typing arms the debounce: the box flips to searching at once, the RPC
   * waits for the keys to settle; clearing returns to the idle tree. */
  const onQueryInput = useCallback((raw: string): void => {
    setQuery(raw)
    cancelSearch()
    if (raw.trim().length === 0) {
      setSearchState({ state: 'idle' })
      return
    }
    setSearchState({ state: 'searching', query: raw.trim() })
    searchTimer.current = window.setTimeout(() => {
      searchTimer.current = null
      runSearch(raw)
    }, SEARCH_DEBOUNCE_MS)
  }, [cancelSearch, runSearch])

  /** Silent revalidation: refetch one listing, keeping the current one until
   * the fresh answer lands (a failed refresh never blanks the tree). */
  const refreshPath = useCallback((path: string): void => {
    controllers.current.get(path)?.abort()
    const controller = new AbortController()
    controllers.current.set(path, controller)
    void list(sessionId, path, controller.signal).then((result) => {
      if (controller.signal.aborted || !result.ok) return
      setDirs(current => new Map(current).set(path, { state: 'ready', entries: result.value.entries }))
    })
  }, [list, sessionId])

  const refreshAll = useCallback((): void => {
    for (const path of dirsRef.current.keys()) refreshPath(path)
  }, [refreshPath])
  // Through a ref: the effect must key on `active` alone, or a session change
  // (new refreshAll identity) would revalidate against the stale expansion
  // set and resurrect directories the session-boundary reset just dropped.
  const refreshAllRef = useRef(refreshAll)
  refreshAllRef.current = refreshAll

  // The agent keeps producing files mid-conversation; every re-entry into the
  // browse face revalidates the expanded directories (mount already loaded).
  useEffect(() => {
    if (!active) return
    if (everActive.current) refreshAllRef.current()
    else everActive.current = true
  }, [active])

  // Auto-reveal: a target set outside the tree (chip row, message action)
  // walks its ancestor directories open so the file is already located.
  useEffect(() => {
    if (currentPath === null) return
    const segments = currentPath.split('/')
    for (let depth = 1; depth < segments.length; depth += 1) {
      const prefix = segments.slice(0, depth).join('/')
      if (!dirsRef.current.has(prefix)) load(prefix)
    }
  }, [currentPath, load])

  const toggle = useCallback((path: string): void => {
    setDirs(current => {
      if (!current.has(path)) {
        load(path)
        return current
      }
      const next = new Map(current)
      next.delete(path)
      controllers.current.get(path)?.abort()
      controllers.current.delete(path)
      return next
    })
  }, [load])
  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLUListElement>): void => {
    const items = visibleItems()
    const current = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]')
    if (current === null || items.length === 0) return
    const index = items.indexOf(current)
    const isBranch = current.classList.contains('dsh-md-preview-treebranch')
    const focusAt = (next: number): void => {
      const clamped = items[Math.min(Math.max(next, 0), items.length - 1)]
      if (clamped === undefined) return
      setFocusPath(clamped.dataset.path ?? null)
      clamped.focus()
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusAt(index + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusAt(index - 1)
        break
      case 'ArrowRight':
        event.preventDefault()
        if (isBranch && current.getAttribute('aria-expanded') !== 'true') toggle(current.dataset.path ?? '')
        else focusAt(index + 1)
        break
      case 'ArrowLeft': {
        event.preventDefault()
        if (isBranch && current.getAttribute('aria-expanded') === 'true') {
          toggle(current.dataset.path ?? '')
          break
        }
        const parent = current.parentElement?.closest<HTMLElement>('[role="treeitem"]') ?? null
        if (parent !== null) {
          setFocusPath(parent.dataset.path ?? null)
          parent.focus()
        }
        break
      }
      case 'Home':
        event.preventDefault()
        focusAt(0)
        break
      case 'End':
        event.preventDefault()
        focusAt(items.length - 1)
        break
      case 'Enter': {
        event.preventDefault()
        const path = current.dataset.path ?? ''
        if (path.length === 0) return
        if (isBranch) toggle(path)
        else if (current.getAttribute('aria-disabled') !== 'true') onOpenFile(path)
        break
      }
    }
  }, [onOpenFile, toggle])

  // Roving focus over the search results (#30): the workspace-relative path of
  // the focused option; null leaves the first option as the tab stop.
  const [resultFocus, setResultFocus] = useState<string | null>(null)
  useEffect(() => { setResultFocus(null) }, [normalizedQuery])
  const onResultsKeyDown = useCallback((event: React.KeyboardEvent<HTMLUListElement>): void => {
    const options = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]'))
    if (options.length === 0) return
    const current = (event.target as HTMLElement).closest<HTMLElement>('[role="option"]')
    if (event.key === 'Enter') {
      if (current === null) return
      event.preventDefault()
      const path = current.dataset.path ?? ''
      if (path.length > 0) onOpenFile(path)
      return
    }
    const index = current === null ? -1 : options.indexOf(current)
    let next: number | null = null
    if (event.key === 'ArrowDown') next = Math.min(index + 1, options.length - 1)
    else if (event.key === 'ArrowUp') next = Math.max(index - 1, 0)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = options.length - 1
    if (next === null) return
    event.preventDefault()
    const target = options[next]
    if (target === undefined) return
    setResultFocus(target.dataset.path ?? null)
    target.focus()
  }, [onOpenFile])

  const renderEntries = (entries: readonly MdPreviewEntry[], level: number) => {
    return entries.map(entry => {
    const state = dirs.get(entry.path)
    const canPreview = entry.type === 'file' && isPreviewable(entry.name) && isPreviewable(entry.path)
    const isCurrent = currentPath !== null && entry.path === currentPath
    // A collapsed directory whose subtree holds the current target inherits
    // the selection, so the location reads even before it opens.
    const inherits = currentPath !== null
      && entry.type === 'directory'
      && !isCurrent
      && currentPath.startsWith(`${entry.path}/`)
    return (
      <li
        key={entry.path}
        role="treeitem"
        data-path={entry.path}
        tabIndex={focusPath === entry.path ? 0 : -1}
        aria-level={level}
        aria-expanded={entry.type === 'directory' ? state !== undefined : undefined}
        aria-selected={isCurrent || inherits ? 'true' : undefined}
        aria-current={isCurrent ? 'true' : undefined}
        aria-disabled={entry.type !== 'directory' && !canPreview ? 'true' : undefined}
        data-current={isCurrent || undefined}
        data-kind={entry.type === 'directory' ? 'directory' : (entry.type === OTHER_TYPE ? 'file' : fileKind(entry.name))}
        className={entry.type === 'directory' ? 'dsh-md-preview-treeitem dsh-md-preview-treebranch' : 'dsh-md-preview-treeitem dsh-md-preview-treeleaf'}
        title={entry.path}
        aria-label={entry.path}
      >
        <div
          className="dsh-md-preview-treerow"
          onClick={canPreview
            ? () => { setFocusPath(entry.path); onOpenFile(entry.path) }
            : () => { setFocusPath(entry.path) }}
        >
          {entry.type === 'directory' ? (
            <button
              type="button"
              className="dsh-md-preview-treeexpander"
              data-expander={entry.path}
              aria-hidden
              tabIndex={-1}
              onClick={event => { event.stopPropagation(); toggle(entry.path) }}
            >
              <IconChevronRightOutline14 />
            </button>
          ) : (
            <span className="dsh-md-preview-treespacer" aria-hidden />
          )}
          <EntryIcon type={entry.type} name={entry.name} expanded={state !== undefined} />
          <span className="dsh-md-preview-treename">{entry.name}</span>
        </div>
        {entry.type === 'directory' && state !== undefined && (
          <ul role="group" className="dsh-md-preview-treegroup">
            {state.state === 'loading' && <li className="dsh-md-preview-treehint" role="presentation">{t('browse.loading')}</li>}
            {state.state === 'failed' && (
              <li className="dsh-md-preview-treehint" role="presentation">
                {t('browse.error')}
                <button type="button" className="dsh-md-preview-treeretry" onClick={() => { load(entry.path) }}>
                  {t('browse.retry')}
                </button>
              </li>
            )}
            {state.state === 'ready' && state.entries.length === 0 && (
              <li className="dsh-md-preview-treehint" role="presentation">{t('browse.empty')}</li>
            )}
            {state.state === 'ready' && state.entries.length > 0 && renderEntries(state.entries, level + 1)}
          </ul>
        )}
      </li>
    )
  })
  }

  const root = dirs.get('')
  // The quick entries' row shape (#31): a recognizable few, name plus
  // necessary path, opening through the same guarded handoff as the tree.
  const renderQuickRow = (path: string): React.ReactNode => (
    <Tooltip key={path} label={path} side="bottom" delayMs={450} maxWidth={420}>
      <button
        type="button" className="dsh-md-preview-quickrow"
        aria-label={path} title={path}
        aria-current={workspaceDisplayPath(path, workspaceRoot) === currentPath ? 'page' : undefined}
        onClick={() => { onOpenFile(path) }}
      >
        <EntryIcon type="file" name={basename(path)} />
        <span className="dsh-md-preview-entrytext">
          <span className="dsh-md-preview-quickname">{basename(path)}</span>
          <span className="dsh-md-preview-quickpath">{documentParent(workspaceDisplayPath(path, workspaceRoot))}</span>
        </span>
      </button>
    </Tooltip>
  )
  const quickTurn = turnOutputs ?? []
  const quickRecent = (recentReads ?? []).slice(0, QUICK_RECENT_MAX)
  return (
    <>
      <div className="dsh-md-preview-toolbar">
        {/* The workspace search box (#30): unlike the editor's in-document
         * find, this searches document names across the whole session
         * workspace — unexpanded directories included. */}
        <span className="dsh-md-preview-searchfield">
          <IconSearchOutline16 className="dsh-md-preview-searchglyph" />
          <input
            type="text"
            className="dsh-md-preview-searchinput"
            placeholder={t('browse.search')}
            aria-label={t('search.label')}
            title={t('search.label')}
            value={query}
            onChange={event => { onQueryInput(event.target.value) }}
          />
          {query.length > 0 && (
            <button
              type="button"
              className="dsh-md-preview-searchclear"
              aria-label={t('search.clear')}
              title={t('search.clear')}
              onClick={() => { onQueryInput('') }}
            >
              <IconCloseOutline16 />
            </button>
          )}
        </span>
        <button
          type="button"
          className="dsh-md-preview-refresh"
          aria-label={t('browse.refresh')}
          title={t('browse.refresh')}
          onClick={refreshAll}
        >
          <IconRefreshOutline16 />
        </button>
      </div>
      <div className="dsh-md-preview-browsescroll">
        {quickTurn.length > 0 && (
          // The current turn's produced documents (#31): owning-service facts
          // of the newest turn only — never another turn's outputs dressed up
          // as current. Empty means the section simply does not show.
          <div className="dsh-md-preview-quick" hidden={normalizedQuery.length > 0} data-source="turn">
            <span className="dsh-md-preview-quicklabel">{t('quick.turn')}</span>
            {quickTurn.slice(0, QUICK_TURN_MAX).map(path => renderQuickRow(path))}
          </div>
        )}
        {quickRecent.length > 0 && (
          // Recently read of this session (#31): the reading record's recency
          // list — the continue-reading entry keeps its own explicit seat and
          // meaning, so the newest document may legitimately appear here too.
          <div className="dsh-md-preview-quick" hidden={normalizedQuery.length > 0} data-source="recent">
            <span className="dsh-md-preview-quicklabel">{t('quick.recent')}</span>
            {quickRecent.map(entry => renderQuickRow(entry.path))}
          </div>
        )}
        {continueTarget != null && (
          // The continue-reading entry (#28): the browse area's opening seat,
          // naming the session's last-read document. It carries no body of
          // its own — a click opens the recorded target through the panel's
          // unified leave entry, guard and position restore included.
          <button
            type="button"
            className="dsh-md-preview-continue" hidden={normalizedQuery.length > 0}
            title={`${t('continue.read')} · ${continueTarget.path}`}
            aria-label={`${t('continue.read')} ${continueTarget.path}`}
            onClick={() => { onContinue?.() }}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
              <path d="M11 2.5H5a1.5 1.5 0 0 0-1.5 1.5v9.4a.6.6 0 0 0 .93.5L8 11.6l3.57 2.3a.6.6 0 0 0 .93-.5V4A1.5 1.5 0 0 0 11 2.5z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            <span>{t('continue.read')}</span>
            <span className="dsh-md-preview-continuename">{basename(continueTarget.path)}</span>
          </button>
        )}
        {normalizedQuery.length > 0 && (
          // The search results list (#30): replaces the tree while a query is
          // live. Every result names its document and its workspace-relative
          // path — same-name documents stay distinguishable — and opening one
          // rides the same guarded open path as a tree row.
          <ul
            className="dsh-md-preview-searchresults"
            role="listbox"
            aria-label={t('search.results')}
            onKeyDown={onResultsKeyDown}
          >
            {searchState.state === 'searching' && (
              <li className="dsh-md-preview-treehint" role="presentation">{t('search.searching')}</li>
            )}
            {searchState.state === 'failed' && (
              <li className="dsh-md-preview-treehint" role="presentation">
                {t('search.failed')} · {searchState.code}
                <button
                  type="button"
                  className="dsh-md-preview-treeretry"
                  onClick={() => { runSearch(searchState.query) }}
                >
                  {t('search.retry')}
                </button>
              </li>
            )}
            {searchState.state === 'done' && searchState.result.complete && searchState.result.matches.length === 0 && (
              // Only a complete search may claim no results (#30).
              <li className="dsh-md-preview-treehint" role="presentation">{t('search.none')}</li>
            )}
            {searchState.state === 'done' && searchState.result.matches.map((match, index) => (
              <li key={match.path} role="presentation">
                <Tooltip label={match.path} side="bottom" delayMs={450} maxWidth={420}>
                  <div
                    role="option"
                    aria-selected={resultFocus === match.path ? 'true' : undefined}
                    data-path={match.path}
                    tabIndex={(resultFocus === null ? index === 0 : resultFocus === match.path) ? 0 : -1}
                    className="dsh-md-preview-searchitem"
                    title={match.path}
                    aria-label={match.path}
                    aria-current={match.path === currentPath ? 'page' : undefined}
                    onFocus={() => { setResultFocus(match.path) }}
                    onClick={() => { onOpenFile(match.path) }}
                  >
                    <span className="dsh-md-preview-searchrow">
                      <EntryIcon type="file" name={match.name} />
                      <span className="dsh-md-preview-entrytext">
                        <span className="dsh-md-preview-treename">{highlightName(match.name, normalizedQuery)}</span>
                        <span className="dsh-md-preview-searchpath">{documentParent(match.path)}</span>
                      </span>
                    </span>
                  </div>
                </Tooltip>
              </li>
            ))}
            {searchState.state === 'done' && !searchState.result.complete && (
              // An incomplete answer states why and keeps what it found (#30):
              // a permission failure, a traversal bound, or the result cap.
              <li className="dsh-md-preview-treehint" role="presentation">
                {t('search.incomplete')}
                {searchState.result.limits.map(limit => (
                  <span key={limit} className="dsh-md-preview-searchlimit">{t(`search.limit.${limit}`)}</span>
                ))}
              </li>
            )}
          </ul>
        )}
        <ul
          ref={treeRef}
          role="tree"
          className="dsh-md-preview-tree"
          aria-label={t('browse.open')}
          // The tree hides (never unmounts) while results show, so clearing
          // the query restores the exact browsing expansion state (#30).
          hidden={normalizedQuery.length > 0}
          onKeyDown={onKeyDown}
        >
          {root?.state === 'loading' && <li className="dsh-md-preview-treehint" role="presentation">{t('browse.loading')}</li>}
          {root?.state === 'failed' && (
            <li className="dsh-md-preview-treehint" role="presentation">
              {t('browse.error')}
              <button type="button" className="dsh-md-preview-treeretry" onClick={() => { load('') }}>
                {t('browse.retry')}
              </button>
            </li>
          )}
          {root?.state === 'ready' && root.entries.length === 0 && (
            <li className="dsh-md-preview-treehint" role="presentation">{t('browse.empty')}</li>
          )}
          {root?.state === 'ready' && root.entries.length > 0 && renderEntries(root.entries, 1)}
        </ul>
      </div>
    </>
  )
}
