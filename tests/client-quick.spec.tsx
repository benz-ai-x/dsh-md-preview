// @vitest-environment jsdom
/**
 * The browse area's quick entries (#31): a few recognizable rows above the
 * tree — the current turn's produced documents (owning-service facts fenced
 * by turn and closing seq) and this session's recently read documents —
 * both opening through the same guarded path as every other entry. Real
 * rendered interaction against the real panel, reading store, and leave
 * seat; only the Remote boundary is faked.
 */

import { useSyncExternalStore } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import { PreviewOverlay } from '../src/client/PreviewOverlay.tsx'
import { createPreviewStore } from '../src/client/preview-state.ts'
import { createLeaveIntentSeat } from '../src/client/leave-intent.ts'
import { createMemoryStorage, createReadingStore, type ReadingPosition } from '../src/client/reading.ts'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { MdPreviewFile, MdPreviewListResult } from '../src/protocol.ts'

const t = (key: string) => key

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
  ;(Range.prototype as unknown as { getClientRects?: () => [] }).getClientRects ??= () => []
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
})

const POSITION: ReadingPosition = { at: 0, anchor: null, index: -1, offsetIntoSection: 0, fraction: 0 }

interface QuickHarness {
  container: HTMLElement
  reads: Array<{ sessionId: string; path: string }>
  files: Map<string, string>
  reading: ReturnType<typeof createReadingStore>
  turnOutputs: SnapshotStore<{ sessionId: string; paths: readonly string[] } | null>
  setTurnOutputs(entry: { sessionId: string; paths: readonly string[] } | null): void
  setTarget: (target: { sessionId: string; path: string } | null) => void
  rerender: () => Promise<void>
  unmount(): Promise<void>
}

async function renderQuick(initial: {
  files?: ReadonlyArray<string>
  records?: ReadonlyArray<{ sessionId: string; path: string; at: number }>
  turnOutputs?: { sessionId: string; paths: readonly string[] } | null
}): Promise<QuickHarness> {
  const store = createPreviewStore()
  const leave = createLeaveIntentSeat()
  const files = new Map((initial.files ?? ['guide.md', 'notes.md']).map(name => [name, `# ${name}\n`]))
  const reading = createReadingStore(createMemoryStorage())
  for (const record of initial.records ?? []) reading.record(record.sessionId, record.path, { ...POSITION, at: record.at })
  const turnOutputs = createPreviewStore() // any snapshot store serves the seat
  const harness: QuickHarness = {
    container: document.createElement('div'),
    reads: [],
    files,
    reading,
    turnOutputs,
    setTurnOutputs: entry => { turnOutputs.set(entry as never) },
    setTarget: target => { store.set(target as never) },
    rerender: async () => { await act(async () => { root.render(panelElement()) }) },
    unmount: async () => { await act(async () => { root.unmount() }) },
  }
  const usePreviewTarget = (selector: (state: unknown) => unknown) =>
    selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  const root: Root = createRoot(harness.container)
  const panelElement = () => (
    <PreviewOverlay
      usePreviewTarget={usePreviewTarget as never}
      leave={leave}
      close={() => { store.set(null) }}
      read={((sessionId: string, path: string) => {
        harness.reads.push({ sessionId, path })
        const content = files.get(path)
        if (content === undefined) {
          return Promise.resolve({ ok: false as const, error: { code: 'md-preview/not-found', message: `no ${path}` } })
        }
        return Promise.resolve({ ok: true as const, value: { path, content, fingerprint: 'v1' } satisfies MdPreviewFile })
      }) as never}
      write={vi.fn(() => Promise.resolve({ ok: true, value: { path: 'x', fingerprint: 'v2' } })) as never}
      list={((sessionId: string, path: string) => Promise.resolve({
        ok: true as const,
        value: { path, entries: [...files.keys()].map(name => ({ name, type: 'file' as const, path: name })) } satisfies MdPreviewListResult,
      })) as never}
      search={((sessionId: string, query: string) => Promise.resolve({
        ok: true as const,
        value: { query, matches: [], complete: true, limits: [] },
      })) as never}
      reading={reading}
      turnOutputs={turnOutputs as never}
      setTarget={harness.setTarget as never}
      t={t as never}
    />
  )
  document.body.appendChild(harness.container)
  harness.setTarget({ sessionId: 'session-1', path: 'guide.md' })
  harness.setTurnOutputs(initial.turnOutputs ?? null)
  await harness.rerender()
  await act(async () => { await Promise.resolve() })
  return harness
}

