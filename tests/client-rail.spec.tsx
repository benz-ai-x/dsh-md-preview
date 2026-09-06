// @vitest-environment jsdom
/**
 * The rail (#11): at ≥640px panel width the workspace tree lives in a
 * persistent left rail beside the document — the document is never swapped
 * away; below 640px the rail falls back to the browse-face swap.
 */

import { useSyncExternalStore } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import { PreviewOverlay } from '../src/client/PreviewOverlay.tsx'
import { createPreviewStore } from '../src/client/preview-state.ts'
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
})

interface RailHarness {
  container: HTMLElement
  setTarget: (target: { sessionId: string; path: string } | null) => void
  rerender: () => Promise<void>
}

interface ListScript {
  entries: MdPreviewEntry[]
}

async function renderRail(script: Map<string, ListScript>, content?: string): Promise<RailHarness> {
  const store = createPreviewStore()
  const harness: RailHarness = {
    container: document.createElement('div'),
    setTarget: target => { store.set(target as never) },
    rerender: () => act(async () => { root.render(panelElement()) }),
  }
  const list = vi.fn((sessionId: string, path: string) => {
    const page = script.get(path) ?? { entries: [] }
    return Promise.resolve({ ok: true as const, value: { path, entries: page.entries } satisfies MdPreviewListResult })
  })
  const usePreviewTarget = (selector: (state: unknown) => unknown) =>
    selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  const panelElement = () => (
    <PreviewOverlay
      usePreviewTarget={usePreviewTarget as never}
      close={() => { store.set(null) }}
      read={((sessionId: string, path: string) =>
        Promise.resolve({ ok: true as const, value: { path, content: content ?? `# ${path}`, fingerprint: 'v1' } satisfies MdPreviewFile })) as never}
      write={vi.fn(() => Promise.resolve({ ok: true, value: { path: 'x', fingerprint: 'v2' } })) as never}
      list={list as never}
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

/** Drag the left-edge resize handle (rAF-throttled like the real gesture). */
const dragHandle = async (harness: RailHarness, from: number, to: number): Promise<void> => {
  const handle = harness.container.querySelector('.dsh-md-preview-handle') as HTMLElement
  expect(handle).toBeTruthy()
  const down = new MouseEvent('pointerdown', { bubbles: true, clientX: from })
  Object.assign(down, { pointerId: 1 })
  await act(async () => { handle.dispatchEvent(down) })
  const move = new MouseEvent('pointermove', { bubbles: true, clientX: to })
  Object.assign(move, { pointerId: 1 })
  await act(async () => {
    handle.dispatchEvent(move)
    await new Promise(resolve => { setTimeout(resolve, 40) })
  })
  const up = new MouseEvent('pointerup', { bubbles: true, clientX: to })
  Object.assign(up, { pointerId: 1 })
  await act(async () => { handle.dispatchEvent(up) })
}

const panelWidth = (harness: RailHarness): number =>
  parseInt((harness.container.querySelector('.dsh-md-preview-panel') as HTMLElement).style.width, 10)

const buttonByLabel = (harness: RailHarness, label: string): HTMLButtonElement | undefined =>
  [...harness.container.querySelectorAll('button')]
    .find(button => button.getAttribute('aria-label') === label)

afterEach(() => { document.body.replaceChildren() })

const TREE = new Map<string, ListScript>([
  ['', { entries: [
    { name: 'guide.md', type: 'file', path: 'guide.md' },
    { name: 'notes.md', type: 'file', path: 'notes.md' },
    { name: 'src', type: 'directory', path: 'src' },
  ] }],
  ['src', { entries: [{ name: 'deep.md', type: 'file', path: 'src/deep.md' }] }],
])

describe('rail (#11)', () => {

  it('shows the tree beside the document once widened past 640px', async () => {
    const harness = await renderRail(TREE)
    // Default width 500: no tree until the workspace is opened (existing behavior).
    expect(harness.container.querySelector('[role="tree"]')).toBeNull()
    await dragHandle(harness, 100, -600)
    expect(panelWidth(harness)).toBeGreaterThanOrEqual(640)
    await flush()
    expect(harness.container.querySelector('[role="tree"]')).toBeTruthy()
    const document = harness.container.querySelector('.dsh-md-preview-document') as HTMLElement
    expect(document.hidden).toBe(false)
    // Opening a file from the rail swaps the target, not the document away.
    const row = harness.container.querySelector('[data-path="notes.md"] .dsh-md-preview-treerow') as HTMLElement
    await act(async () => { row.click() })
    await flush()
    expect(document.hidden).toBe(false)
    expect(document.textContent).toContain('notes.md')
    expect(document.textContent).not.toContain('guide.md')
  })

  it('collapses the rail from the workspace button at wide widths', async () => {
    const harness = await renderRail(TREE)
    await dragHandle(harness, 100, -600)
    await flush()
    expect(harness.container.querySelector('[role="tree"]')).toBeTruthy()
    const browser = () => harness.container.querySelector('.dsh-md-preview-browser') as HTMLElement
    await act(async () => { buttonByLabel(harness, 'browse.open')!.click() })
    await flush()
    expect(browser().hasAttribute('hidden')).toBe(true)
    expect(browser().hasAttribute('data-open')).toBe(false)
    await act(async () => { buttonByLabel(harness, 'browse.open')!.click() })
    await flush()
    expect(browser().hasAttribute('hidden')).toBe(false)
    expect(browser().hasAttribute('data-open')).toBe(true)
  })

  it('falls back to the browse-face swap below 640px', async () => {
    const harness = await renderRail(TREE)
    await dragHandle(harness, 100, -600)
    await flush()
    // Shrink back below the threshold: rail disappears, the workspace button
    // returns to swapping the browse face in (document hidden while browsing).
    await dragHandle(harness, -600, 200)
    expect(panelWidth(harness)).toBeLessThan(640)
    await flush()
    expect(harness.container.querySelector('.dsh-md-preview-browser[data-open]')).toBeNull()
    await act(async () => { buttonByLabel(harness, 'browse.open')!.click() })
    await flush()
    expect((harness.container.querySelector('.dsh-md-preview-browser') as HTMLElement).hasAttribute('hidden')).toBe(false)
    expect((harness.container.querySelector('.dsh-md-preview-document') as HTMLElement).hidden).toBe(true)
    await act(async () => { buttonByLabel(harness, 'browse.back')!.click() })
    await flush()
    expect((harness.container.querySelector('.dsh-md-preview-document') as HTMLElement).hidden).toBe(false)
  })
})

const pressPanelKey = async (harness: RailHarness, init: KeyboardEventInit): Promise<void> => {
  const panel = harness.container.querySelector('.dsh-md-preview-panel') as HTMLElement
  await act(async () => { panel.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init })) })
  await flush()
}

