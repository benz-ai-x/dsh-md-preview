/**
 * The browser face's workspace tree: a lazily expanded directory listing of
 * the session workspace. Expansion state (which directories are open, their
 * loading/empty/error states) is UI-local viewing state; a directory's
 * children are fetched when its caret opens it and discarded when it closes.
 * Single-clicking a file hands its path to the panel as a preview target.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { MdPreviewEntry, MdPreviewListResult } from '../protocol.ts'

/** Listing RPC and the file-open handoff, created in the plugin's apply world. */
export interface WorkspaceBrowserProps {
  /** Owning session whose workspace the tree roots at. */
  sessionId: SessionId
  /** One directory listing; the transport carries the AbortSignal. */
  list(
    sessionId: SessionId,
    path: string,
    signal: AbortSignal,
  ): Promise<RemoteResult<MdPreviewListResult>>
  /** Open one file as the panel's preview target. */
  onOpenFile(path: string): void
  /** Workspace-relative path of the current preview target, if any. */
  currentPath: string | null
  /** Locale seat. */
  t(key: string): string
}

/** Expansion state of one opened directory. */
type DirState =
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly entries: readonly MdPreviewEntry[] }
  | { readonly state: 'failed' }

const OTHER_TYPE = 'other'

/** One SVG glyph per entry kind (aria-hidden; the name is the accessible label). */
function EntryIcon({ type }: { type: MdPreviewEntry['type'] }) {
  if (type === 'directory') {
    return (
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden className="dsh-md-preview-tree-icon">
        <path d="M1.5 3h4l1.5 2h7.5v8h-13z" fill="currentColor" opacity="0.55" />
      </svg>
    )
  }
  if (type === OTHER_TYPE) {
    return (
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden className="dsh-md-preview-tree-icon">
        <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
        <circle cx="8" cy="8" r="1.6" fill="currentColor" opacity="0.55" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden className="dsh-md-preview-tree-icon">
      <path d="M4 1.5h5L12.5 5v9.5h-8.5z" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.55" />
    </svg>
  )
}

/**
 * Render the workspace tree for one session.
 * @param props - session identity, listing RPC, file-open handoff, locale seat.
 * @returns the tree element.
 */
export function WorkspaceBrowser({ sessionId, list, onOpenFile, currentPath, t }: WorkspaceBrowserProps) {
  // Keyed by workspace-relative directory path; presence means expanded.
  const [dirs, setDirs] = useState<ReadonlyMap<string, DirState>>(new Map([['', { state: 'loading' }]]))
  const controllers = useRef(new Map<string, AbortController>())
  const dirsRef = useRef<ReadonlyMap<string, DirState>>(new Map())
  dirsRef.current = dirs
  // Roving focus (one tab stop): the workspace-relative path of the focused node.
  const [focusPath, setFocusPath] = useState<string | null>(null)
  const treeRef = useRef<HTMLUListElement>(null)

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

  useEffect(() => {
    // The root load also owns the session boundary: a new owning session
    // (load's identity changes with it) starts a fresh tree — stale
    // expansion content from the previous session must not survive.
    for (const controller of controllers.current.values()) controller.abort()
    controllers.current.clear()
    setFocusPath(null)
    setDirs(new Map([['', { state: 'loading' }]]))
    load('')
    return () => {
      for (const controller of controllers.current.values()) controller.abort()
    }
  }, [load])

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
        else onOpenFile(path)
        break
      }
    }
  }, [onOpenFile, toggle])

  const renderEntries = (entries: readonly MdPreviewEntry[], level: number) => entries.map(entry => {
    const state = dirs.get(entry.path)
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
        data-current={isCurrent || undefined}
        className={entry.type === 'directory' ? 'dsh-md-preview-treeitem dsh-md-preview-treebranch' : 'dsh-md-preview-treeitem dsh-md-preview-treeleaf'}
        title={entry.path}
      >
        <div
          className="dsh-md-preview-treerow"
          onClick={entry.type === 'file'
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
              <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden>
                <path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            <span className="dsh-md-preview-treespacer" aria-hidden />
          )}
          <EntryIcon type={entry.type} />
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

  const root = dirs.get('')
  return (
    <ul
      ref={treeRef}
      role="tree"
      className="dsh-md-preview-tree"
      aria-label={t('browse.open')}
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
  )
}
