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
import type { MdPreviewFile } from '../src/protocol.ts'

const t = (key: string) => key

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

interface HeaderHarness {
  container: HTMLElement
  rerender: () => Promise<void>
}

async function renderHeaderPanel(content: string, path = 'docs/guide.md'): Promise<HeaderHarness> {
  const store = createPreviewStore()
  const readResult: { ok: true; value: MdPreviewFile } = { ok: true, value: { path, content, fingerprint: 'v1' } }
  const harness: HeaderHarness = {
    container: document.createElement('div'),
    rerender: () => act(async () => { root.render(panelElement()) }),
  }
  const usePreviewTarget = (selector: (state: unknown) => unknown) =>
    selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  const panelElement = () => (
    <PreviewOverlay
      usePreviewTarget={usePreviewTarget as never}
      close={() => { store.set(null) }}
      read={(() => Promise.resolve(readResult)) as never}
      write={(vi.fn(() => Promise.resolve({ ok: true, value: { path, fingerprint: 'v2' } }))) as never}
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
})