describe('rail outline tab + navigation shortcuts (#12)', () => {
  const OUTLINE_TREE = new Map<string, ListScript>([['', { entries: [
    { name: 'guide.md', type: 'file', path: 'guide.md' },
  ] }]])

  it('lists the outline in the rail and keeps the tab across collapse', async () => {
    const harness = await renderRail(OUTLINE_TREE, '# Alpha\n\n## Beta')
    await dragHandle(harness, 100, -600)
    await flush()
    await act(async () => {
      (harness.container.querySelector('.dsh-md-preview-railtabs [role="tab"][aria-selected="false"]') as HTMLElement).click()
    })
    await flush()
    const items = [...harness.container.querySelectorAll('.dsh-md-preview-railoutline button')]
    expect(items.map(item => item.textContent)).toEqual(['Alpha', 'Beta'])
    // Collapse and expand: the outline tab is still selected.
    await act(async () => { buttonByLabel(harness, 'browse.open')!.click() })
    await flush()
    await act(async () => { buttonByLabel(harness, 'browse.open')!.click() })
    await flush()
    expect(harness.container.querySelectorAll('.dsh-md-preview-railoutline button').length).toBe(2)
  })

  it('jumps from a rail outline click and highlights the active entry', async () => {
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    const harness = await renderRail(OUTLINE_TREE, '# Alpha\n\n## Beta')
    await dragHandle(harness, 100, -600)
    await flush()
    await pressPanelKey(harness, { key: 'O', shiftKey: true, metaKey: true })
    const items = [...harness.container.querySelectorAll('.dsh-md-preview-railoutline button')]
    expect(items.length).toBe(2)
    await act(async () => { items[1]!.click() })
    // Clicking a rail entry scrolls the rendered heading; the popover-close
    // side effect is irrelevant here (the popover was never open).
    const startCalls = scrollIntoView.mock.calls.filter(call => (call[0] as { block?: string }).block === 'start')
    expect(startCalls).toHaveLength(1)
  })

  it('routes the shortcuts by width: rail tab wide, popover/face narrow', async () => {
    const harness = await renderRail(OUTLINE_TREE, '# Alpha')
    // Narrow: Mod-Shift-O opens the outline popover.
    await pressPanelKey(harness, { key: 'O', shiftKey: true, metaKey: true })
    expect(harness.container.querySelector('.dsh-md-preview-outline')).toBeTruthy()
    // Esc closes it.
    await pressPanelKey(harness, { key: 'Escape' })
    expect(harness.container.querySelector('.dsh-md-preview-outline')).toBeNull()
    // Narrow: Mod-Shift-E enters the browse face.
    await pressPanelKey(harness, { key: 'E', shiftKey: true, metaKey: true })
    expect((harness.container.querySelector('.dsh-md-preview-document') as HTMLElement).hidden).toBe(true)
    await act(async () => { buttonByLabel(harness, 'browse.back')!.click() })
    await flush()
    // Wide: Mod-Shift-O selects the outline rail tab directly.
    await dragHandle(harness, 100, -600)
    await flush()
    await pressPanelKey(harness, { key: 'O', shiftKey: true, metaKey: true })
    expect(harness.container.querySelector('.dsh-md-preview-railoutline')).toBeTruthy()
    expect((harness.container.querySelector('.dsh-md-preview-railoutline') as HTMLElement).hidden).toBe(false)
  })
})

