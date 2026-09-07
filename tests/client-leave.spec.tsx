// @vitest-environment jsdom
/**
 * The common leave-intent entry (#21): every way out of the current preview
 * session — the panel's close button, Esc, the segmented switch back to the
 * view face, and external opens (chips, message actions, tree rows, the docs
 * capsule's collapse) — routes through one leave-intent seat. A dirty draft
 * holds the first intent behind the unsaved guard; a clean draft executes
 * immediately; re-opening the same preview target resets nothing.
 */

import { useSyncExternalStore } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { EditorView } from '@codemirror/view'
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import { PreviewOverlay } from '../src/client/PreviewOverlay.tsx'
import { WorkspaceDocsAction } from '../src/client/WorkspaceDocsAction.tsx'
import { createPreviewStore } from '../src/client/preview-state.ts'
import { createLeaveIntentSeat } from '../src/client/leave-intent.ts'
import type { MdPreviewEntry, MdPreviewFile, MdPreviewListResult } from '../src/protocol.ts'

const t = (key: string) => key

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
  ;(Range.prototype as unknown as { getClientRects?: () => [] }).getClientRects ??= () => []
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  // A wide viewport: the default 720 open docks the rail, so tree rows show.
  Object.defineProperty(window, 'innerWidth', { value: 1928, configurable: true })
})

interface LeaveHarness {
  container: HTMLElement
  reads: Array<{ sessionId: string; path: string }>
  writes: Array<{ path: string; content: string }>
  setTarget: (target: { sessionId: string; path: string; face?: 'browse' } | null) => void
  leave: ReturnType<typeof createLeaveIntentSeat>
  rerender: () => Promise<void>
}

const TREE: Array<MdPreviewEntry> = [
  { name: 'guide.md', type: 'file', path: 'guide.md' },
  { name: 'notes.md', type: 'file', path: 'notes.md' },
]

async function renderLeave(content = '# Guide\n\nbody'): Promise<LeaveHarness> {
  const store = createPreviewStore()
  const leave = createLeaveIntentSeat()
  const harness: LeaveHarness = {
    container: document.createElement('div'),
    reads: [],
    writes: [],
    setTarget: target => { store.set(target as never) },
    leave,
    rerender: () => act(async () => { root.render(panelElement()) }),
  }
  const usePreviewTarget = (selector: (state: unknown) => unknown) =>
    selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  const panelElement = () => (
    <PreviewOverlay
      usePreviewTarget={usePreviewTarget as never}
      leave={leave}
      close={() => { store.set(null) }}
      read={((sessionId: string, path: string) => {
        harness.reads.push({ sessionId, path })
        return Promise.resolve({ ok: true as const, value: { path, content, fingerprint: 'v1' } satisfies MdPreviewFile })
      }) as never}
      write={((sessionId: string, path: string, draft: string) => {
        harness.writes.push({ path, content: draft })
        return Promise.resolve({ ok: true as const, value: { path, fingerprint: 'v2' } })
      }) as never}
      list={vi.fn((sessionId: string, path: string) =>
        Promise.resolve({ ok: true as const, value: { path, entries: TREE } satisfies MdPreviewListResult })) as never}
      setTarget={harness.setTarget as never}
      t={t as never}
    />
  )
  document.body.appendChild(harness.container)
  const root: Root = createRoot(harness.container)
  harness.setTarget({ sessionId: 'session-1', path: 'guide.md' })
  await harness.rerender()
  await act(async () => { await Promise.resolve() })
  return harness
}

