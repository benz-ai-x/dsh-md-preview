// @vitest-environment jsdom
/**
 * The panel header's information architecture: version lives in the crumbs
 * tooltip, the dirty dot tracks the edit session, the edit action carries
 * primary weight, and shortcut hints ride the titles.
 */

import { useSyncExternalStore } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { EditorView } from '@codemirror/view'
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import { PreviewOverlay } from '../src/client/PreviewOverlay.tsx'
import { createPreviewStore } from '../src/client/preview-state.ts'
import { createLeaveIntentSeat } from '../src/client/leave-intent.ts'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { WorkspaceDocsAction } from '../src/client/WorkspaceDocsAction.tsx'
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
  // A wide viewport: the default open is 720 and the header keeps its full
  // action row; narrow-width behavior drags below the threshold instead.
  Object.defineProperty(window, 'innerWidth', { value: 1928, configurable: true })
})

interface HeaderHarness {
  container: HTMLElement
  strip: ReturnType<typeof createSnapshotStore>
  rerender: () => Promise<void>
}

async function renderHeaderPanel(content: string, path = 'docs/guide.md'): Promise<HeaderHarness> {
  const store = createPreviewStore()
  const leave = createLeaveIntentSeat()
  const strip = createSnapshotStore(0)
  const readResult: { ok: true; value: MdPreviewFile } = { ok: true, value: { path, content, fingerprint: 'v1' } }
  // Stable seam identities, like the mount world's one-time closures: an
  // inline arrow per render would re-run the read effect on every rerender
  // and remount the editor mid-edit.
  const close = () => { store.set(null) }
  const read = () => Promise.resolve(readResult)
  const write = vi.fn(() => Promise.resolve({ ok: true as const, value: { path, fingerprint: 'v2' } }))
  const list = vi.fn(() => Promise.resolve({ ok: true as const, value: { path: '', entries: [] } }))
  const setTarget = vi.fn()
  const harness: HeaderHarness = {
    container: document.createElement('div'),
    strip,
    rerender: () => act(async () => { root.render(panelElement()) }),
  }
  const usePreviewTarget = (selector: (state: unknown) => unknown) =>
    selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  const panelElement = () => (
    <PreviewOverlay
      usePreviewTarget={usePreviewTarget as never}
      leave={leave}
      close={close}
      read={read as never}
      write={write as never}
      list={list as never}
      setTarget={setTarget as never}
      headerStrip={strip}
      t={t as never}
    />
  )
  document.body.appendChild(harness.container)
  const root: Root = createRoot(harness.container)
  store.set({ sessionId: 'session-1', path })
  await harness.rerender()
  await act(async () => { await Promise.resolve() })
  return harness
}

