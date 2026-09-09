// @vitest-environment jsdom
/**
 * The workspace search face (#30): the browser area's one input is a
 * workspace-wide document search — host-traversed, covering unexpanded
 * directories — replacing the loaded-node tree filter. Searching swaps the
 * tree for a results list; clearing restores the tree with its expansion
 * state; every state (searching, complete-empty, incomplete, failed) is
 * distinguishable; late answers never win; opening a result rides the same
 * leave-guarded open path as every other entry.
 */

import { useSyncExternalStore } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import { PreviewOverlay } from '../src/client/PreviewOverlay.tsx'
import { SEARCH_DEBOUNCE_MS } from '../src/client/WorkspaceBrowser.tsx'
import { createPreviewStore } from '../src/client/preview-state.ts'
import { createLeaveIntentSeat } from '../src/client/leave-intent.ts'
import type { MdPreviewEntry, MdPreviewFile, MdPreviewListResult, MdPreviewSearchResult } from '../src/protocol.ts'

const t = (key: string) => key

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  // A wide viewport keeps the header out of its compact fold, so the editor
  // find tool renders inline where this spec asserts its label.
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
})

/** A search answer script entry: resolve control per query. */
interface SearchScript {
  result?: MdPreviewSearchResult
  fail?: { code: string; message: string }
  /** Deferred: the test resolves it manually to test late arrivals. */
  defer?: boolean
}

interface SearchHarness {
  container: HTMLElement
  search: ReturnType<typeof vi.fn>
  searches: Array<{ sessionId: string; query: string; signal: AbortSignal }>
  list: ReturnType<typeof vi.fn>
  reads: Array<{ path: string }>
  setTarget: (target: { sessionId: string; path: string } | null) => void
  scripts: Map<string, SearchScript>
  /** Pending deferred searches by query; each resolves one RPC. */
  deferred: Map<string, Array<(value: { ok: true; value: MdPreviewSearchResult } | { ok: false; error: { code: string; message: string } }) => void>>
  rerender: () => Promise<void>
  unmount(): Promise<void>
}

const TREE: MdPreviewEntry[] = [
  { name: 'docs', type: 'directory', path: 'docs' },
  { name: 'README.md', type: 'file', path: 'README.md' },
]
const DOCS: MdPreviewEntry[] = [{ name: 'guide.md', type: 'file', path: 'docs/guide.md' }]

async function renderSearch(): Promise<SearchHarness> {
  const store = createPreviewStore()
  const leave = createLeaveIntentSeat()
  vi.useFakeTimers()
  const harness: SearchHarness = {
    container: document.createElement('div'),
    search: vi.fn(),
    searches: [],
    list: vi.fn((sessionId: string, path: string) => Promise.resolve({
      ok: true as const,
      value: { path, entries: path === '' ? TREE : DOCS } satisfies MdPreviewListResult,
    })),
    reads: [],
    setTarget: target => { store.set(target as never) },
    scripts: new Map(),
    deferred: new Map(),
    rerender: async () => {},
    unmount: async () => {},
  }
  harness.search = vi.fn((sessionId: string, query: string, signal: AbortSignal) => {
    harness.searches.push({ sessionId, query, signal })
    const script = harness.scripts.get(query) ?? {}
    if (script.defer) {
      return new Promise(resolve => {
        const list = harness.deferred.get(query) ?? []
        list.push(resolve as never)
        harness.deferred.set(query, list)
      })
    }
    if (script.fail) return Promise.resolve({ ok: false as const, error: script.fail })
    return Promise.resolve({ ok: true as const, value: script.result ?? { query, matches: [], complete: true, limits: [] } })
  })
  const usePreviewTarget = (selector: (state: unknown) => unknown) =>
    selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  const root: Root = createRoot(harness.container)
  const panelElement = () => (
    <PreviewOverlay
      usePreviewTarget={usePreviewTarget as never}
      leave={leave}
      close={() => { store.set(null) }}
      read={((sessionId: string, path: string) => {
        harness.reads.push({ path })
        return Promise.resolve({ ok: true as const, value: { path, content: `# ${path}`, kind: 'markdown', editable: true, fingerprint: 'v1' } satisfies MdPreviewFile })
      }) as never}
      write={vi.fn(() => Promise.resolve({ ok: true, value: { path: 'x', fingerprint: 'v2' } })) as never}
      list={harness.list as never}
      search={harness.search as never}
      setTarget={harness.setTarget as never}
      t={t as never}
    />
  )
  harness.rerender = async () => { await act(async () => { root.render(panelElement()) }) }
  harness.unmount = async () => {
    await act(async () => { root.unmount() })
    vi.useRealTimers()
  }
  document.body.appendChild(harness.container)
  harness.setTarget({ sessionId: 'session-1', path: 'README.md' })
  await harness.rerender()
  await act(async () => { await Promise.resolve() })
  return harness
}

