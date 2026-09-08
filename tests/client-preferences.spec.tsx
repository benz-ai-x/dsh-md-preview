// @vitest-environment jsdom
/**
 * The panel's remembered reading space (#26), through real drags and
 * clicks: a manually dragged width survives close/reopen and a fresh mount
 * on the same storage (the revisit), threshold crossings and maximize
 * round-trips never overwrite the manual width, the rail collapse and the
 * per-session files/outline choice restore, restored widths clamp to the
 * live viewport, and a hostile storage never blocks the default open.
 * Asserted externally: the overlay's applied width, the rail's aria state,
 * the tab selection — never write-count bookkeeping.
 */

import { useSyncExternalStore } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import { PreviewOverlay } from '../src/client/PreviewOverlay.tsx'
import { createPreviewStore } from '../src/client/preview-state.ts'
import { createLeaveIntentSeat } from '../src/client/leave-intent.ts'
import { createMemoryStorage, createPanelPreferenceStore } from '../src/client/preferences.ts'
import type { PanelPreferenceStore } from '../src/client/preferences.ts'
import type { MdPreviewFile } from '../src/protocol.ts'

const t = (key: string) => key

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
  ;(Range.prototype as unknown as { getClientRects?: () => [] }).getClientRects ??= () => []
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  Object.defineProperty(window, 'innerWidth', { value: 1928, configurable: true })
})