const flush = async (): Promise<void> => {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

afterEach(() => { document.body.replaceChildren() })

describe('header information architecture', () => {
  it('keeps the version in the crumbs tooltip instead of a resident badge', async () => {
    const harness = await renderHeaderPanel('# T')
    expect(harness.container.querySelector('.dsh-md-preview-version')).toBeNull()
    const crumbs = harness.container.querySelector('.dsh-md-preview-crumbs') as HTMLElement
    expect(crumbs.getAttribute('title')).toContain('docs/guide.md')
    expect(crumbs.getAttribute('title')).toMatch(/v\d+\.\d+\.\d+/)
  })

  it('shows the dirty dot only while the edit draft differs', async () => {
    const harness = await renderHeaderPanel('# T\n\nbody')
    expect(harness.container.querySelector('.dsh-md-preview-dirty')).toBeNull()
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.edit"]') as HTMLButtonElement).click()
    })
    await flush()
    expect(harness.container.querySelector('.dsh-md-preview-dirty')).toBeNull()
    const host = harness.container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(host)!
    await act(async () => { view.dispatch({ changes: { from: 0, insert: 'x' } }) })
    await flush()
    expect(harness.container.querySelector('.dsh-md-preview-dirty')).toBeTruthy()
  })

  it('weights the edit action and annotates shortcut titles', async () => {
    const harness = await renderHeaderPanel('# T')
    const edit = harness.container.querySelector('button[aria-label="panel.edit"]') as HTMLButtonElement
    expect(edit.classList.contains('dsh-md-preview-editcta')).toBe(true)
    await act(async () => { edit.click() })
    await flush()
    const find = harness.container.querySelector('button[aria-label="panel.find"]') as HTMLButtonElement
    const save = harness.container.querySelector('button[aria-label="panel.save"]') as HTMLButtonElement
    expect(find.getAttribute('title')).toContain('Mod-F')
    expect(save.getAttribute('title')).toContain('Mod-S')
  })

  it('carries the mode in a segmented control with the guard on switch (#14)', async () => {
    const harness = await renderHeaderPanel('# T\n\nbody')
    const seg = () => harness.container.querySelector('.dsh-md-preview-seg') as HTMLElement
    const viewBtn = () => seg().querySelector('button[aria-label="panel.view"]') as HTMLButtonElement
    const editBtn = () => seg().querySelector('button[aria-label="panel.edit"]') as HTMLButtonElement
    expect(seg()).toBeTruthy()
    expect(viewBtn().getAttribute('aria-pressed')).toBe('true')
    expect(editBtn().getAttribute('aria-pressed')).toBe('false')
    // The old silent-discard cancel button is gone; the segment replaces it.
    expect(harness.container.querySelector('button[aria-label="panel.cancel"]')).toBeNull()
    await act(async () => { editBtn().click() })
    await flush()
    expect(editBtn().getAttribute('aria-pressed')).toBe('true')
    expect(viewBtn().getAttribute('aria-pressed')).toBe('false')
    // Dirty draft: switching to 预览 raises the guard, not a silent discard.
    const host = harness.container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(host)!
    await act(async () => { view.dispatch({ changes: { from: 0, insert: 'x' } }) })
    await flush()
    await act(async () => { viewBtn().click() })
    await flush()
    expect(harness.container.textContent).toContain('panel.unsaved.title')
    // 继续编辑 keeps the edit face; the draft survives.
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.unsaved.keep"]') as HTMLButtonElement).click()
    })
    await flush()
    expect(harness.container.querySelector('.cm-editor')).toBeTruthy()
    await act(async () => { viewBtn().click() })
    await flush()
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.unsaved.discard"]') as HTMLButtonElement).click()
    })
    await flush()
    // 放弃修改 returns to the rendered view with the draft gone, panel open.
    expect(harness.container.querySelector('.cm-editor')).toBeNull()
    expect(harness.container.querySelector('.dsh-md-preview-panel')).toBeTruthy()
    expect(harness.container.querySelector('.dsh-md-preview-dirty')).toBeNull()
  })

  it('switches straight back on a clean draft without the guard', async () => {
    const harness = await renderHeaderPanel('# T')
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.edit"]') as HTMLButtonElement).click()
    })
    await flush()
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.view"]') as HTMLButtonElement).click()
    })
    await flush()
    expect(harness.container.querySelector('.cm-editor')).toBeNull()
    expect(harness.container.textContent).not.toContain('panel.unsaved.title')
  })
})

describe('panel footer version (user feedback)', () => {
  it('shows the version in a resident footer at the panel bottom', async () => {
    const harness = await renderHeaderPanel('# T')
    const foot = harness.container.querySelector('.dsh-md-preview-foot') as HTMLElement
    expect(foot).toBeTruthy()
    expect(foot.textContent).toMatch(/v\d+\.\d+\.\d+/)
  })
})