const flush = async (): Promise<void> => {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

const buttonByLabel = (harness: LeaveHarness, label: string): HTMLButtonElement | undefined =>
  [...harness.container.querySelectorAll('button')]
    .find(button => button.getAttribute('aria-label') === label || button.textContent === label)

const click = async (harness: LeaveHarness, label: string): Promise<void> => {
  const button = buttonByLabel(harness, label)
  expect(button, `button "${label}"`).toBeDefined()
  await act(async () => { button!.click() })
  await flush()
}

/** The panel's edit face with a real CodeMirror draft plus a known selection. */
async function editWithDraft(harness: LeaveHarness, insert = 'x'): Promise<EditorView> {
  await click(harness, 'panel.edit')
  const host = harness.container.querySelector('.cm-editor') as HTMLElement
  const view = EditorView.findFromDOM(host)!
  await act(async () => {
    view.dispatch({ selection: { anchor: 2, head: 6 }, changes: { from: 0, insert } })
  })
  await flush()
  return view
}

afterEach(() => { document.body.replaceChildren() })

describe('common leave-intent entry (#21)', () => {
  it('holds an external open behind the guard and executes it exactly once on discard', async () => {
    const harness = await renderLeave()
    await editWithDraft(harness)
    // A chip-style external open arrives through the leave seat.
    await act(async () => { harness.leave.request({ kind: 'open', target: { sessionId: 'session-1', path: 'notes.md' } }) })
    await flush()
    // The guard asks; the target is unchanged while it waits.
    expect(harness.container.textContent).toContain('panel.unsaved.title')
    expect((harness.container.querySelector('.dsh-md-preview-crumbs') as HTMLElement).getAttribute('title')).toContain('guide.md')
    await click(harness, 'panel.unsaved.discard')
    // The held open executes once: new document, no write.
    expect((harness.container.querySelector('.dsh-md-preview-crumbs') as HTMLElement).getAttribute('title')).toContain('notes.md')
    expect(harness.writes).toEqual([])
    expect(harness.reads.filter(read => read.path === 'notes.md')).toHaveLength(1)
    expect(harness.container.textContent).not.toContain('panel.unsaved.title')
  })

  it('keeps the draft, selection, and focus when the user continues editing', async () => {
    const harness = await renderLeave()
    const view = await editWithDraft(harness)
    await act(async () => { harness.leave.request({ kind: 'open', target: { sessionId: 'session-1', path: 'notes.md' } }) })
    await flush()
    await click(harness, 'panel.unsaved.keep')
    // The edit session survives untouched: draft, selection, and focus back.
    expect(view.state.doc.toString()).toBe('x# Guide\n\nbody')
    expect(view.state.selection.main.anchor).toBe(2)
    expect(view.state.selection.main.head).toBe(6)
    expect((document.activeElement as HTMLElement)?.closest('.cm-editor')).toBeTruthy()
    expect(harness.container.querySelector('.cm-editor')).toBeTruthy()
    expect(harness.reads.filter(read => read.path === 'notes.md')).toHaveLength(0)
  })

  it('never stacks guards and never lets a later click replace the held target', async () => {
    const harness = await renderLeave()
    await editWithDraft(harness)
    await act(async () => { harness.leave.request({ kind: 'open', target: { sessionId: 'session-1', path: 'notes.md' } }) })
    await flush()
    // A second intent while the guard is up is ignored, not queued or swapped in.
    await act(async () => { harness.leave.request({ kind: 'close' }) })
    await act(async () => { harness.leave.request({ kind: 'open', target: { sessionId: 'session-1', path: 'third.md' } }) })
    await flush()
    expect(harness.container.querySelectorAll('.dsh-md-preview-bar[role="alert"]').length).toBe(1)
    await click(harness, 'panel.unsaved.discard')
    // The FIRST held intent (notes.md) is what executes.
    expect((harness.container.querySelector('.dsh-md-preview-crumbs') as HTMLElement).getAttribute('title')).toContain('notes.md')
  })

  it('executes a clean-draft open immediately without any confirmation', async () => {
    const harness = await renderLeave()
    await act(async () => { harness.leave.request({ kind: 'open', target: { sessionId: 'session-1', path: 'notes.md' } }) })
    await flush()
    expect(harness.container.textContent).not.toContain('panel.unsaved.title')
    expect((harness.container.querySelector('.dsh-md-preview-crumbs') as HTMLElement).getAttribute('title')).toContain('notes.md')
  })

  it('treats re-opening the same preview target as a no-op that resets nothing', async () => {
    const harness = await renderLeave()
    const view = await editWithDraft(harness)
    const readsBefore = harness.reads.length
    await act(async () => {
      harness.leave.request({ kind: 'open', target: { sessionId: 'session-1', path: 'guide.md' } })
    })
    await flush()
    // Same session, same path: no guard, no re-read, the draft and selection stay.
    expect(harness.container.textContent).not.toContain('panel.unsaved.title')
    expect(harness.reads.length).toBe(readsBefore)
    expect(harness.container.querySelector('.cm-editor')).toBeTruthy()
    expect(view.state.doc.toString()).toBe('x# Guide\n\nbody')
    // A different session spelling the same path is a different preview target.
    await act(async () => {
      harness.leave.request({ kind: 'open', target: { sessionId: 'session-2', path: 'guide.md' } })
    })
    await flush()
    expect(harness.container.textContent).toContain('panel.unsaved.title')
  })

  it('routes the panel close button and the segmented switch through the same guard', async () => {
    const harness = await renderLeave()
    await editWithDraft(harness)
    await click(harness, 'panel.close')
    expect(harness.container.textContent).toContain('panel.unsaved.title')
    expect(harness.container.querySelector('.dsh-md-preview-panel')).toBeTruthy()
    await click(harness, 'panel.unsaved.keep')
    await click(harness, 'panel.view')
    expect(harness.container.textContent).toContain('panel.unsaved.title')
    await click(harness, 'panel.unsaved.discard')
    // Discarding the face switch returns to the rendered view, panel open.
    expect(harness.container.querySelector('.cm-editor')).toBeNull()
    expect(harness.container.querySelector('.dsh-md-preview-panel')).toBeTruthy()
    expect(harness.writes).toEqual([])
  })

  it('Esc asks through the guard and never confirms the discard by itself', async () => {
    const harness = await renderLeave()
    await editWithDraft(harness)
    const panel = harness.container.querySelector('.dsh-md-preview-panel') as HTMLElement
    await act(async () => { panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    await flush()
    expect(harness.container.textContent).toContain('panel.unsaved.title')
    // Esc while the guard is up does not discard; the draft survives.
    await act(async () => { panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    await flush()
    expect(harness.container.querySelector('.cm-editor')).toBeTruthy()
    expect(harness.container.querySelector('.dsh-md-preview-panel')).toBeTruthy()
  })

  it('Esc closes the current popover before requesting the panel close', async () => {
    const harness = await renderLeave()
    await click(harness, 'panel.edit')
    await click(harness, 'panel.keys')
    expect(harness.container.querySelector('.dsh-md-preview-keypop')).toBeTruthy()
    const panel = () => harness.container.querySelector('.dsh-md-preview-panel') as HTMLElement
    await act(async () => { panel().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    await flush()
    // The popover consumed the Esc; the panel itself is still open.
    expect(harness.container.querySelector('.dsh-md-preview-keypop')).toBeNull()
    expect(panel()).toBeTruthy()
    // The next Esc, with no popover left, requests the close.
    await act(async () => { panel().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    await flush()
    expect(harness.container.querySelector('.dsh-md-preview-panel')).toBeNull()
  })

  it('Esc inside the editor search panel does not close the preview panel', async () => {
    const harness = await renderLeave()
    await click(harness, 'panel.edit')
    await click(harness, 'panel.find')
    const input = harness.container.querySelector<HTMLInputElement>('.cm-panel.cm-search input')
    expect(input).toBeTruthy()
    await act(async () => { input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    await flush()
    expect(harness.container.querySelector('.dsh-md-preview-panel')).toBeTruthy()
    expect(harness.container.textContent).not.toContain('panel.unsaved.title')
  })

  it('opens a tree file through the same guard', async () => {
    const harness = await renderLeave()
    await editWithDraft(harness)
    const row = harness.container.querySelector('[data-path="notes.md"] .dsh-md-preview-treerow') as HTMLElement
    await act(async () => { row.click() })
    await flush()
    expect(harness.container.textContent).toContain('panel.unsaved.title')
    await click(harness, 'panel.unsaved.keep')
    expect((harness.container.querySelector('.dsh-md-preview-crumbs') as HTMLElement).getAttribute('title')).toContain('guide.md')
  })
})

describe('workspace-docs capsule semantics (#21)', () => {
  it('requests a browse open while closed and a guarded close while open', async () => {
    const store = createPreviewStore()
    const leave = createLeaveIntentSeat()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root: Root = createRoot(container)
    const usePreviewTarget = (selector: (state: unknown) => unknown) =>
      selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
    await act(async () => {
      root.render(
        <WorkspaceDocsAction
          sessionId={'s1' as never}
          usePreviewTarget={usePreviewTarget as never}
          leave={leave}
          setTarget={vi.fn() as never}
          t={t as never}
        />,
      )
    })
    const button = container.querySelector('button[aria-label="dock.browse"]') as HTMLButtonElement
    expect(button.getAttribute('aria-pressed')).toBe('false')
    await act(async () => { button.click() })
    expect(leave.getSnapshot()).toEqual({ kind: 'open', target: { sessionId: 's1', path: '', face: 'browse' } })
    // Panel open (any target): the same entry requests the collapse.
    await act(async () => { leave.clear() })
    store.set({ sessionId: 's1', path: 'guide.md' } as never)
    await act(async () => { await Promise.resolve() })
    expect(button.getAttribute('aria-pressed')).toBe('true')
    await act(async () => { button.click() })
    expect(leave.getSnapshot()).toEqual({ kind: 'close' })
    await act(async () => { root.unmount() })
  })
})
