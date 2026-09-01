// @vitest-environment jsdom
/**
 * Panel edit mode against the real component tree (real CodeMirror, real
 * snapshot store; read/write RPCs stubbed at the injected seam): edit entry,
 * guarded save, conflict round-trip, unsaved-close guard, and cancel.
 */

import { useSyncExternalStore } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { EditorView } from '@codemirror/view'
import { readFileSync } from 'node:fs'
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import { PreviewOverlay } from '../src/client/PreviewOverlay.tsx'
import { createPreviewStore } from '../src/client/preview-state.ts'
import type { MdPreviewFile, MdPreviewWriteResult } from '../src/protocol.ts'

// Identity locale: labels assert by dictionary key.
const t = (key: string) => key

// CodeMirror measures through ResizeObserver, which jsdom does not provide.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

interface PanelHarness {
  container: HTMLElement
  reads: number
  write: ReturnType<typeof vi.fn>
  setTarget: (target: { sessionId: string; path: string } | null) => void
  rerender: () => Promise<void>
  view: { dispatch: (spec: unknown) => void } | null
  readResult: { ok: true; value: MdPreviewFile } | { ok: false; error: { code: string; message: string } }
  writeResult: { ok: true; value: MdPreviewWriteResult } | { ok: false; error: { code: string; message: string } }
}

async function renderPanel(): Promise<PanelHarness> {
  const store = createPreviewStore()
  const harness: PanelHarness = {
    container: document.createElement('div'),
    reads: 0,
    write: vi.fn(() => Promise.resolve(harness.writeResult)),
    setTarget: target => { store.set(target as never) },
    rerender: () => act(async () => {
      root.render(panelElement())
    }),
    view: null,
    readResult: { ok: true, value: { path: 'README.md', content: '# Hi', fingerprint: 'v1' } },
    writeResult: { ok: true, value: { path: 'README.md', fingerprint: 'v2' } },
  }
  const read = vi.fn(() => {
    harness.reads += 1
    return Promise.resolve(harness.readResult)
  })
  const usePreviewTarget = (selector: (state: unknown) => unknown) =>
    selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  const panelElement = () => (
    <PreviewOverlay
      usePreviewTarget={usePreviewTarget as never}
      close={() => { store.set(null) }}
      read={read as never}
      write={harness.write as never}
      t={t as never}
    />
  )
  document.body.appendChild(harness.container)
  const root: Root = createRoot(harness.container)
  harness.setTarget({ sessionId: 'session-1', path: 'README.md' })
  await harness.rerender()
  await act(async () => { await Promise.resolve() })
  return harness
}

const byText = (harness: PanelHarness, text: string): HTMLButtonElement | undefined =>
  [...harness.container.querySelectorAll('button')]
    .find(button => button.textContent === text || button.getAttribute('aria-label') === text)

const click = async (harness: PanelHarness, text: string): Promise<void> => {
  const button = byText(harness, text)
  expect(button, `button "${text}"`).toBeDefined()
  await act(async () => { button!.click() })
  await act(async () => { await Promise.resolve() })
}

const enterEdit = async (harness: PanelHarness): Promise<void> => {
  await click(harness, 'panel.edit')
  const editorHost = harness.container.querySelector('.cm-editor')
  expect(editorHost).toBeTruthy()
  harness.view = EditorView.findFromDOM(editorHost as HTMLElement)
}