describe('header browse capsule (session utilities)', () => {
  const renderCapsule = async (store: ReturnType<typeof createPreviewStore>, leave: ReturnType<typeof createLeaveIntentSeat>) => {
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
          t={t as never}
        />,
      )
    })
    return container
  }

  it('toggles the panel: closed parks the tree, open dismisses', async () => {
    const store = createPreviewStore()
    const leave = createLeaveIntentSeat()
    const container = await renderCapsule(store, leave)
    const button = container.querySelector('button[aria-label="dock.browse"]') as HTMLButtonElement
    expect(button.classList.contains('dsh-md-preview-docsbtn')).toBe(true)
    // Closed: not pressed; the click requests the tree-faced open.
    expect(button.getAttribute('aria-pressed')).toBe('false')
    await act(async () => { button.click() })
    expect(leave.getSnapshot()).toEqual({ kind: 'open', target: { sessionId: 's1', path: '', face: 'browse' } })
    // Open (any target): pressed; the click requests the collapse instead.
    await act(async () => { leave.clear() })
    store.set({ sessionId: 's1', path: 'guide.md' } as never)
    await act(async () => { await Promise.resolve() })
    expect(button.getAttribute('aria-pressed')).toBe('true')
    await act(async () => { button.click() })
    expect(leave.getSnapshot()).toEqual({ kind: 'close' })
  })
})

/** Narrow the overlay from its left-edge handle (right-anchored: drag right). */
const dragNarrow = async (harness: HeaderHarness): Promise<void> => {
  const handle = harness.container.querySelector('.dsh-md-preview-edgehandle') as HTMLElement
  expect(handle).toBeTruthy()
  const down = new MouseEvent('pointerdown', { bubbles: true, clientX: 1000 })
  Object.assign(down, { pointerId: 1 })
  await act(async () => { handle.dispatchEvent(down) })
  const move = new MouseEvent('pointermove', { bubbles: true, clientX: 1400 })
  Object.assign(move, { pointerId: 1 })
  await act(async () => {
    handle.dispatchEvent(move)
    await new Promise(resolve => { setTimeout(resolve, 40) })
  })
  const up = new MouseEvent('pointerup', { bubbles: true, clientX: 1400 })
  Object.assign(up, { pointerId: 1 })
  await act(async () => { handle.dispatchEvent(up) })
  await harness.rerender()
}

