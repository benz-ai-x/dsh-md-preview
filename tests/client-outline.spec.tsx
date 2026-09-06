// @vitest-environment jsdom
/**
 * The outline: source extraction (fences skipped, ATX only) and the panel
 * popover's navigation in both faces — rendered-heading scroll in view,
 * line-anchored cursor jump in edit.
 */

import { useSyncExternalStore } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { EditorView } from '@codemirror/view'
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import { PreviewOverlay } from '../src/client/PreviewOverlay.tsx'
import { createPreviewStore } from '../src/client/preview-state.ts'
import { activeIndexForLine, activeIndexForScroll, extractOutline, findHeadingElement } from '../src/client/outline.ts'
import type { MdPreviewFile } from '../src/protocol.ts'

const t = (key: string) => key

const DOC = [
  '# Title',
  '',
  '```md',
  '# Fenced not heading',
  '```',
  '',
  '## Section *A*',
  'text',
  '### Deep `code` heading##',
  '',
  '~~~',
  '~ not fenced heading either',
  '~~~',
  '',
  '## Section A',
  'repeat text',
].join('\n')

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
  // jsdom ships no layout: CodeMirror's measure pass reads Range.getClientRects,
  // and an orphaned rAF after the test would otherwise surface it unhandled.
  ;(Range.prototype as unknown as { getClientRects?: () => [] }).getClientRects ??= () => []
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

describe('extractOutline', () => {
  it('walks ATX headings in order with levels and lines', () => {
    expect(extractOutline(DOC)).toEqual([
      { level: 1, text: 'Title', line: 1 },
      { level: 2, text: 'Section A', line: 7 },
      // No space before the trailing ##, so commonmark keeps it in the text.
      { level: 3, text: 'Deep code heading##', line: 9 },
      { level: 2, text: 'Section A', line: 15 },
    ])
  })
  it('skips fenced content of both fence kinds and empties', () => {
    expect(extractOutline('```\n# a\n```\n## ok')).toEqual([{ level: 2, text: 'ok', line: 4 }])
    expect(extractOutline('####### seven\n#\n## x')).toEqual([{ level: 2, text: 'x', line: 3 }])
    expect(extractOutline('')).toEqual([])
  })
})

describe('findHeadingElement', () => {
  it('resolves repeated headings by occurrence ordinal', () => {
    const container = document.createElement('div')
    container.innerHTML = '<h2>Section A</h2><h2>Other</h2><h2>Section A</h2>'
    const entries = extractOutline('## Section A\n## Other\n## Section A')
    expect(findHeadingElement(container, entries, 0)?.nextElementSibling?.textContent).toBe('Other')
    expect(findHeadingElement(container, entries, 2)?.textContent).toBe('Section A')
    expect(findHeadingElement(container, entries, 1)?.textContent).toBe('Other')
    expect(findHeadingElement(container, entries, 9)).toBeUndefined()
  })
})

describe('activeIndexForLine / activeIndexForScroll', () => {
  const ENTRIES = extractOutline('# A\n\n## B\n\n## C')
  it('activeIndexForLine owns the position from its heading line onward', () => {
    expect(activeIndexForLine(ENTRIES, 0)).toBe(-1)
    expect(activeIndexForLine(ENTRIES, 1)).toBe(0)
    expect(activeIndexForLine(ENTRIES, 2)).toBe(0)
    expect(activeIndexForLine(ENTRIES, 3)).toBe(1)
    expect(activeIndexForLine(ENTRIES, 5)).toBe(2)
    expect(activeIndexForLine(ENTRIES, 99)).toBe(2)
    expect(activeIndexForLine([], 1)).toBe(-1)
  })
  it('activeIndexForScroll picks the last heading at or above the scroll top', () => {
    expect(activeIndexForScroll([0, 120, 240], 0)).toBe(0)
    expect(activeIndexForScroll([0, 120, 240], 119)).toBe(0)
    expect(activeIndexForScroll([0, 120, 240], 120)).toBe(1)
    expect(activeIndexForScroll([0, 120, 240], 300)).toBe(2)
    expect(activeIndexForScroll([], 0)).toBe(-1)
  })
})

interface OutlineHarness {
  container: HTMLElement
  view: EditorView | null
  rerender: () => Promise<void>
}

async function renderOutlinePanel(content: string): Promise<OutlineHarness> {
  const store = createPreviewStore()
  const readResult: { ok: true; value: MdPreviewFile } = { ok: true, value: { path: 'doc.md', content, fingerprint: 'v1' } }
  const harness: OutlineHarness = {
    container: document.createElement('div'),
    view: null,
    rerender: () => act(async () => { root.render(panelElement()) }),
  }
  const usePreviewTarget = (selector: (state: unknown) => unknown) =>
    selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  const panelElement = () => (
    <PreviewOverlay
      usePreviewTarget={usePreviewTarget as never}
      close={() => { store.set(null) }}
      read={(() => Promise.resolve(readResult)) as never}
      write={(vi.fn(() => Promise.resolve({ ok: true, value: { path: 'doc.md', fingerprint: 'v2' } }))) as never}
      t={t as never}
    />
  )
  document.body.appendChild(harness.container)
  const root: Root = createRoot(harness.container)
  store.set({ sessionId: 'session-1', path: 'doc.md' })
  await harness.rerender()
  await act(async () => { await Promise.resolve() })
  return harness
}