describe('dirty-draft guard on tree file opens (#10 story 5)', () => {
  it('asks before discarding a dirty draft for another file', async () => {
    const harness = await renderRail(TREE, '# Guide\n\nbody')
    await dragHandle(harness, 100, -600)
    await flush()
    await act(async () => {
      (harness.container.querySelector('.dsh-md-preview-seg button[aria-label="panel.edit"]') as HTMLElement).click()
    })
    await flush()
    const host = harness.container.querySelector('.cm-editor') as HTMLElement
    const view = (await import('@codemirror/view')).EditorView.findFromDOM(host)!
    await act(async () => { view.dispatch({ changes: { from: 0, insert: 'x' } }) })
    await flush()
    const row = harness.container.querySelector('[data-path="notes.md"] .dsh-md-preview-treerow') as HTMLElement
    await act(async () => { row.click() })
    await flush()
    // The guard holds the open; the target is unchanged while it asks.
    expect(harness.container.textContent).toContain('panel.unsaved.title')
    expect((harness.container.querySelector('.dsh-md-preview-crumbs') as HTMLElement).getAttribute('title')).toContain('guide.md')
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.unsaved.keep"]') as HTMLElement).click()
    })
    await flush()
    expect(harness.container.querySelector('.cm-editor')).toBeTruthy()
    // Discard releases the held open: target switches, draft dies.
    await act(async () => { row.click() })
    await flush()
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.unsaved.discard"]') as HTMLElement).click()
    })
    await flush()
    expect((harness.container.querySelector('.dsh-md-preview-crumbs') as HTMLElement).getAttribute('title')).toContain('notes.md')
    expect(harness.container.querySelector('.cm-editor')).toBeNull()
    expect(harness.container.querySelector('.dsh-md-preview-dirty')).toBeNull()
  })
})
