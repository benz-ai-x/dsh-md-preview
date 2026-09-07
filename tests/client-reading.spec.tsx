// @vitest-environment jsdom
/**
 * Reading continuity in the real panel (#25): the reopen lands near the
 * recorded section after a fresh Remote read, one restore per open, user
 * navigation wins, late switches never scroll, and every degradation —
 * vanished sections, duplicate headings, storage failure, unreadable files —
 * stays readable. External results are asserted: rendered text and the
 * scroll position, never internal calls.
 */

import { useSyncExternalStore } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import { PreviewOverlay } from '../src/client/PreviewOverlay.tsx'
import { createPreviewStore } from '../src/client/preview-state.ts'
import { createLeaveIntentSeat } from '../src/client/leave-intent.ts'
import { createMemoryStorage, createReadingStore } from '../src/client/reading.ts'
import type { ReadingPosition, ReadingStore } from '../src/client/reading.ts'
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
  Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
})

/** Let the scheduled restore frame (jsdom rAF ≈ one timer tick) fire. */
const settleRestore = async (): Promise<void> => {
  await act(async () => { await new Promise(resolve => { setTimeout(resolve, 120) }) })
}

const flush = async (): Promise<void> => {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

interface Geometry {
  scroller: () => HTMLElement
  restore: () => void
}

/**
 * Model viewport geometry at the prototype level (fresh element resolution
 * per call, so a close/reopen remount keeps working): headings sit at fixed
 * document offsets, the document scroller reports the given heights, and
 * everything else reports a zero rect.
 */
function installGeometry(harness: ReadingHarness, total: number, viewport: number, docTops: readonly number[]): Geometry {
  const scroller = (): HTMLElement | null =>
    harness.container.querySelector('.dsh-md-preview-document')
  const rect = (top: number): DOMRect =>
    ({ top, right: 0, bottom: 0, left: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const container = scroller()
    if (container === null) return rect(0)
    const headings = [...container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')]
    const index = headings.indexOf(this)
    return rect(index >= 0 ? (docTops[index] ?? 0) - container.scrollTop : 0)
  })
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('dsh-md-preview-document') ? total : 0
  })
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('dsh-md-preview-document') ? viewport : 0
  })
  return { scroller: () => scroller()!, restore: () => vi.restoreAllMocks() }
}

interface ReadingHarness {
  container: HTMLElement
  store: ReturnType<typeof createPreviewStore>
  leave: ReturnType<typeof createLeaveIntentSeat>
  reading: ReadingStore
  storage: ReturnType<typeof createMemoryStorage>
  reads: string[]
  rerender: () => Promise<void>
}

interface HarnessOptions {
  /** Document bodies served per read call, in order (last one repeats). */
  contents?: string[]
  /** The read outcome; a failed read stands for a moved or deleted file. */
  failure?: { code: string; message: string }
  /** Runs against the store before the panel opens (preset records). */
  preset?: (store: ReadingStore) => void
  /** Replace the whole store face (broken-store benches). */
  readingStore?: ReadingStore
}

async function renderReadingPanel(options: HarnessOptions = {}): Promise<ReadingHarness> {
  const store = createPreviewStore()
  const leave = createLeaveIntentSeat()
  const storage = createMemoryStorage()
  const backing = createReadingStore(storage)
  options.preset?.(backing)
  const reading = options.readingStore ?? backing
  const contents = options.contents ?? ['# Report\n\n## Target\n\nbody text']
  let readCount = 0
  const reads: string[] = []
  const readResult = (): MdPreviewFile | { code: string; message: string } => {
    if (options.failure !== undefined) return options.failure
    const content = contents[Math.min(readCount, contents.length - 1)] ?? ''
    readCount += 1
    return { path: 'doc.md', content, fingerprint: `fp-${readCount}` }
  }
  const harness: ReadingHarness = {
    container: document.createElement('div'),
    store,
    leave,
    reading: options.readingStore ?? backing,
    storage,
    reads,
    rerender: () => act(async () => { root.render(panelElement()) }),
  }
  const usePreviewTarget = (selector: (state: unknown) => unknown) =>
    selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  const panelElement = () => (
    <PreviewOverlay
      usePreviewTarget={usePreviewTarget as never}
      leave={leave}
      close={() => { store.set(null) }}
      read={(() => {
        const result = readResult()
        reads.push(options.failure !== undefined ? `fail:${options.failure.code}` : 'ok')
        return ('content' in result
          ? Promise.resolve({ ok: true as const, value: result })
          : Promise.resolve({ ok: false as const, error: result })) as never
      }) as never}
      write={vi.fn(() => Promise.resolve({ ok: true as const, value: { path: 'doc.md', fingerprint: 'v2' } })) as never}
      list={vi.fn(() => Promise.resolve({ ok: true as const, value: { path: '', entries: [] } })) as never}
      setTarget={vi.fn() as never}
      reading={reading}
      t={t as never}
    />
  )
  document.body.appendChild(harness.container)
  const root: Root = createRoot(harness.container)
  store.set({ sessionId: 'session-1', path: 'doc.md' })
  await harness.rerender()
  await flush()
  return harness
}

