// @vitest-environment jsdom
/**
 * Space arranged by intent (#27): without a saved preference, opening a
 * specific document gives the body priority (the rail stays out of the
 * way) while an explicit workspace-browse entry expands the navigation;
 * a manual choice — this session's or the remembered one — always outranks
 * the automatic arrangement, and intent switches never bypass the unsaved
 * guard. Asserted through the rendered arrangement (rail visibility,
 * document stage, guard bar), not internals.
 */

import { useSyncExternalStore } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { EditorView } from '@codemirror/view'
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import { PreviewOverlay } from '../src/client/PreviewOverlay.tsx'
import { createPreviewStore } from '../src/client/preview-state.ts'
import { createLeaveIntentSeat } from '../src/client/leave-intent.ts'
import { createMemoryStorage, createPanelPreferenceStore } from '../src/client/preferences.ts'
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

interface ArrangeHarness {
  container: HTMLElement
  store: ReturnType<typeof createPreviewStore>
  leave: ReturnType<typeof createLeaveIntentSeat>
  storage: ReturnType<typeof createMemoryStorage>
  rerender: () => Promise<void>
}

async function renderArrange(storage = createMemoryStorage()): Promise<ArrangeHarness> {
  const store = createPreviewStore()
  const leave = createLeaveIntentSeat()
  const preferences = createPanelPreferenceStore(storage)
  const readResult: MdPreviewFile = { path: 'doc.md', content: '# Report\n\n## Target\n\nbody text', kind: 'markdown', editable: true, fingerprint: 'v1' }
  const harness: ArrangeHarness = {
    container: document.createElement('div'),
    store,
    leave,
    storage,
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
      setTarget={((target: unknown) => { store.set(target as never) }) as never}
      preferences={preferences}
      t={t as never}
    />
  )
  document.body.appendChild(harness.container)
  const root: Root = createRoot(harness.container)
  return harness
}

const openTarget = async (harness: ArrangeHarness, target: { sessionId: string; path: string; face?: 'browse' }): Promise<void> => {
  await act(async () => { harness.store.set(target) })
  await harness.rerender()
  await flush()
}

const railTabs = (harness: ArrangeHarness): HTMLElement | null =>
  harness.container.querySelector('.dsh-md-preview-railtabs')

const tree = (harness: ArrangeHarness): HTMLElement | null =>
  harness.container.querySelector('[role="tree"]')

const documentStage = (harness: ArrangeHarness): HTMLElement =>
  harness.container.querySelector('.dsh-md-preview-document') as HTMLElement

const workspaceButton = (harness: ArrangeHarness): HTMLButtonElement =>
  harness.container.querySelector('button[aria-label="browse.open"]') as HTMLButtonElement

afterEach(() => { document.body.replaceChildren() })

describe('intent-based space arrangement (#27)', () => {
  it('gives the body priority when a document entry opens with no saved choice', async () => {
    const harness = await renderArrange()
    await openTarget(harness, { sessionId: 's1', path: 'doc.md' })
    // The document owns the panel: no rail tabs, no tree beside it, and the
    // rendered body on stage.
    expect(railTabs(harness)).toBeNull()
    expect(tree(harness)).toBeNull()
    expect(documentStage(harness).hidden).toBe(false)
    expect(documentStage(harness).textContent).toContain('body text')
    // Navigation stays one click away: the workspace button expands the rail.
    await act(async () => { workspaceButton(harness).click() })
    await flush()
    expect(railTabs(harness)).toBeTruthy()
    expect(tree(harness)).toBeTruthy()
    expect(documentStage(harness).hidden).toBe(false)
  })

  it('expands the navigation when the workspace-browse entry opens', async () => {
    const harness = await renderArrange()
    await openTarget(harness, { sessionId: 's1', path: '', face: 'browse' })
    // The browse intent shows the navigation with space: the rail docks and
    // the tree is usable beside the (empty) document stage.
    expect(railTabs(harness)).toBeTruthy()
    expect(tree(harness)).toBeTruthy()
    expect(documentStage(harness).hidden).toBe(false)
    expect(documentStage(harness).textContent).toContain('panel.pickFile')
  })

  it('respects a remembered collapse choice over the automatic arrangement', async () => {
    const storage = createMemoryStorage()
    createPanelPreferenceStore(storage).recordGeometry({ railCollapsed: true })
    const harness = await renderArrange(storage)
    // A document entry: the remembered collapse stands (body-first anyway).
    await openTarget(harness, { sessionId: 's1', path: 'doc.md' })
    expect(railTabs(harness)).toBeNull()
    // A browse entry may not silently expand past the remembered choice:
    // the tree answers through the browse face instead.
    await openTarget(harness, { sessionId: 's1', path: '', face: 'browse' })
    expect(railTabs(harness)).toBeNull()
    expect(tree(harness)).toBeTruthy()
    expect(documentStage(harness).hidden).toBe(true)
  })

  it('keeps a manual in-session expansion across document switches', async () => {
    const harness = await renderArrange()
    await openTarget(harness, { sessionId: 's1', path: 'doc.md' })
    expect(railTabs(harness)).toBeNull()
    await act(async () => { workspaceButton(harness).click() })
    await flush()
    expect(railTabs(harness)).toBeTruthy()
    // Switching documents (the chip entry shape) never re-collapses.
    await openTarget(harness, { sessionId: 's1', path: 'other.md' })
    expect(railTabs(harness)).toBeTruthy()
    expect(documentStage(harness).hidden).toBe(false)
  })

  it('carries a manual expansion into the next visit through the record', async () => {
    const storage = createMemoryStorage()
    const harness = await renderArrange(storage)
    await openTarget(harness, { sessionId: 's1', path: 'doc.md' })
    await act(async () => { workspaceButton(harness).click() })
    await flush()
    expect(railTabs(harness)).toBeTruthy()
    // A fresh mount on the same storage: the document entry now restores
    // the remembered expansion, not the body-first default.
    const revisit = await renderArrange(storage)
    await openTarget(revisit, { sessionId: 's1', path: 'doc.md' })
    expect(railTabs(revisit)).toBeTruthy()
  })

  it('holds the unsaved guard while an intent switch is pending', async () => {
    const harness = await renderArrange()
    await openTarget(harness, { sessionId: 's1', path: 'doc.md' })
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.edit"]') as HTMLButtonElement).click()
    })
    await flush()
    const host = harness.container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(host)!
    await act(async () => { view.dispatch({ changes: { from: 0, insert: 'x' } }) })
    await flush()
    // The capsule's browse intent arrives through the leave seat: the dirty
    // draft is asked about, the target unchanged while it waits.
    await act(async () => { harness.leave.request({ kind: 'open', target: { sessionId: 's1', path: '', face: 'browse' } }) })
    await flush()
    expect(harness.container.textContent).toContain('panel.unsaved.title')
    expect(harness.store.getSnapshot()).toEqual({ sessionId: 's1', path: 'doc.md' })
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.unsaved.discard"]') as HTMLButtonElement).click()
    })
    await flush()
    expect(harness.store.getSnapshot()).toEqual({ sessionId: 's1', path: '', face: 'browse' })
    expect(tree(harness)).toBeTruthy()
  })
})
