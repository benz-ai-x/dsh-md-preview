// @vitest-environment jsdom
/**
 * Panel edit mode against the real component tree (real CodeMirror, real
 * snapshot store; read/write RPCs stubbed at the injected seam): edit entry,
 * guarded save, conflict round-trip, unsaved-close guard, and cancel.
 */

import { useSyncExternalStore } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { closeSearchPanel, SearchQuery, setSearchQuery } from '@codemirror/search'
import { EditorView, keymap } from '@codemirror/view'
import { readFileSync } from 'node:fs'
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import { PreviewOverlay } from '../src/client/PreviewOverlay.tsx'
import { createPreviewStore } from '../src/client/preview-state.ts'
import { createLeaveIntentSeat } from '../src/client/leave-intent.ts'
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
  // jsdom ships no layout either: CM's measure pass reads Range.getClientRects,
  // and an orphaned rAF after a test would surface it as an unhandled error.
  ;(Range.prototype as unknown as { getClientRects?: () => [] }).getClientRects ??= () => []
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  // A wide viewport: the default 720 open keeps the full header action row;
  // compact-width behavior is covered where it is the subject (#22).
  Object.defineProperty(window, 'innerWidth', { value: 1928, configurable: true })
})

interface PanelHarness {
  container: HTMLElement
  reads: number
  write: ReturnType<typeof vi.fn>
  /** Mutable write behavior; defaults to resolving `writeResult`. */
  writeImpl: (args: unknown[]) => Promise<{ ok: true; value: MdPreviewWriteResult } | { ok: false; error: { code: string; message: string } }>
  setTarget: (target: { sessionId: string; path: string } | null) => void
  rerender: () => Promise<void>
  view: { dispatch: (spec: unknown) => void } | null
  readResult: { ok: true; value: MdPreviewFile } | { ok: false; error: { code: string; message: string } }
  writeResult: { ok: true; value: MdPreviewWriteResult } | { ok: false; error: { code: string; message: string } }
}

