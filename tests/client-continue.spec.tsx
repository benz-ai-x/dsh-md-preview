// @vitest-environment jsdom
/**
 * The continue-reading entry (#28): the browse area offers the session's
 * last-read document by name and path, opens it through the same unified
 * leave entry (guard included) with #25's position restore, stays
 * session-scoped, hides when no record exists, and never lives in the
 * header. A dead target states the failure with the way back to browsing.
 */

import { useSyncExternalStore } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { EditorView } from '@codemirror/view'
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import { PreviewOverlay } from '../src/client/PreviewOverlay.tsx'
import { createPreviewStore } from '../src/client/preview-state.ts'
import { createLeaveIntentSeat } from '../src/client/leave-intent.ts'
import { createMemoryStorage, createReadingStore } from '../src/client/reading.ts'
import type { ReadingStore } from '../src/client/reading.ts'
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

interface ContinueHarness {
  container: HTMLElement
  store: ReturnType<typeof createPreviewStore>
  leave: ReturnType<typeof createLeaveIntentSeat>
  reading: ReadingStore
  reads: string[]
  readBodies: Map<string, string>
  failures: Set<string>
  rerender: () => Promise<void>
}

async function renderContinue(): Promise<ContinueHarness> {
  const store = createPreviewStore()
  const leave = createLeaveIntentSeat()
  const reading = createReadingStore(createMemoryStorage())
  const reads: string[] = []
  const readBodies = new Map([['report.md', '# Report\n\n## Target\n\nbody text']])
  const failures = new Set<string>()
  const harness: ContinueHarness = {
    container: document.createElement('div'),
    store,
    leave,
    reading,
    reads,
    readBodies,
    failures,
    rerender: () => act(async () => { root.render(panelElement()) }),
  }
  const usePreviewTarget = (selector: (state: unknown) => unknown) =>
    selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  const panelElement = () => (
    <PreviewOverlay
      usePreviewTarget={usePreviewTarget as never}
      leave={leave}
      close={() => { store.set(null) }}
      read={((_sessionId: unknown, path: unknown) => {
        const file = String(path)
        reads.push(file)
        if (failures.has(file)) {
          return Promise.resolve({ ok: false as const, error: { code: 'md-preview/not-found', message: 'gone' } }) as never
        }
        const body = readBodies.get(file) ?? `# ${file}`
        return Promise.resolve({ ok: true as const, value: { path: file, content: body, kind: 'markdown', editable: true, fingerprint: 'v1' } satisfies MdPreviewFile }) as never
      }) as never}
      write={vi.fn(() => Promise.resolve({ ok: true as const, value: { path: 'x', fingerprint: 'v2' } })) as never}
      list={vi.fn(() => Promise.resolve({ ok: true as const, value: { path: '', entries: [] } })) as never}
      setTarget={((target: unknown) => { store.set(target as never) }) as never}
      reading={reading}
      t={t as never}
    />
  )
  document.body.appendChild(harness.container)
  const root: Root = createRoot(harness.container)
  return harness
}

const openBrowse = async (harness: ContinueHarness, sessionId = 'session-1'): Promise<void> => {
  await act(async () => { harness.store.set({ sessionId, path: '', face: 'browse' }) })
  await harness.rerender()
  await flush()
}

const continueButton = (harness: ContinueHarness): HTMLButtonElement | null =>
  harness.container.querySelector('.dsh-md-preview-browser .dsh-md-preview-continue') as HTMLButtonElement | null