afterEach(() => { vi.useRealTimers(); document.body.replaceChildren() })

const enterBrowse = async (harness: SearchHarness): Promise<void> => {
  const button = [...harness.container.querySelectorAll('button')]
    .find(node => node.getAttribute('aria-label') === 'browse.open')!
  await act(async () => { button.click() })
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
  expect(harness.container.querySelector('[role="tree"]')).toBeTruthy()
}

const typeQuery = async (harness: SearchHarness, value: string): Promise<void> => {
  const input = harness.container.querySelector('.dsh-md-preview-searchinput') as HTMLInputElement
  expect(input, 'search input').toBeTruthy()
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => { await Promise.resolve() })
}

/** Advance past the debounce and let the search land. */
const settle = async (harness: SearchHarness): Promise<void> => {
  await act(async () => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS) })
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

const resultPaths = (harness: SearchHarness): string[] =>
  [...harness.container.querySelectorAll<HTMLElement>('[role="option"]')].map(li => li.dataset.path)

describe('workspace search face (#30)', () => {
  it('debounces the search RPC and swaps the tree for the results list', async () => {
    const harness = await renderSearch()
    try {
      await enterBrowse(harness)
      harness.scripts.set('guide', {
        result: {
          query: 'guide',
          matches: [
            { name: 'guide.md', path: 'docs/guide.md' },
            { name: 'guide.md', path: 'notes/guide.md' },
          ],
          complete: true,
          limits: [],
        },
      })
      await typeQuery(harness, 'guide')
      // Not fired yet: the debounce holds the RPC while typing.
      expect(harness.searches).toHaveLength(0)
      expect(harness.container.textContent).toContain('search.searching')
      await settle(harness)
      expect(harness.searches).toEqual([{ sessionId: 'session-1', query: 'guide', signal: expect.anything() }])
      // Same-name documents stay distinguishable: name and path both render.
      expect(resultPaths(harness)).toEqual(['docs/guide.md', 'notes/guide.md'])
      const rows = [...harness.container.querySelectorAll('.dsh-md-preview-searchrow')]
      expect(rows[0]?.textContent).toContain('guide.md')
      expect(rows[0]?.querySelector('.dsh-md-preview-searchpath')?.textContent).toBe('docs')
      expect(rows[1]?.querySelector('.dsh-md-preview-searchpath')?.textContent).toBe('notes')
      expect(harness.container.querySelector('[role="option"]')?.getAttribute('title')).toBe('docs/guide.md')
      // The hit itself is marked inside the name.
      expect(harness.container.querySelector('.dsh-md-preview-treename mark')?.textContent).toBe('guide')
      // The tree itself is hidden while results show, not unmounted.
      const tree = harness.container.querySelector('[role="tree"]') as HTMLElement
      expect(tree.hasAttribute('hidden')).toBe(true)
    } finally {
      await harness.unmount()
    }
  })

  it('clearing the query restores the tree with its expansion state', async () => {
    const harness = await renderSearch()
    try {
      await enterBrowse(harness)
      // Expand docs first: the expansion state must survive a search round-trip.
      const caret = harness.container.querySelector('[data-expander="docs"]')!
      await act(async () => { caret.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
      await act(async () => { await Promise.resolve(); await Promise.resolve() })
      harness.scripts.set('gu', { result: { query: 'gu', matches: [{ name: 'guide.md', path: 'docs/guide.md' }], complete: true, limits: [] } })
      await typeQuery(harness, 'gu')
      await settle(harness)
      expect(resultPaths(harness)).toEqual(['docs/guide.md'])
      await typeQuery(harness, '')
      await settle(harness)
      const tree = harness.container.querySelector('[role="tree"]') as HTMLElement
      expect(tree.hasAttribute('hidden')).toBe(false)
      expect(harness.container.querySelector('[data-expander="docs"]')?.closest('[aria-expanded="true"]')).toBeTruthy()
      expect(harness.container.textContent).toContain('guide.md')
      expect(harness.container.querySelector('[role="listbox"]')).toBe(null)
    } finally {
      await harness.unmount()
    }
  })

  it('distinguishes searching, complete-empty, incomplete, and failed states', async () => {
    const harness = await renderSearch()
    try {
      await enterBrowse(harness)
      // Complete and empty: the one honest "no results".
      await typeQuery(harness, 'zzz')
      await settle(harness)
      expect(harness.container.textContent).toContain('search.none')
      // Incomplete with zero matches never claims no results.
      harness.scripts.set('lim', { result: { query: 'lim', matches: [], complete: false, limits: ['directory-failure'] } })
      await typeQuery(harness, 'lim')
      await settle(harness)
      expect(harness.container.textContent).not.toContain('search.none')
      expect(harness.container.textContent).toContain('search.incomplete')
      expect(harness.container.textContent).toContain('search.limit.directory-failure')
      // Incomplete with matches: results plus the notice.
      harness.scripts.set('cut', { result: { query: 'cut', matches: [{ name: 'a.md', path: 'a.md' }], complete: false, limits: ['result-limit'] } })
      await typeQuery(harness, 'cut')
      await settle(harness)
      expect(resultPaths(harness)).toEqual(['a.md'])
      expect(harness.container.textContent).toContain('search.incomplete')
      expect(harness.container.textContent).toContain('search.limit.result-limit')
      // A failure names the failure and offers a retry.
      harness.scripts.set('bad', { fail: { code: 'md-preview/unavailable', message: 'boom' } })
      await typeQuery(harness, 'bad')
      await settle(harness)
      expect(harness.container.textContent).toContain('search.failed')
      expect(harness.container.textContent).toContain('md-preview/unavailable')
      harness.scripts.set('bad', { result: { query: 'bad', matches: [{ name: 'bad.md', path: 'bad.md' }], complete: true, limits: [] } })
      const retry = [...harness.container.querySelectorAll('button')].find(b => b.textContent === 'search.retry')!
      await act(async () => { retry.click() })
      await act(async () => { await Promise.resolve(); await Promise.resolve() })
      expect(resultPaths(harness)).toEqual(['bad.md'])
    } finally {
      await harness.unmount()
    }
  })

  it('drops late answers once a newer query owns the box', async () => {
    const harness = await renderSearch()
    try {
      await enterBrowse(harness)
      harness.scripts.set('gu', { defer: true })
      harness.scripts.set('gui', {
        result: { query: 'gui', matches: [{ name: 'guide.md', path: 'docs/guide.md' }], complete: true, limits: [] },
      })
      await typeQuery(harness, 'gu')
      await settle(harness)
      expect(harness.searches.map(s => s.query)).toEqual(['gu'])
      await typeQuery(harness, 'gui')
      await settle(harness)
      expect(harness.searches.map(s => s.query)).toEqual(['gu', 'gui'])
      expect(resultPaths(harness)).toEqual(['docs/guide.md'])
      // The stale 'gu' answer arrives now: it must not replace the newer list.
      const settleGu = harness.deferred.get('gu')?.[0]
      await act(async () => {
        settleGu?.({ ok: false, error: { code: 'md-preview/unavailable', message: 'stale' } })
      })
      await act(async () => { await Promise.resolve(); await Promise.resolve() })
      expect(resultPaths(harness)).toEqual(['docs/guide.md'])
      expect(harness.container.textContent).not.toContain('search.failed')
    } finally {
      await harness.unmount()
    }
  })

  it('opens a result through the guarded open path, by mouse and keyboard', async () => {
    const harness = await renderSearch()
    try {
      await enterBrowse(harness)
      harness.scripts.set('guide', {
        result: { query: 'guide', matches: [{ name: 'guide.md', path: 'docs/guide.md' }], complete: true, limits: [] },
      })
      await typeQuery(harness, 'guide')
      await settle(harness)
      const option = harness.container.querySelector<HTMLElement>('[role="option"][data-path="docs/guide.md"]')!
      await act(async () => { option.click() })
      await act(async () => { await Promise.resolve(); await Promise.resolve() })
      // A fresh read of the opened document: search results are not read grants.
      expect(harness.reads.at(-1)).toEqual({ path: 'docs/guide.md' })
      expect(harness.container.querySelector('.dsh-md-preview-crumb:last-child')?.textContent).toBe('guide.md')
      // Keyboard: the rail stayed open with the results list still live —
      // focus an option and press Enter.
      const option2 = harness.container.querySelector<HTMLElement>('[role="option"][data-path="docs/guide.md"]')!
      expect(option2).toBeTruthy()
      await act(async () => { option2.focus() })
      await act(async () => {
        option2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })
      await act(async () => { await Promise.resolve(); await Promise.resolve() })
      expect(harness.reads.at(-1)).toEqual({ path: 'docs/guide.md' })
    } finally {
      await harness.unmount()
    }
  })

  it('cancels the in-flight search when the query clears, the session switches, or the tree unmounts', async () => {
    const harness = await renderSearch()
    try {
      await enterBrowse(harness)
      harness.scripts.set('gu', { defer: true })
      await typeQuery(harness, 'gu')
      await settle(harness)
      const inflight = harness.searches[0]!
      // Clearing the query aborts the pending search.
      await typeQuery(harness, '')
      await act(async () => { await Promise.resolve() })
      expect(inflight.signal.aborted).toBe(true)
      // A new session resets the query entirely and aborts its own search.
      harness.scripts.set('gui', { defer: true })
      await typeQuery(harness, 'gui')
      await settle(harness)
      const second = harness.searches.at(-1)!
      harness.setTarget({ sessionId: 'session-2', path: 'fresh.md' })
      await act(async () => { await Promise.resolve(); await Promise.resolve() })
      expect(second.signal.aborted).toBe(true)
      const input = harness.container.querySelector('.dsh-md-preview-searchinput') as HTMLInputElement
      expect(input.value).toBe('')
      // Unmount (dispose) aborts whatever else is in flight.
      harness.scripts.set('f', { defer: true })
      await typeQuery(harness, 'f')
      await settle(harness)
      const third = harness.searches.at(-1)!
      await harness.unmount()
      expect(third.signal.aborted).toBe(true)
    } finally {
      await harness.unmount()
    }
  })

  it('names the workspace search apart from the editor find', async () => {
    const harness = await renderSearch()
    try {
      await enterBrowse(harness)
      const input = harness.container.querySelector('.dsh-md-preview-searchinput') as HTMLInputElement
      expect(input.getAttribute('aria-label')).toBe('search.label')
      expect(input.getAttribute('placeholder')).toBe('browse.search')
      // The editor's in-document find keeps its own, different label.
      const edit = [...harness.container.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'panel.edit')!
      await act(async () => { edit.click() })
      await act(async () => { await Promise.resolve(); await Promise.resolve() })
      const find = [...harness.container.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'panel.find')
      expect(find).toBeTruthy()
      expect(find!.getAttribute('aria-label')).not.toBe(input.getAttribute('aria-label'))
    } finally {
      await harness.unmount()
    }
  })
})