async function renderPanel(): Promise<PanelHarness> {
  const store = createPreviewStore()
  const leave = createLeaveIntentSeat()
  const harness: PanelHarness = {
    container: document.createElement('div'),
    reads: 0,
    write: vi.fn((...args: unknown[]) => harness.writeImpl(args)),
    writeImpl: () => Promise.resolve(harness.writeResult),
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
      leave={leave}
      close={() => { store.set(null) }}
      read={read as never}
      write={harness.write as never}
      list={vi.fn(() => Promise.resolve({ ok: true as const, value: { path: '', entries: [] } })) as never}
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
  it('folds the plugin version into the crumbs tooltip', async () => {
    const harness = await renderPanel()
    // vitest runs from the project root; jsdom's URL global rejects file: bases.
    const version = JSON.parse(readFileSync('package.json', 'utf8')).version
    const crumbs = harness.container.querySelector('.dsh-md-preview-crumbs') as HTMLElement
    expect(crumbs.getAttribute('title')).toContain(`v${version}`)
    expect(harness.container.querySelector('.dsh-md-preview-version')).toBeNull()
  })

  it('enters edit mode from a loaded document', async () => {
    const harness = await renderPanel()
    await enterEdit(harness)
    expect(harness.container.querySelector('.cm-content')?.textContent).toContain('# Hi')
    expect(byText(harness, 'panel.save')).toBeDefined()
    expect(byText(harness, 'panel.view')).toBeDefined()
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

  it('switching to the preview discards the draft through the guard without writing', async () => {
    const harness = await renderPanel()
    await enterEdit(harness)
    await typeInto(harness, ' draft')
    await click(harness, 'panel.view')
    await click(harness, 'panel.unsaved.discard')
    expect(harness.container.querySelector('.cm-editor')).toBeNull()
    // Back on the rendered document: the heading is markup now, not source text.
    expect(harness.container.querySelector('.dsh-md-preview-body h1')?.textContent).toBe('Hi')
    expect(harness.write).not.toHaveBeenCalled()
  })

  it('recovers when the preview target changes during an in-flight save', async () => {
    const harness = await renderPanel()
    let resolveFirst!: (value: { ok: true; value: MdPreviewWriteResult }) => void
    harness.writeImpl = () => new Promise(resolve => { resolveFirst = resolve })
    await enterEdit(harness)
    await typeInto(harness, ' more')
    await click(harness, 'panel.save')
    expect(harness.write).toHaveBeenCalledTimes(1)
    // Switch documents while the save is still in flight; the panel stays mounted.
    harness.setTarget({ sessionId: 'session-1', path: 'OTHER.md' })
    await act(async () => { await Promise.resolve() })
    resolveFirst({ ok: true, value: { path: 'OTHER.md', fingerprint: 'v9' } })
    await act(async () => { await Promise.resolve() })
    // The next document's edit session must be able to save at all.
    await enterEdit(harness)
    await typeInto(harness, ' next')
    harness.writeImpl = () => Promise.resolve({ ok: true, value: { path: 'OTHER.md', fingerprint: 'v10' } })
    await click(harness, 'panel.save')
    expect(harness.write).toHaveBeenCalledTimes(2)
  })

  it('does not carry the saved toast across a target change', async () => {
    const harness = await renderPanel()
    await enterEdit(harness)
    await typeInto(harness, ' more')
    await click(harness, 'panel.save')
    expect(harness.container.querySelector('.dsh-md-preview-toast')).toBeTruthy()
    harness.setTarget({ sessionId: 'session-1', path: 'OTHER.md' })
    await act(async () => { await Promise.resolve() })
    expect(harness.container.querySelector('.dsh-md-preview-toast')).toBeNull()
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

describe('editor find', () => {
  it('opens the CodeMirror search panel from the header action', async () => {
    const harness = await renderPanel()
    await enterEdit(harness)
    const find = byText(harness, 'panel.find')
    expect(find).toBeDefined()
    await act(async () => { find!.click() })
    await act(async () => { await Promise.resolve() })
    const input = harness.container.querySelector<HTMLInputElement>('.cm-panel.cm-search input')
    expect(input).toBeTruthy()
  })
  it('offers no find action outside the edit face', async () => {
    const harness = await renderPanel()
    expect(byText(harness, 'panel.find')).toBeUndefined()
  })
})

async function renderFindPanel(content: string): Promise<PanelHarness> {
  const store = createPreviewStore()
  const leave = createLeaveIntentSeat()
  const harness: PanelHarness = {
    container: document.createElement('div'),
    reads: 0,
    write: vi.fn(() => Promise.resolve({ ok: true, value: { path: 'README.md', fingerprint: 'v2' } })),
    writeImpl: () => Promise.resolve({ ok: true as const, value: { path: 'README.md', fingerprint: 'v2' } }),
    setTarget: target => { store.set(target as never) },
    rerender: () => act(async () => { root.render(panelElement()) }),
    view: null,
    readResult: { ok: true, value: { path: 'README.md', content, fingerprint: 'v1' } },
    writeResult: { ok: true, value: { path: 'README.md', fingerprint: 'v2' } },
  }
  const usePreviewTarget = (selector: (state: unknown) => unknown) =>
    selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  const panelElement = () => (
    <PreviewOverlay
      usePreviewTarget={usePreviewTarget as never}
      leave={leave}
      close={() => { store.set(null) }}
      read={() => Promise.resolve(harness.readResult) as never}
      write={harness.write as never}
      list={vi.fn(() => Promise.resolve({ ok: true as const, value: { path: '', entries: [] } })) as never}
      setTarget={vi.fn() as never}
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

describe('find count', () => {
  it('reports match count and current index while the search panel is open', async () => {
    const harness = await renderFindPanel('foo bar\nfoo\nbaz')
    await click(harness, 'panel.edit')
    await click(harness, 'panel.find')
    const host = harness.container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(host)!
    await act(async () => {
      view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: 'foo' })) })
    })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(harness.container.querySelector('.dsh-md-preview-statusbar .dsh-md-preview-findcount')?.textContent).toBe('find.status · 1/2')
    await act(async () => {
      view.dispatch({ selection: { anchor: view.state.doc.line(2).from + 1 } })
    })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(harness.container.querySelector('.dsh-md-preview-statusbar .dsh-md-preview-findcount')?.textContent).toBe('find.status · 2/2')
  })

  it('clears the count when the panel closes', async () => {
    const harness = await renderFindPanel('foo bar\nfoo')
    await click(harness, 'panel.edit')
    await click(harness, 'panel.find')
    const host = harness.container.querySelector('.cm-editor') as HTMLElement
    const view = EditorView.findFromDOM(host)!
    await act(async () => { closeSearchPanel(view) })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(harness.container.querySelector('.dsh-md-preview-findcount')).toBeNull()
  })
})

describe('edit status bar and history buttons (#15)', () => {
  it('reports Ln/Col and the character count live', async () => {
    const harness = await renderPanel()
    await enterEdit(harness)
    const bar = harness.container.querySelector('.dsh-md-preview-statusbar') as HTMLElement
    expect(bar).toBeTruthy()
    expect(bar.textContent).toContain('Ln 1, Col 1')
    await act(async () => {
      harness.view!.dispatch({
        changes: { from: 4, insert: ' there' },
        selection: { anchor: 10 },
      })
    })
    await act(async () => { await Promise.resolve() })
    expect(bar.textContent).toContain('status.chars')
    // anchor 10 in "# Hi there" is line 1, column 11 (exact, not substring).
    expect(bar.querySelector('span')?.textContent).toBe('Ln 1, Col 11')
  })

  it('undoes and redoes from the header buttons with disabled states', async () => {
    const harness = await renderPanel()
    await enterEdit(harness)
    const undoBtn = () => harness.container.querySelector('button[aria-label="panel.undo"]') as HTMLButtonElement
    const redoBtn = () => harness.container.querySelector('button[aria-label="panel.redo"]') as HTMLButtonElement
    expect(undoBtn().disabled).toBe(true)
    expect(redoBtn().disabled).toBe(true)
    await typeInto(harness, ' there')
    expect(undoBtn().disabled).toBe(false)
    await click(harness, 'panel.undo')
    expect(harness.container.querySelector('.cm-content')?.textContent).not.toContain('there')
    expect(redoBtn().disabled).toBe(false)
    await click(harness, 'panel.redo')
    expect(harness.container.querySelector('.cm-content')?.textContent).toContain('there')
  })

  it('keeps the saved time resident after the toast fades', async () => {
    const harness = await renderPanel()
    await enterEdit(harness)
    const bar = harness.container.querySelector('.dsh-md-preview-statusbar') as HTMLElement
    expect(bar.textContent).toContain('status.clean')
    await typeInto(harness, ' there')
    expect(bar.textContent).toContain('status.unsaved')
    await click(harness, 'panel.save')
    // Saving returns to the view face (the statusbar unmounts with the
    // editor); re-entering edit shows the resident saved stamp for the
    // same target — it outlives the 2s toast.
    await enterEdit(harness)
    const barAgain = harness.container.querySelector('.dsh-md-preview-statusbar') as HTMLElement
    expect(barAgain.textContent).toContain('status.saved')
    expect(barAgain.textContent).toMatch(/\d{2}:\d{2}/)
  })
})

describe('markup keymaps and the key help popover (#16)', () => {
  const pressKey = async (harness: PanelHarness, init: KeyboardEventInit, on: HTMLElement): Promise<void> => {
    await act(async () => { on.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init })) })
    await act(async () => { await Promise.resolve() })
  }

  it('binds Mod-B/I/K and wraps selections (empty selections get pairs)', async () => {
    const harness = await renderPanel()
    await enterEdit(harness)
    // CM ignores synthetic key events under jsdom (its key path needs real
    // focus/layout), so the binding is exercised through the public keymap
    // facet: the key must be bound, and its command must wrap. Real-key
    // delivery rides the browser walkthrough checklist (#18).
    const view = EditorView.findFromDOM(harness.container.querySelector('.cm-editor') as HTMLElement)!
    const binding = (key: string) => view.state.facet(keymap).flat().find(b => b.key === key)
    expect(binding('Mod-b')).toBeDefined()
    expect(binding('Mod-i')).toBeDefined()
    expect(binding('Mod-k')).toBeDefined()
    // The key help opens from inside the editor via its command form (#16 fix).
    expect(binding('Mod-/')).toBeDefined()
    // Select "Hi" (offsets 2–4 in "# Hi").
    await act(async () => { view.dispatch({ selection: { anchor: 2, head: 4 } }) })
    await act(async () => { binding('Mod-b')!.run!(view) })
    expect(view.state.doc.toString()).toBe('# **Hi**')
    // Undo reverts the wrap (history consistency).
    await act(async () => { binding('Mod-z')!.run!(view) })
    expect(view.state.doc.toString()).toBe('# Hi')
    // Empty selection inserts an empty marker pair with the cursor inside.
    await act(async () => { view.dispatch({ selection: { anchor: 4 } }) })
    await act(async () => { binding('Mod-i')!.run!(view) })
    expect(view.state.doc.toString()).toBe('# Hi**')
    expect(view.state.selection.main.head).toBe(5)
  })

  it('opens the key help from the button and ?, and closes on Esc', async () => {
    const harness = await renderPanel()
    await enterEdit(harness)
    const pop = () => harness.container.querySelector('.dsh-md-preview-keypop')
    expect(pop()).toBeNull()
    await click(harness, 'panel.keys')
    expect(pop()).toBeTruthy()
    expect(pop()!.textContent).toContain('Mod-B')
    expect(pop()!.textContent).toContain('keys.bold')
    await pressKey(harness, { key: 'Escape' }, harness.container.querySelector('.dsh-md-preview-panel') as HTMLElement)
    expect(pop()).toBeNull()
    // '?' outside the editor toggles it; inside the editor it must type.
    const panel = harness.container.querySelector('.dsh-md-preview-panel') as HTMLElement
    await pressKey(harness, { key: '?' }, panel)
    expect(pop()).toBeTruthy()
    const content = harness.container.querySelector('.cm-content') as HTMLElement
    await pressKey(harness, { key: 'Escape' }, panel)
    await pressKey(harness, { key: '?' }, content)
    expect(pop()).toBeNull()
    expect(harness.view!.state.doc.toString()).not.toContain('?')
  })
})