const documentStage = (harness: ContinueHarness): HTMLElement =>
  harness.container.querySelector('.dsh-md-preview-document') as HTMLElement

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('the continue-reading entry (#28)', () => {
  it('stays absent without a record and appears with a recognizable name', async () => {
    const harness = await renderContinue()
    await openBrowse(harness)
    expect(continueButton(harness)).toBeNull()
    // A record for THIS session: the entry names the document.
    harness.reading.record('session-1', 'notes/final-report.md', {
      at: 2000, anchor: null, index: -1, offsetIntoSection: 0, fraction: 0.5,
    })
    await harness.rerender()
    await flush()
    const button = continueButton(harness)
    expect(button).toBeTruthy()
    expect(button.getAttribute('title')).toContain('notes/final-report.md')
    expect(button.textContent).toContain('continue.read')
    expect(button.textContent).toContain('final-report.md')
    // It lives in the browse area, not the header's action row.
    const header = harness.container.querySelector('.dsh-md-preview-header') as HTMLElement
    expect(header.querySelector('.dsh-md-preview-continue')).toBeNull()
  })

  it('opens the recorded document through the unified entry and restores the position', async () => {
    const harness = await renderContinue()
    // A recorded stop half-way through the report.
    harness.reading.record('session-1', 'report.md', {
      at: 2000, anchor: null, index: -1, offsetIntoSection: 0, fraction: 0.5,
    })
    await openBrowse(harness)
    // Model the document's scrollable geometry before the open, so the
    // restore's frame sees it.
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('dsh-md-preview-document') ? 2000 : 0
    })
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('dsh-md-preview-document') ? 500 : 0
    })
    await act(async () => { continueButton(harness)!.click() })
    await flush()
    // The target became the recorded document and its body was read fresh.
    expect(harness.store.getSnapshot()).toEqual({ sessionId: 'session-1', path: 'report.md' })
    expect(harness.reads).toContain('report.md')
    expect(documentStage(harness).hidden).toBe(false)
    expect(documentStage(harness).textContent).toContain('body text')
    // #25's restore applied: half the scrollable range.
    await act(async () => { await new Promise(resolve => { setTimeout(resolve, 120) }) })
    expect(documentStage(harness).scrollTop).toBe(750)
  })

  it('keeps one target per session', async () => {
    const harness = await renderContinue()
    harness.reading.record('session-2', 'other.md', {
      at: 3000, anchor: null, index: -1, offsetIntoSection: 0, fraction: 0.5,
    })
    await openBrowse(harness, 'session-1')
    expect(continueButton(harness)).toBeNull()
    await openBrowse(harness, 'session-2')
    expect(continueButton(harness)?.textContent).toContain('other.md')
  })

  it('never bypasses the unsaved guard', async () => {
    const harness = await renderContinue()
    await act(async () => { harness.store.set({ sessionId: 'session-1', path: 'report.md' }) })
    await harness.rerender()
    await flush()
    // Make the draft dirty, then expand the rail where the entry lives.
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.edit"]') as HTMLButtonElement).click()
    })
    await flush()
    const host = harness.container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(host)!
    await act(async () => { view.dispatch({ changes: { from: 0, insert: 'x' } }) })
    await flush()
    harness.reading.record('session-1', 'other.md', {
      at: Date.now() + 1, anchor: null, index: -1, offsetIntoSection: 0, fraction: 0.5,
    })
    await act(async () => {
      (harness.container.querySelector('button[aria-label="browse.open"]') as HTMLButtonElement).click()
    })
    await flush()
    await act(async () => { continueButton(harness)!.click() })
    await flush()
    // The guard holds; the target did not change behind it.
    expect(harness.container.textContent).toContain('panel.unsaved.title')
    expect(harness.store.getSnapshot()).toEqual({ sessionId: 'session-1', path: 'report.md' })
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.unsaved.discard"]') as HTMLButtonElement).click()
    })
    await flush()
    expect(harness.store.getSnapshot()).toEqual({ sessionId: 'session-1', path: 'other.md' })
  })

  it('states the failure and the way back when the target is unreadable', async () => {
    const harness = await renderContinue()
    harness.reading.record('session-1', 'moved.md', {
      at: 2000, anchor: null, index: -1, offsetIntoSection: 0, fraction: 0.5,
    })
    harness.failures.add('moved.md')
    await openBrowse(harness)
    await act(async () => { continueButton(harness)!.click() })
    await flush()
    const body = documentStage(harness)
    expect(body.textContent).toContain('panel.error')
    expect(body.textContent).toContain('md-preview/not-found')
    expect(body.querySelector('button[aria-label="panel.failBrowse"]')).toBeTruthy()
  })
})