const flush = async (): Promise<void> => {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

const enterBrowse = async (harness: QuickHarness): Promise<void> => {
  const button = [...harness.container.querySelectorAll('button')]
    .find(node => node.getAttribute('aria-label') === 'browse.open')!
  await act(async () => { button.click() })
  await flush()
  expect(harness.container.querySelector('[role="tree"]')).toBeTruthy()
}

/** The quick rows of one source section, by their title (full path). */
const quickRows = (harness: QuickHarness, source: string): HTMLElement[] =>
  [...harness.container.querySelectorAll<HTMLElement>(`.dsh-md-preview-quick[data-source="${source}"] .dsh-md-preview-quickrow`)]

afterEach(() => { document.body.replaceChildren() })

describe('quick entries (#31)', () => {
  it('lists the current turn outputs and recent reads with name and path, and opens them fresh', async () => {
    const harness = await renderQuick({
      files: ['guide.md', 'notes.md', 'deep/report.md'],
      records: [
        { sessionId: 'session-1', path: 'notes.md', at: 1000 },
        { sessionId: 'session-1', path: 'deep/report.md', at: 2000 },
        { sessionId: 'session-2', path: 'other.md', at: 3000 },
      ],
      turnOutputs: { sessionId: 'session-1', paths: ['deep/report.md', 'guide.md'] },
    })
    try {
      await enterBrowse(harness)
      const turnRows = quickRows(harness, 'turn')
      expect(turnRows.map(row => row.getAttribute('title'))).toEqual(['deep/report.md', 'guide.md'])
      // Name and path both render, so same-name documents stay apart.
      expect(turnRows[0]?.textContent).toContain('report.md')
      expect(turnRows[0]?.textContent).toContain('deep/report.md')
      const recentRows = quickRows(harness, 'recent')
      // Recency order, own session only; the other session never leaks.
      // (The newest may also appear — the continue-reading entry keeps its
      // own distinct seat, so the recent list stays the honest record.)
      expect(recentRows.map(row => row.getAttribute('title'))).toEqual(['deep/report.md', 'notes.md'])
      // Opening a quick row reads the document fresh through the leave path.
      await act(async () => { turnRows[0]!.click() })
      await flush()
      expect(harness.reads.at(-1)).toEqual({ sessionId: 'session-1', path: 'deep/report.md' })
      expect(harness.container.querySelector('.dsh-md-preview-crumb:last-child')?.textContent).toBe('report.md')
    } finally {
      await harness.unmount()
    }
  })

  it('routes a quick-entry open of another document through the unsaved guard', async () => {
    const harness = await renderQuick({
      turnOutputs: { sessionId: 'session-1', paths: ['guide.md', 'notes.md'] },
    })
    try {
      // guide.md shows; enter edit and dirty the draft in the real editor.
      const edit = [...harness.container.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'panel.edit')!
      await act(async () => { edit.click() })
      await flush()
      const { EditorView } = await import('@codemirror/view')
      const editor = EditorView.findFromDOM(harness.container.querySelector('.cm-editor') as HTMLElement)!
      await act(async () => { editor.dispatch({ changes: { from: 0, insert: 'x' } }) })
      await flush()
      // The rail's quick entry for notes.md requests through the leave seat;
      // the dirty draft holds it behind the guard.
      await enterBrowse(harness)
      const notesRow = quickRows(harness, 'turn').find(row => row.getAttribute('title') === 'notes.md')!
      await act(async () => { notesRow.click() })
      await flush()
      expect(harness.container.textContent).toContain('panel.unsaved.title')
      expect(harness.reads.filter(read => read.path === 'notes.md')).toHaveLength(0)
      // Keep editing: the held intent is dropped, nothing was read or written.
      await act(async () => {
        [...harness.container.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'panel.unsaved.keep')!.click()
      })
      await flush()
      expect(harness.reads.filter(read => read.path === 'notes.md')).toHaveLength(0)
      expect(harness.container.querySelector('.dsh-md-preview-crumb:last-child')?.textContent).toBe('guide.md')
    } finally {
      await harness.unmount()
    }
  })

  it('hides each section on its honest empty state and never crosses sessions', async () => {
    const harness = await renderQuick({ turnOutputs: null })
    try {
      await enterBrowse(harness)
      expect(quickRows(harness, 'turn')).toEqual([])
      expect(quickRows(harness, 'recent')).toEqual([])
      expect(harness.container.textContent).not.toContain('quick.turn')
      expect(harness.container.textContent).not.toContain('quick.recent')
      // Another session's published outputs are not this session's.
      harness.setTurnOutputs({ sessionId: 'session-2', paths: ['guide.md'] })
      await flush()
      expect(quickRows(harness, 'turn')).toEqual([])
    } finally {
      await harness.unmount()
    }
  })

  it('lands a deleted recent document on the normal failure state with the way back to browsing', async () => {
    const harness = await renderQuick({
      files: ['guide.md'],
      records: [{ sessionId: 'session-1', path: 'gone.md', at: 1000 }],
    })
    try {
      await enterBrowse(harness)
      const rows = quickRows(harness, 'recent')
      expect(rows.map(row => row.getAttribute('title'))).toEqual(['gone.md'])
      await act(async () => { rows[0]!.click() })
      await flush()
      expect(harness.container.textContent).toContain('panel.error')
      expect(harness.container.textContent).toContain('md-preview/not-found')
      const back = [...harness.container.querySelectorAll('button')]
        .find(b => b.getAttribute('aria-label') === 'panel.failBrowse')
      expect(back).toBeTruthy()
      // The way back indeed returns to the browse area.
      await act(async () => { back!.click() })
      await flush()
      expect(harness.container.querySelector('[role="tree"]')).toBeTruthy()
    } finally {
      await harness.unmount()
    }
  })
})