describe('inline-HTML warning bar (#17)', () => {
  async function renderWith(content: string): Promise<PanelHarness> {
    const harness = await renderPanel()
    harness.readResult = { ok: true, value: { path: 'README.md', content, fingerprint: 'v1' } }
    // Force a re-read of the (mutated) result: a fresh target read.
    harness.setTarget({ sessionId: 'session-1', path: 'README.md' })
    await harness.rerender()
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    return harness
  }

  it('warns for inline HTML once per edit session and returns on re-entry', async () => {
    const harness = await renderWith('# Hi\n\n<div align="center">x</div>\n')
    const bar = () => harness.container.querySelector('.dsh-md-preview-warnbar')
    expect(bar()).toBeNull()
    await enterEdit(harness)
    expect(bar()).toBeTruthy()
    expect(bar()!.textContent).toContain('warn.html')
    await act(async () => {
      (bar()!.querySelector('button[aria-label="warn.dismiss"]') as HTMLElement).click()
    })
    await act(async () => { await Promise.resolve() })
    expect(bar()).toBeNull()
    // Dismissed for this session; leaving and re-entering edit shows it again.
    await click(harness, 'panel.view')
    await click(harness, 'panel.edit')
    expect(bar()).toBeTruthy()
  })

  it('stays silent without inline HTML', async () => {
    const harness = await renderWith('# plain markdown only\n')
    await enterEdit(harness)
    expect(harness.container.querySelector('.dsh-md-preview-warnbar')).toBeNull()
  })
})