const flush = async (): Promise<void> => {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

interface PrefsHarness {
  container: HTMLElement
  store: ReturnType<typeof createPreviewStore>
  storage: ReturnType<typeof createMemoryStorage>
  prefs: PanelPreferenceStore
  rerender: () => Promise<void>
}

interface HarnessOptions {
  preferences?: PanelPreferenceStore
  viewport?: number
  sessionId?: string
}

async function renderPrefsPanel(options: HarnessOptions = {}): Promise<PrefsHarness> {
  if (options.viewport !== undefined) {
    Object.defineProperty(window, 'innerWidth', { value: options.viewport, configurable: true })
  }
  const store = createPreviewStore()
  const leave = createLeaveIntentSeat()
  const storage = createMemoryStorage()
  const prefs = options.preferences ?? createPanelPreferenceStore(storage)
  const sessionId = options.sessionId ?? 'session-1'
  const readResult: MdPreviewFile = { path: 'doc.md', content: '# Report\n\n## Target\n\nbody', fingerprint: 'v1' }
  const harness: PrefsHarness = {
    container: document.createElement('div'),
    store,
    storage,
    prefs,
    rerender: () => act(async () => { root.render(panelElement()) }),
  }
  const usePreviewTarget = (selector: (state: unknown) => unknown) =>
    selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  const panelElement = () => (
    <PreviewOverlay
      usePreviewTarget={usePreviewTarget as never}
      leave={leave}
      close={() => { store.set(null) }}
      read={vi.fn(() => Promise.resolve({ ok: true as const, value: readResult })) as never}
      write={vi.fn(() => Promise.resolve({ ok: true as const, value: { path: 'doc.md', fingerprint: 'v2' } })) as never}
      list={vi.fn(() => Promise.resolve({ ok: true as const, value: { path: '', entries: [] } })) as never}
      setTarget={vi.fn() as never}
      preferences={prefs}
      t={t as never}
    />
  )
  document.body.appendChild(harness.container)
  const root: Root = createRoot(harness.container)
  store.set({ sessionId, path: 'doc.md' })
  await harness.rerender()
  await flush()
  return harness
}

const overlayOf = (harness: PrefsHarness): HTMLElement =>
  harness.container.querySelector('.dsh-md-preview-overlay') as HTMLElement

const appliedWidth = (harness: PrefsHarness): string => overlayOf(harness).style.width

/** Drag the panel's left edge (right-anchored: moving right narrows). */
const dragEdge = async (harness: PrefsHarness, fromX: number, toX: number): Promise<void> => {
  const handle = harness.container.querySelector('.dsh-md-preview-edgehandle') as HTMLElement
  const down = new MouseEvent('pointerdown', { bubbles: true, clientX: fromX })
  Object.assign(down, { pointerId: 1 })
  await act(async () => { handle.dispatchEvent(down) })
  const move = new MouseEvent('pointermove', { bubbles: true, clientX: toX })
  Object.assign(move, { pointerId: 1 })
  await act(async () => {
    handle.dispatchEvent(move)
    await new Promise(resolve => { setTimeout(resolve, 40) })
  })
  const up = new MouseEvent('pointerup', { bubbles: true, clientX: toX })
  Object.assign(up, { pointerId: 1 })
  await act(async () => { handle.dispatchEvent(up) })
  await harness.rerender()
}

/** Drag the rail's handle rightward to widen it. */
const dragRail = async (harness: PrefsHarness, fromX: number, toX: number): Promise<void> => {
  const handle = harness.container.querySelector('.dsh-md-preview-railhandle') as HTMLElement
  const down = new MouseEvent('pointerdown', { bubbles: true, clientX: fromX })
  Object.assign(down, { pointerId: 2 })
  await act(async () => { handle.dispatchEvent(down) })
  const move = new MouseEvent('pointermove', { bubbles: true, clientX: toX })
  Object.assign(move, { pointerId: 2 })
  await act(async () => {
    handle.dispatchEvent(move)
    await new Promise(resolve => { setTimeout(resolve, 40) })
  })
  const up = new MouseEvent('pointerup', { bubbles: true, clientX: toX })
  Object.assign(up, { pointerId: 2 })
  await act(async () => { handle.dispatchEvent(up) })
  await harness.rerender()
}

const closePanel = async (harness: PrefsHarness): Promise<void> => {
  await act(async () => {
    (harness.container.querySelector('button[aria-label="panel.close"]') as HTMLButtonElement).click()
  })
  await flush()
}

const reopen = async (harness: PrefsHarness, sessionId = 'session-1'): Promise<void> => {
  await act(async () => { harness.store.set({ sessionId, path: 'doc.md' }) })
  await flush()
}

afterEach(() => {
  document.body.replaceChildren()
  Object.defineProperty(window, 'innerWidth', { value: 1928, configurable: true })
})

describe('the remembered panel width (#26)', () => {
  it('restores a manually dragged width after close/reopen and on a fresh mount', async () => {
    const harness = await renderPrefsPanel()
    expect(appliedWidth(harness)).toBe('720px')
    // Drag 720 → 505 (a manual choice below the 640 rail threshold).
    await dragEdge(harness, 1000, 1215)
    expect(appliedWidth(harness)).toBe('505px')
    await closePanel(harness)
    await reopen(harness)
    // Same app session: the panel kept its width…
    expect(appliedWidth(harness)).toBe('505px')
    // …and a fresh mount on the same storage (the revisit) restores it too.
    const revisit = await renderPrefsPanel({ preferences: createPanelPreferenceStore(harness.storage) })
    expect(appliedWidth(revisit)).toBe('505px')
  })

  it('does not overwrite the manual width when the maximize round-trip passes', async () => {
    const harness = await renderPrefsPanel()
    await dragEdge(harness, 1000, 1215)
    expect(appliedWidth(harness)).toBe('505px')
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.maximize"]') as HTMLButtonElement).click()
    })
    await flush()
    expect(overlayOf(harness).hasAttribute('data-maximized')).toBe(true)
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.restore"]') as HTMLButtonElement).click()
    })
    await flush()
    expect(appliedWidth(harness)).toBe('505px')
    const revisit = await renderPrefsPanel({ preferences: createPanelPreferenceStore(harness.storage) })
    expect(appliedWidth(revisit)).toBe('505px')
  })

  it('opens the viewport-derived default when nothing was ever chosen', async () => {
    const harness = await renderPrefsPanel({ viewport: 1928 })
    expect(appliedWidth(harness)).toBe('720px')
    // An untouched open records nothing: a later smaller viewport still
    // derives from the viewport instead of replaying an unchosen 720.
    const revisit = await renderPrefsPanel({ viewport: 500, preferences: createPanelPreferenceStore(harness.storage) })
    expect(appliedWidth(revisit)).toBe('360px')
  })

  it('clamps a remembered width into a shrunken viewport', async () => {
    const storage = createMemoryStorage()
    createPanelPreferenceStore(storage).recordGeometry({ panelWidth: 1000 })
    const harness = await renderPrefsPanel({ viewport: 800, preferences: createPanelPreferenceStore(storage) })
    expect(appliedWidth(harness)).toBe('800px')
  })

  it('re-clamps the applied width when the viewport shrinks after open', async () => {
    const harness = await renderPrefsPanel({ viewport: 1200 })
    expect(appliedWidth(harness)).toBe('600px') // the half-viewport preset
    await dragEdge(harness, 1000, 700) // 600 → 900 manual choice
    expect(appliedWidth(harness)).toBe('900px')
    // The window shrinks below the remembered width: the applied width
    // follows the live viewport while the manual choice itself is kept.
    await act(async () => {
      Object.defineProperty(window, 'innerWidth', { value: 700, configurable: true })
      window.dispatchEvent(new Event('resize'))
    })
    await harness.rerender()
    expect(appliedWidth(harness)).toBe('700px')
    // Growing back restores the user's own width, not a re-derived default.
    await act(async () => {
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
      window.dispatchEvent(new Event('resize'))
    })
    await harness.rerender()
    expect(appliedWidth(harness)).toBe('900px')
    expect(harness.prefs.geometry().panelWidth).toBe(900)
  })

  it('opens on defaults when the storage face throws', async () => {
    const hostile: PanelPreferenceStore = {
      geometry: () => { throw new Error('SecurityError') },
      recordGeometry: () => { throw new Error('QuotaExceededError') },
      railTab: () => { throw new Error('SecurityError') },
      recordRailTab: () => { throw new Error('QuotaExceededError') },
    }
    const harness = await renderPrefsPanel({ preferences: hostile })
    expect(appliedWidth(harness)).toBe('720px')
    // A drag still lands on screen even though nothing persists.
    await dragEdge(harness, 1000, 1215)
    expect(appliedWidth(harness)).toBe('505px')
  })
})