const outlineButtons = (harness: OutlineHarness) =>
  [...harness.container.querySelectorAll('button[role="menuitem"]')]

const flush = async (): Promise<void> => {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

afterEach(() => { document.body.replaceChildren() })

describe('outline popover', () => {
  it('lists the document headings and scrolls the rendered one on click', async () => {
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    const harness = await renderOutlinePanel(DOC)
    const toggle = harness.container.querySelector('button[aria-label="outline.open"]') as HTMLButtonElement
    expect(toggle).toBeTruthy()
    await act(async () => { toggle.click() })
    const items = outlineButtons(harness)
    expect(items.map(item => item.textContent)).toEqual(['Title', 'Section A', 'Deep code heading##', 'Section A'])
    await act(async () => { items[2]!.click() })
    // The third entry jumps the third rendered heading (deep = h3). The
    // popover's keep-visible pass may also scroll ({ block: 'nearest' }), so
    // the jump is asserted by its 'start' call alone.
    const startCalls = scrollIntoView.mock.calls
      .filter(call => (call[0] as { block?: string }).block === 'start')
    expect(startCalls).toHaveLength(1)
    expect((startCalls[0] as unknown[])[0]).toEqual({ block: 'start' })
    // Selection consumed the popover.
    expect(harness.container.querySelector('.dsh-md-preview-outline')).toBeNull()
  })

  it('stays hidden for a document without headings', async () => {
    const harness = await renderOutlinePanel('just text\n')
    expect(harness.container.querySelector('button[aria-label="outline.open"]')).toBeNull()
  })

  it('jumps the editor cursor to the heading line in the edit face', async () => {
    const harness = await renderOutlinePanel(DOC)
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.edit"]') as HTMLButtonElement).click()
    })
    await flush()
    const host = harness.container.querySelector('.cm-editor') as HTMLElement
    harness.view = EditorView.findFromDOM(host)
    const toggle = harness.container.querySelector('button[aria-label="outline.open"]') as HTMLButtonElement
    await act(async () => { toggle.click() })
    const items = outlineButtons(harness)
    // Entry 2 (Deep code heading##) lives on source line 9 → cursor lands there.
    await act(async () => { items[2]!.click() })
    await flush()
    const main = harness.view!.state.selection.main
    expect(harness.view!.state.doc.lineAt(main.head).number).toBe(9)
  })

  it('marks the outline entry owning the cursor line in the edit face', async () => {
    const harness = await renderOutlinePanel(DOC)
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.edit"]') as HTMLButtonElement).click()
    })
    await flush()
    const host = harness.container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(host)!
    await act(async () => {
      view.dispatch({ selection: { anchor: view.state.doc.line(9).from } })
    })
    await flush()
    const toggle = harness.container.querySelector('button[aria-label="outline.open"]') as HTMLButtonElement
    await act(async () => { toggle.click() })
    const items = outlineButtons(harness)
    // Line 9 is entry 2 (Deep code heading##); entry 1 (line 7) no longer owns it.
    expect(items[2]!.getAttribute('aria-current')).toBe('true')
    expect(items[1]!.getAttribute('aria-current')).toBeNull()
  })

  it('marks the heading at the scroll position in the view face', async () => {
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    const harness = await renderOutlinePanel(DOC)
    const scroller = harness.container.querySelector('.dsh-md-preview-document') as HTMLElement
    // Document offsets of the four rendered headings (DOC has 4 outline
    // entries). The mock models viewport rects: top = offset - scrollTop.
    const docTops = [0, 120, 240, 360]
    const headings = [...scroller.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')]
    const rect = (top: number): DOMRect =>
      ({ top, right: 0, bottom: 0, left: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const index = headings.indexOf(this)
      return rect(index >= 0 ? (docTops[index] ?? 0) - scroller.scrollTop : 0)
    })
    await act(async () => {
      scroller.scrollTop = 200
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
    })
    await flush()
    const toggle = harness.container.querySelector('button[aria-label="outline.open"]') as HTMLButtonElement
    await act(async () => { toggle.click() })
    const items = outlineButtons(harness)
    // offset = viewportTop - scrollerTop + scrollTop = docTop; 120 <= 200 < 240
    // → entry 1 (Section *A*).
    expect(items[1]!.getAttribute('aria-current')).toBe('true')
    rectSpy.mockRestore()
  })
})