describe('save feedback and request isolation (#23)', () => {
  it('shows one in-flight save and refuses a second submission', async () => {
    const harness = await renderPanel()
    let resolveWrite!: (value: { ok: true; value: MdPreviewWriteResult }) => void
    harness.writeImpl = () => new Promise(resolve => { resolveWrite = resolve })
    await enterEdit(harness)
    await typeInto(harness, ' once')
    await click(harness, 'panel.save')
    expect(harness.write).toHaveBeenCalledTimes(1)
    // In flight: the button reports busy and declines a repeat click…
    const saveButton = byText(harness, 'panel.save')!
    expect(saveButton.getAttribute('aria-busy')).toBe('true')
    expect(saveButton.disabled).toBe(true)
    expect(harness.container.querySelector('.dsh-md-preview-statusbar')?.textContent).toContain('status.saving')
    await act(async () => { saveButton.click() })
    expect(harness.write).toHaveBeenCalledTimes(1)
    resolveWrite({ ok: true, value: { path: 'README.md', fingerprint: 'v2' } })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(harness.container.querySelector('.cm-editor')).toBeNull()
  })

  it('saves through the editor keymap with the same single-submission guard', async () => {
    const harness = await renderPanel()
    let resolveWrite!: (value: { ok: true; value: MdPreviewWriteResult }) => void
    harness.writeImpl = () => new Promise(resolve => { resolveWrite = resolve })
    await enterEdit(harness)
    await typeInto(harness, ' key')
    const view = EditorView.findFromDOM(harness.container.querySelector('.cm-editor') as HTMLElement)!
    const binding = view.state.facet(keymap).flat().find(b => b.key === 'Mod-s')
    expect(binding).toBeDefined()
    await act(async () => { binding!.run!(view) })
    expect(harness.write).toHaveBeenCalledTimes(1)
    // The same in-flight feedback the button path shows.
    expect(harness.container.querySelector('.dsh-md-preview-statusbar')?.textContent).toContain('status.saving')
    resolveWrite({ ok: true, value: { path: 'README.md', fingerprint: 'v2' } })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(harness.container.querySelector('.cm-editor')).toBeNull()
  })

  it('separates a successful write from its failed re-read and retries the read', async () => {
    const harness = await renderPanel()
    await enterEdit(harness)
    await typeInto(harness, ' more')
    // The initial read already resolved; from here the seam reads the
    // failure, so the post-save confirming re-read fails while the write
    // itself succeeded.
    harness.readResult = { ok: false, error: { code: 'md-preview/unavailable', message: 'disk busy' } }
    await click(harness, 'panel.save')
    // Distinguished: the save is acknowledged AND the read failure is spelled
    // out as a read failure with a retry — never a write failure, never the
    // stale pre-save body.
    expect(harness.container.querySelector('.dsh-md-preview-toast')?.textContent).toContain('panel.saved')
    expect(harness.container.textContent).toContain('panel.saved.readFailed')
    expect(harness.container.textContent).toContain('md-preview/unavailable')
    expect(harness.container.querySelector('.dsh-md-preview-body h1')).toBeNull()
    // Read retry succeeds: the fresh content (the written draft) shows.
    harness.readResult = { ok: true, value: { path: 'README.md', content: '# Hi more', fingerprint: 'v3' } }
    await click(harness, 'panel.retry')
    expect(harness.container.querySelector('.dsh-md-preview-body h1')?.textContent).toBe('Hi more')
    expect(harness.write).toHaveBeenCalledTimes(1)
  })

  it('a late save resolution after an approved close changes nothing', async () => {
    const harness = await renderPanel()
    let resolveWrite!: (value: { ok: true; value: MdPreviewWriteResult }) => void
    harness.writeImpl = () => new Promise(resolve => { resolveWrite = resolve })
    await enterEdit(harness)
    await typeInto(harness, ' doomed')
    await click(harness, 'panel.save')
    expect(harness.write).toHaveBeenCalledTimes(1)
    // The guard approves the close while the save is in flight.
    await click(harness, 'panel.close')
    await click(harness, 'panel.unsaved.discard')
    expect(harness.container.querySelector('.dsh-md-preview-panel')).toBeNull()
    resolveWrite({ ok: true, value: { path: 'README.md', fingerprint: 'v9' } })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    // Nothing resurrects: no panel, no toast, no error surface.
    expect(harness.container.querySelector('.dsh-md-preview-panel')).toBeNull()
    expect(harness.container.querySelector('.dsh-md-preview-toast')).toBeNull()
  })

  it('a late save resolution after a switch leaves the successor untouched', async () => {
    const harness = await renderPanel()
    let resolveFirst!: (value: { ok: true; value: MdPreviewWriteResult }) => void
    harness.writeImpl = () => new Promise(resolve => { resolveFirst = resolve })
    await enterEdit(harness)
    await typeInto(harness, ' stale')
    await click(harness, 'panel.save')
    harness.setTarget({ sessionId: 'session-1', path: 'OTHER.md' })
    await act(async () => { await Promise.resolve() })
    resolveFirst({ ok: true, value: { path: 'README.md', fingerprint: 'v9' } })
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    // The successor document carries no toast, no error, no saving state.
    expect(harness.container.querySelector('.dsh-md-preview-toast')).toBeNull()
    expect(harness.container.textContent).not.toContain('panel.saveError')
    expect(harness.container.textContent).not.toContain('panel.conflict.title')
    // And its own edit session can still save.
    await enterEdit(harness)
    await typeInto(harness, ' next')
    harness.writeImpl = () => Promise.resolve({ ok: true, value: { path: 'OTHER.md', fingerprint: 'v10' } })
    await click(harness, 'panel.save')
    expect(harness.write).toHaveBeenCalledTimes(2)
  })

  it('maps a transport rejection to a retryable failure and keeps the draft', async () => {
    const harness = await renderPanel()
    harness.writeImpl = () => Promise.reject(new Error('transport boom'))
    await enterEdit(harness)
    await typeInto(harness, ' x')
    await click(harness, 'panel.save')
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    // The draft stays; the failure is spelled out with its stable code.
    expect(harness.container.querySelector('.cm-editor')).toBeTruthy()
    const bar = harness.container.querySelector('.dsh-md-preview-bar[role="alert"]')
    expect(bar?.textContent).toContain('panel.saveError')
    expect(bar?.textContent).toContain('md-preview/unavailable')
    expect(harness.container.querySelector('.dsh-md-preview-statusbar')?.textContent).toContain('status.saveFailed')
    harness.writeImpl = () => Promise.resolve({ ok: true, value: { path: 'README.md', fingerprint: 'v9' } })
    await click(harness, 'panel.save.retry')
    expect(harness.container.querySelector('.cm-editor')).toBeNull()
  })

  it('spells out the conflict consequences beside the two choices', async () => {
    const harness = await renderPanel()
    harness.writeResult = { ok: false, error: { code: 'md-preview/conflict', message: 'changed since read' } }
    await enterEdit(harness)
    await typeInto(harness, ' x')
    await click(harness, 'panel.save')
    const bar = harness.container.querySelector('.dsh-md-preview-bar[role="alert"]')
    expect(bar?.textContent).toContain('panel.conflict.title')
    expect(bar?.textContent).toContain('panel.conflict.hint')
    expect(bar?.textContent).toContain('panel.conflict.reload')
    expect(bar?.textContent).toContain('panel.conflict.force')
  })

  it('discards the draft and re-reads the workspace from the conflict reload', async () => {
    const harness = await renderPanel()
    harness.writeResult = { ok: false, error: { code: 'md-preview/conflict', message: 'changed since read' } }
    await enterEdit(harness)
    await typeInto(harness, ' keep-or-discard')
    await click(harness, 'panel.save')
    expect(harness.write).toHaveBeenCalledTimes(1)
    expect(harness.container.textContent).toContain('panel.conflict.title')
    const readsBefore = harness.reads
    await click(harness, 'panel.conflict.reload')
    // 重新加载 discards the draft (the edit face closes), re-reads the
    // workspace body once, and never issues a second write.
    expect(harness.container.querySelector('.cm-editor')).toBeNull()
    expect(harness.container.querySelector('.dsh-md-preview-body h1')?.textContent).toBe('Hi')
    expect(harness.reads).toBe(readsBefore + 1)
    expect(harness.write).toHaveBeenCalledTimes(1)
    expect(harness.container.textContent).not.toContain('panel.conflict.title')
  })
})