const typeInto = async (harness: PanelHarness, insertion: string): Promise<void> => {
  expect(harness.view, 'editor view captured').toBeTruthy()
  await act(async () => {
    harness.view!.dispatch({ changes: { from: 4, insert: insertion } })
  })
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('PreviewOverlay edit mode', () => {
  it('shows the plugin version beside the panel title', async () => {
    const harness = await renderPanel()
    // vitest runs from the project root; jsdom's URL global rejects file: bases.
    const version = JSON.parse(readFileSync('package.json', 'utf8')).version
    expect(harness.container.querySelector('.dsh-md-preview-version')?.textContent).toBe(`v${version}`)
  })

  it('opens at the default width and clamps drags to the configured bounds', async () => {
    const harness = await renderPanel()
    const panel = harness.container.querySelector<HTMLElement>('.dsh-md-preview-panel')
    expect(panel?.style.width).toBe('500px')
    const handle = harness.container.querySelector<HTMLElement>('.dsh-md-preview-handle')
    expect(handle).toBeTruthy()
    const dragTo = async (from: number, to: number): Promise<void> => {
      const down = new MouseEvent('pointerdown', { bubbles: true, clientX: from })
      Object.assign(down, { pointerId: 1 })
      await act(async () => { handle!.dispatchEvent(down) })
      const move = new MouseEvent('pointermove', { bubbles: true, clientX: to })
      Object.assign(move, { pointerId: 1 })
      await act(async () => {
        handle!.dispatchEvent(move)
        await new Promise(resolve => { setTimeout(resolve, 40) })
      })
      const up = new MouseEvent('pointerup', { bubbles: true, clientX: to })
      Object.assign(up, { pointerId: 1 })
      await act(async () => { handle!.dispatchEvent(up) })
    }
    // Dragging the left-edge handle leftward widens; far past the cap clamps to 1280.
    await dragTo(100, -1500)
    expect(harness.container.querySelector<HTMLElement>('.dsh-md-preview-panel')?.style.width).toBe('1280px')
  })

  it('enters edit mode from a loaded document', async () => {
    const harness = await renderPanel()
    await enterEdit(harness)
    expect(harness.container.querySelector('.cm-content')?.textContent).toContain('# Hi')
    expect(byText(harness, 'panel.save')).toBeDefined()
    expect(byText(harness, 'panel.cancel')).toBeDefined()
  })

  it('saves through write with the read fingerprint and returns to the view', async () => {
    const harness = await renderPanel()
    await enterEdit(harness)
    await typeInto(harness, ' there')
    await click(harness, 'panel.save')
    expect(harness.write).toHaveBeenCalledTimes(1)
    const [sessionId, path, content, fingerprint, force] = harness.write.mock.calls[0] as unknown[]
    expect(sessionId).toBe('session-1')
    expect(path).toBe('README.md')
    expect(content).toBe('# Hi there')
    expect(fingerprint).toBe('v1')
    expect(force).toBeFalsy()
    // Back in view mode: editor gone, content re-read from the workspace.
    expect(harness.container.querySelector('.cm-editor')).toBeNull()
    expect(harness.reads).toBe(2)
  })

  it('shows the conflict bar and force-overwrites on demand', async () => {
    const harness = await renderPanel()
    harness.writeResult = { ok: false, error: { code: 'md-preview/conflict', message: 'changed since read' } }
    await enterEdit(harness)
    await typeInto(harness, ' x')
    await click(harness, 'panel.save')
    expect(harness.container.textContent).toContain('panel.conflict.title')
    harness.writeResult = { ok: true, value: { path: 'README.md', fingerprint: 'v3' } }
    await click(harness, 'panel.conflict.force')
    expect(harness.write).toHaveBeenCalledTimes(2)
    const force = (harness.write.mock.calls[1] as unknown[])[4]
    expect(force).toBe(true)
    expect(harness.container.querySelector('.cm-editor')).toBeNull()
  })

  it('guards closing with unsaved changes', async () => {
    const harness = await renderPanel()
    await enterEdit(harness)
    await typeInto(harness, ' unsaved')
    await click(harness, 'panel.close')
    // Still open, with the unsaved guard instead of a silent drop.
    expect(harness.container.querySelector('.dsh-md-preview-panel')).toBeTruthy()
    expect(harness.container.textContent).toContain('panel.unsaved.title')
    await click(harness, 'panel.unsaved.discard')
    expect(harness.container.querySelector('.dsh-md-preview-panel')).toBeNull()
    expect(harness.write).not.toHaveBeenCalled()
  })

  it('cancel discards the draft without writing', async () => {
    const harness = await renderPanel()
    await enterEdit(harness)
    await typeInto(harness, ' draft')
    await click(harness, 'panel.cancel')
    expect(harness.container.querySelector('.cm-editor')).toBeNull()
    // Back on the rendered document: the heading is markup now, not source text.
    expect(harness.container.querySelector('.dsh-md-preview-body h1')?.textContent).toBe('Hi')
    expect(harness.write).not.toHaveBeenCalled()
  })

  it('flashes a saved toast after a successful save', async () => {
    vi.useFakeTimers()
    try {
      const harness = await renderPanel()
      await enterEdit(harness)
      await typeInto(harness, ' more')
      await click(harness, 'panel.save')
      const toast = harness.container.querySelector('.dsh-md-preview-toast')
      expect(toast?.getAttribute('role')).toBe('status')
      expect(toast?.textContent).toContain('panel.saved')
      await act(async () => { vi.advanceTimersByTime(2100) })
      expect(harness.container.querySelector('.dsh-md-preview-toast')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows a persistent error bar when the write fails for a non-conflict reason', async () => {
    const harness = await renderPanel()
    harness.writeResult = { ok: false, error: { code: 'md-preview/unavailable', message: 'disk on fire' } }
    await enterEdit(harness)
    await typeInto(harness, ' x')
    await click(harness, 'panel.save')
    // Still editing, with the failure spelled out and retryable.
    expect(harness.container.querySelector('.cm-editor')).toBeTruthy()
    const bar = harness.container.querySelector('.dsh-md-preview-bar[role="alert"]')
    expect(bar?.textContent).toContain('panel.saveError')
    expect(bar?.textContent).toContain('md-preview/unavailable')
    harness.writeResult = { ok: true, value: { path: 'README.md', fingerprint: 'v9' } }
    await click(harness, 'panel.save.retry')
    expect(harness.write).toHaveBeenCalledTimes(2)
    expect(harness.container.querySelector('.cm-editor')).toBeNull()
  })
})