describe('header layout and entry reachability (#22)', () => {
  it('orders the header one row: shrinkable identity first, maximize and close stable at the end', async () => {
    const harness = await renderHeaderPanel('# T')
    const header = harness.container.querySelector('.dsh-md-preview-header') as HTMLElement
    expect(header).toBeTruthy()
    const labels = [...header.querySelectorAll('button')].map(button => button.getAttribute('aria-label'))
    // The document identity leads; maximize and close are the last two seats.
    expect(labels[labels.indexOf('panel.maximize')]).toBe('panel.maximize')
    expect(labels.indexOf('panel.close')).toBe(labels.length - 1)
    expect(labels.indexOf('panel.maximize')).toBe(labels.length - 2)
    // Long names ellipsize inside the identity; the full path stays readable.
    const crumbs = header.querySelector('.dsh-md-preview-crumbs') as HTMLElement
    expect(crumbs.getAttribute('title')).toContain('docs/guide.md')
  })

  it('keeps every header action on one row while editing (no wrap siblings)', async () => {
    const harness = await renderHeaderPanel('# T\n\nbody')
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.edit"]') as HTMLButtonElement).click()
    })
    await flush()
    const header = harness.container.querySelector('.dsh-md-preview-header') as HTMLElement
    // The edit face's whole toolset renders inside the single header element.
    for (const label of ['panel.undo', 'panel.redo', 'panel.find', 'panel.save', 'panel.maximize', 'panel.close']) {
      expect([...header.querySelectorAll('button')].some(button => button.getAttribute('aria-label') === label), label).toBe(true)
    }
  })

  it('collects low-frequency actions behind the more menu when narrow; save and close stay direct', async () => {
    const harness = await renderHeaderPanel('# T\n\nbody')
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.edit"]') as HTMLButtonElement).click()
    })
    await flush()
    await dragNarrow(harness)
    await flush()
    const header = harness.container.querySelector('.dsh-md-preview-header') as HTMLElement
    const direct = [...header.querySelectorAll(':scope > * > button, :scope > button, :scope > span > button')]
      .map(button => button.getAttribute('aria-label'))
    // The editor toolset left the row for the menu…
    expect(direct).not.toContain('panel.undo')
    expect(direct).not.toContain('panel.find')
    // …while save, face, maximize and close remain directly clickable.
    for (const label of ['panel.save', 'panel.maximize', 'panel.close']) {
      expect(direct).toContain(label)
    }
    // The more menu opens and carries the low-frequency actions.
    const more = [...harness.container.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'panel.more') as HTMLButtonElement
    expect(more).toBeDefined()
    await act(async () => { more.click() })
    await flush()
    const menu = harness.container.querySelector('.dsh-md-preview-more') as HTMLElement
    expect(menu).toBeTruthy()
    const menuLabels = [...menu.querySelectorAll('button')].map(button => button.getAttribute('aria-label'))
    expect(menuLabels).toContain('panel.undo')
    expect(menuLabels).toContain('panel.find')
    // Esc closes the menu first; the panel itself survives.
    const panel = harness.container.querySelector('.dsh-md-preview-panel') as HTMLElement
    await act(async () => { panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    await flush()
    expect(harness.container.querySelector('.dsh-md-preview-more')).toBeNull()
    expect(harness.container.querySelector('.dsh-md-preview-panel')).toBeTruthy()
  })

  it('undoes a real edit from the more menu at narrow width', async () => {
    const harness = await renderHeaderPanel('# T\n\nbody')
    await act(async () => {
      (harness.container.querySelector('button[aria-label="panel.edit"]') as HTMLButtonElement).click()
    })
    await flush()
    const host = harness.container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(host)!
    await act(async () => { view.dispatch({ changes: { from: 0, insert: 'x' } }) })
    await flush()
    await dragNarrow(harness)
    await flush()
    await act(async () => {
      ([...harness.container.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === 'panel.more') as HTMLButtonElement).click()
    })
    await flush()
    const undoBtn = harness.container.querySelector('.dsh-md-preview-more button[aria-label="panel.undo"]') as HTMLButtonElement
    await act(async () => { undoBtn.click() })
    await flush()
    expect(view.state.doc.toString()).not.toContain('x#')
  })
})

describe('workspace-docs capsule occlusion (#22 measured strip)', () => {
  it('publishes the host session-header strip bottom for the panel to clear', async () => {
    const store = createPreviewStore()
    const leave = createLeaveIntentSeat()
    const strip = createSnapshotStore(0)
    const hostHeader = document.createElement('header')
    const utilities = document.createElement('div')
    hostHeader.append(utilities)
    document.body.append(hostHeader)
    hostHeader.getBoundingClientRect = () => ({ bottom: 57 } as DOMRect)
    const root: Root = createRoot(utilities)
    const usePreviewTarget = (selector: (state: unknown) => unknown) =>
      selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
    await act(async () => {
      root.render(
        <WorkspaceDocsAction
          sessionId={'s1' as never}
          usePreviewTarget={usePreviewTarget as never}
          leave={leave}
          headerStrip={strip}
          t={t as never}
        />,
      )
    })
    expect(strip.getSnapshot()).toBe(57)
    await act(async () => { root.unmount() })
    hostHeader.remove()
  })

  it('starts the overlay below the measured strip and clears it when none publishes', async () => {
    const harness = await renderHeaderPanel('# T')
    const strip = (harness as unknown as { strip: ReturnType<typeof createSnapshotStore> }).strip
    await act(async () => { strip.set(57) })
    await harness.rerender()
    const overlay = harness.container.querySelector('.dsh-md-preview-overlay') as HTMLElement
    expect(overlay.style.top).toBe('57px')
    await act(async () => { strip.set(0) })
    await harness.rerender()
    expect((harness.container.querySelector('.dsh-md-preview-overlay') as HTMLElement).style.top).toBe('0px')
  })
})