describe('the remembered navigation state (#26)', () => {
  it('restores a dragged rail width', async () => {
    const harness = await renderPrefsPanel()
    // The document entry opens body-first (#27): expand the rail to drag it.
    await act(async () => {
      (harness.container.querySelector('button[aria-label="browse.open"]') as HTMLButtonElement).click()
    })
    await flush()
    await dragRail(harness, 100, 81)
    const browser = harness.container.querySelector('.dsh-md-preview-browser') as HTMLElement
    expect(browser.style.width).toBe('201px')
    await closePanel(harness)
    const revisit = await renderPrefsPanel({ preferences: createPanelPreferenceStore(harness.storage) })
    const revisitBrowser = revisit.container.querySelector('.dsh-md-preview-browser') as HTMLElement
    expect(revisitBrowser.style.width).toBe('201px')
  })

  it('restores a collapsed rail across a revisit', async () => {
    const harness = await renderPrefsPanel()
    // The document entry opens body-first (#27); the workspace action
    // expands, and folding it back is the manual collapse choice.
    await act(async () => {
      (harness.container.querySelector('button[aria-label="browse.open"]') as HTMLButtonElement).click()
    })
    await flush()
    expect(harness.container.querySelector('.dsh-md-preview-railtabs')).toBeTruthy()
    await act(async () => {
      (harness.container.querySelector('button[aria-label="browse.open"]') as HTMLButtonElement).click()
    })
    await flush()
    expect(harness.container.querySelector('.dsh-md-preview-railtabs')).toBeNull()
    await closePanel(harness)
    const revisit = await renderPrefsPanel({ preferences: createPanelPreferenceStore(harness.storage) })
    expect(revisit.container.querySelector('.dsh-md-preview-railtabs')).toBeNull()
    // The remembered collapse gives way to the user expanding it again.
    await act(async () => {
      (revisit.container.querySelector('button[aria-label="browse.open"]') as HTMLButtonElement).click()
    })
    await flush()
    expect(revisit.container.querySelector('.dsh-md-preview-railtabs')).toBeTruthy()
  })

  it('keeps the files/outline choice per session', async () => {
    const harness = await renderPrefsPanel({ sessionId: 'session-1' })
    await act(async () => {
      (harness.container.querySelector('button[aria-label="browse.open"]') as HTMLButtonElement).click()
    })
    await flush()
    await act(async () => {
      (harness.container.querySelector('.dsh-md-preview-railtabs button[aria-selected="false"]') as HTMLButtonElement).click()
    })
    await flush()
    const tabs = [...harness.container.querySelectorAll('.dsh-md-preview-railtabs button')]
    expect(tabs.find(tab => tab.getAttribute('aria-selected') === 'true')?.textContent).toBe('rail.outline')
    await closePanel(harness)
    // The same session restores the outline choice…
    const sameSession = await renderPrefsPanel({
      sessionId: 'session-1',
      preferences: createPanelPreferenceStore(harness.storage),
    })
    const sameTabs = [...sameSession.container.querySelectorAll('.dsh-md-preview-railtabs button')]
    expect(sameTabs.find(tab => tab.getAttribute('aria-selected') === 'true')?.textContent).toBe('rail.outline')
    // …a different session opens on files.
    const otherSession = await renderPrefsPanel({
      sessionId: 'session-2',
      preferences: createPanelPreferenceStore(harness.storage),
    })
    const otherTabs = [...otherSession.container.querySelectorAll('.dsh-md-preview-railtabs button')]
    expect(otherTabs.find(tab => tab.getAttribute('aria-selected') === 'true')?.textContent).toBe('rail.files')
  })
})