const documentBody = (harness: ReadingHarness): HTMLElement =>
  harness.container.querySelector('.dsh-md-preview-document') as HTMLElement

const closePanel = async (harness: ReadingHarness): Promise<void> => {
  await act(async () => {
    (harness.container.querySelector('button[aria-label="panel.close"]') as HTMLButtonElement).click()
  })
  await flush()
}

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('reopen restores the reading position (#25)', () => {
  it('lands at the recorded section of the freshly read content', async () => {
    const harness = await renderReadingPanel({
      contents: [
        '# Report\n\n## Target\n\nold body before the external update',
        '# Report\n\n## Target\n\nfresh body after the external update',
      ],
    })
    const geometry = installGeometry(harness, 2400, 600, [0, 400])
    // Stop reading 30px inside the Target section of the old body.
    await act(async () => {
      geometry.scroller().scrollTop = 430
      geometry.scroller().dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await closePanel(harness)
    const stored = harness.reading.get('session-1', 'doc.md')
    expect(stored?.anchor).toEqual({ text: 'Target', ordinal: 0 })
    expect(harness.reads).toEqual(['ok'])
    // Reopen: a fresh Remote read happens, then the restore lands.
    await act(async () => { harness.store.set({ sessionId: 'session-1', path: 'doc.md' }) })
    await flush()
    expect(harness.reads).toEqual(['ok', 'ok'])
    expect(documentBody(harness).textContent).toContain('fresh body after the external update')
    await settleRestore()
    // The recorded section restored with its 30px offset — and the fresh
    // body, never a cached one, is what is on screen.
    expect(geometry.scroller().scrollTop).toBe(430)
  })

  it('applies the restore once and never pulls the user back', async () => {
    const harness = await renderReadingPanel({
      preset: store => store.record('session-1', 'doc.md', {
        at: 1000, anchor: null, index: -1, offsetIntoSection: 0, fraction: 0.5,
      } satisfies ReadingPosition),
    })
    const geometry = installGeometry(harness, 2000, 500, [0])
    await settleRestore()
    expect(geometry.scroller().scrollTop).toBe(750) // 0.5 × (2000 − 500)
    // The reader moves elsewhere; the old position must not return.
    await act(async () => {
      geometry.scroller().scrollTop = 100
      geometry.scroller().dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await settleRestore()
    expect(geometry.scroller().scrollTop).toBe(100)
  })

  it('cancels the pending restore when the reader scrolls first', async () => {
    const harness = await renderReadingPanel({
      preset: store => store.record('session-1', 'doc.md', {
        at: 1000, anchor: null, index: -1, offsetIntoSection: 0, fraction: 0.9,
      } satisfies ReadingPosition),
    })
    const geometry = installGeometry(harness, 2000, 500, [0])
    // The user grabs the scrollbar before the restore frame fires.
    await act(async () => {
      geometry.scroller().scrollTop = 60
      geometry.scroller().dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await settleRestore()
    expect(geometry.scroller().scrollTop).toBe(60)
  })

  it('cancels the pending restore when the reader navigates by outline first', async () => {
    const harness = await renderReadingPanel({
      contents: ['# Report\n\n## Early\n\na\n\n## Late\n\nb'],
      preset: store => store.record('session-1', 'doc.md', {
        at: 1000, anchor: null, index: -1, offsetIntoSection: 0, fraction: 0.9,
      } satisfies ReadingPosition),
    })
    const geometry = installGeometry(harness, 2000, 500, [0, 300, 600])
    // Outline navigation jumps Late before the restore frame fires.
    HTMLElement.prototype.scrollIntoView = vi.fn(function (this: HTMLElement) {
      const container = geometry.scroller()
      const headings = [...container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')]
      const index = headings.indexOf(this)
      if (index >= 0) container.scrollTop = [0, 300, 600][index] ?? 0
    })
    await act(async () => {
      (harness.container.querySelector('button[aria-label="outline.open"]') as HTMLButtonElement).click()
    })
    await act(async () => {
      ([...harness.container.querySelectorAll('button[role="menuitem"]')][2] as HTMLButtonElement).click()
    })
    await settleRestore()
    expect(geometry.scroller().scrollTop).toBe(600)
  })

  it('never lets a late restore scroll a switched-away document', async () => {
    const harness = await renderReadingPanel({
      preset: store => store.record('session-1', 'doc.md', {
        at: 1000, anchor: null, index: -1, offsetIntoSection: 0, fraction: 0.9,
      } satisfies ReadingPosition),
    })
    const geometry = installGeometry(harness, 2000, 500, [0])
    // Switch to another document before the pending restore fires.
    await act(async () => { harness.store.set({ sessionId: 'session-1', path: 'other.md' }) })
    await flush()
    await settleRestore()
    expect(geometry.scroller().scrollTop).toBe(0)
    expect(documentBody(harness).textContent).toContain('body text')
  })

  it('tells duplicate headings apart by occurrence', async () => {
    const harness = await renderReadingPanel({
      contents: ['# T\n\n## Step\n\na\n\n## Mid\n\nb\n\n## Step\n\nc'],
      preset: store => store.record('session-1', 'doc.md', {
        at: 1000, anchor: { text: 'Step', ordinal: 1 }, index: 2, offsetIntoSection: 25, fraction: 0.5,
      } satisfies ReadingPosition),
    })
    const geometry = installGeometry(harness, 2400, 600, [0, 300, 600, 900])
    await settleRestore()
    // The SECOND "Step" heading (top 900) plus the 25px offset — not the
    // first one at 300, and not "Mid" at 600.
    expect(geometry.scroller().scrollTop).toBe(925)
  })

  it('falls back proportionally when the recorded section no longer exists', async () => {
    const harness = await renderReadingPanel({
      contents: ['# T\n\n## Short now'],
      preset: store => store.record('session-1', 'doc.md', {
        at: 1000, anchor: { text: 'Vanished', ordinal: 0 }, index: 2, offsetIntoSection: 0, fraction: 0.4,
      } satisfies ReadingPosition),
    })
    const geometry = installGeometry(harness, 2000, 500, [0, 300])
    await settleRestore()
    expect(geometry.scroller().scrollTop).toBe(600) // 0.4 × 1500
  })

  it('keeps records of different sessions apart', async () => {
    const harness = await renderReadingPanel({
      preset: store => store.record('session-2', 'doc.md', {
        at: 1000, anchor: null, index: -1, offsetIntoSection: 0, fraction: 0.9,
      } satisfies ReadingPosition),
    })
    const geometry = installGeometry(harness, 2000, 500, [0])
    await settleRestore()
    // session-2's record must not move session-1's document.
    expect(geometry.scroller().scrollTop).toBe(0)
  })

  it('persists positions without document bodies or fingerprints', async () => {
    const harness = await renderReadingPanel({
      contents: ['# Public Title\n\nparagraph body that must never persist anywhere'],
    })
    const geometry = installGeometry(harness, 2000, 500, [0])
    await act(async () => {
      geometry.scroller().scrollTop = 500
      geometry.scroller().dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await closePanel(harness)
    const raw = harness.storage.getItem('dsh-md-preview.reading.v1') ?? ''
    expect(raw).not.toContain('paragraph body')
    expect(raw).not.toContain('fingerprint')
    expect(raw).toContain('Public Title') // section identity is the record
  })
})

describe('reading survives a broken store (#25)', () => {
  it('opens and reads normally when the store face throws', async () => {
    const hostile: ReadingStore = {
      get: () => { throw new Error('SecurityError') },
      record: () => { throw new Error('QuotaExceededError') },
      latest: () => { throw new Error('SecurityError') },
    }
    const harness = await renderReadingPanel({ readingStore: hostile })
    const geometry = installGeometry(harness, 2000, 500, [0])
    await act(async () => {
      geometry.scroller().scrollTop = 300
      geometry.scroller().dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await settleRestore()
    expect(documentBody(harness).textContent).toContain('body text')
    expect(harness.container.querySelector('.dsh-md-preview-panel')).toBeTruthy()
  })

  it('opens normally when the persisted envelope is damaged', async () => {
    const harness = await renderReadingPanel({
      preset: () => {},
    })
    harness.storage.setItem('dsh-md-preview.reading.v1', '{damaged')
    await act(async () => { harness.store.set(null) })
    await act(async () => { harness.store.set({ sessionId: 'session-1', path: 'doc.md' }) })
    await flush()
    expect(documentBody(harness).textContent).toContain('body text')
  })
})

describe('a recorded document that cannot be read (#25)', () => {
  it('states the failure and offers the way back to workspace browsing', async () => {
    const harness = await renderReadingPanel({
      failure: { code: 'md-preview/not-found', message: 'no such file' },
    })
    await flush()
    const body = documentBody(harness)
    expect(body.textContent).toContain('panel.error')
    expect(body.textContent).toContain('md-preview/not-found')
    const browseButton = body.querySelector('button[aria-label="panel.failBrowse"]') as HTMLButtonElement
    expect(browseButton).toBeTruthy()
    await act(async () => { browseButton.click() })
    await flush()
    // The tree face replaces the failed document; the panel stays.
    expect(harness.container.querySelector('.dsh-md-preview-panel')).toBeTruthy()
    expect((documentBody(harness) as HTMLElement).hidden).toBe(true)
    expect(harness.container.querySelector('.dsh-md-preview-tree')).toBeTruthy()
  })
})
