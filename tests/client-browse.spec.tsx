// @vitest-environment jsdom
/**
 * The browser face against the real component tree (fake list RPC): face
 * entry, lazy expansion with its three states, single-click preview, and the
 * tree's semantic structure.
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
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

interface BrowseHarness {
  container: HTMLElement
  list: ReturnType<typeof vi.fn>
  reads: Array<{ path: string }>
  setTarget: (target: { sessionId: string; path: string } | null) => void
  rerender: () => Promise<void>
}

interface ListScript {
  entries: MdPreviewEntry[]
  pending?: boolean
  fail?: boolean
}

async function renderBrowse(script: Map<string, ListScript>): Promise<BrowseHarness> {
  const store = createPreviewStore()
  const harness: BrowseHarness = {
    container: document.createElement('div'),
    list: vi.fn((_sessionId: string, path: string) => {
      const page = script.get(path) ?? { entries: [] }
      if (page.fail) {
        return Promise.resolve({ ok: false as const, error: { code: 'md-preview/unavailable', message: 'boom' } })
      }
      if (page.pending) return new Promise(() => {})
      return Promise.resolve({ ok: true as const, value: { path, entries: page.entries } satisfies MdPreviewListResult })
    }),
    reads: [],
    setTarget: target => { store.set(target as never) },
    rerender: () => act(async () => { root.render(panelElement()) }),
  }
  const usePreviewTarget = (selector: (state: unknown) => unknown) =>
    selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  const panelElement = () => (
    <PreviewOverlay
      usePreviewTarget={usePreviewTarget as never}
      close={() => { store.set(null) }}
      read={((sessionId: string, path: string) => {
        harness.reads.push({ path })
        return Promise.resolve({ ok: true, value: { path, content: `# ${path}`, fingerprint: 'v1' } satisfies MdPreviewFile })
      }) as never}
      write={vi.fn(() => Promise.resolve({ ok: true, value: { path: 'x', fingerprint: 'v2' } })) as never}
      list={harness.list as never}
      setTarget={harness.setTarget as never}
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

const buttonByLabel = (harness: BrowseHarness, label: string) =>
  [...harness.container.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === label || button.textContent === label)

const click = async (harness: BrowseHarness, label: string): Promise<void> => {
  const button = buttonByLabel(harness, label)
  expect(button, `button "${label}"`).toBeDefined()
  await act(async () => { button!.click() })
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

const flush = async (): Promise<void> => {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

const enterBrowse = async (harness: BrowseHarness): Promise<void> => {
  await click(harness, 'browse.open')
  await flush()
  expect(harness.container.querySelector('[role="tree"]')).toBeTruthy()
}

afterEach(() => { document.body.replaceChildren() })

describe('browser face connectivity', () => {
  it('highlights the current target, auto-reveals its ancestors, and keeps expansion across face switches', async () => {
    const harness = await renderBrowse(new Map([
      ['', { entries: [
        { name: 'docs', type: 'directory', path: 'docs' },
        { name: 'README.md', type: 'file', path: 'README.md' },
      ] }],
      ['docs', { entries: [{ name: 'guide.md', type: 'file', path: 'docs/guide.md' }] }],
    ]))
    // Open a nested document from outside the tree (chip-style).
    harness.setTarget({ sessionId: 'session-1', path: 'docs/guide.md' })
    await flush()
    await enterBrowse(harness)
    await flush()
    // The ancestor auto-revealed and the current file carries aria-current.
    const current = harness.container.querySelector<HTMLElement>('[aria-current="true"]')
    expect(current?.textContent).toContain('guide.md')
    // Switch to another file through the tree, come back: expansion survives
    // and the highlight followed the new target.
    const readme = [...harness.container.querySelectorAll<HTMLElement>('[role="treeitem"] .dsh-md-preview-treerow')]
      .find(node => node.textContent === 'README.md')!
    await act(async () => { readme.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await flush()
    await enterBrowse(harness)
    await flush()
    expect(harness.container.querySelector('[data-expander="docs"]')?.closest('[aria-expanded="true"]')).toBeTruthy()
    const next = harness.container.querySelector<HTMLElement>('[aria-current="true"]')
    expect(next?.textContent).toContain('README.md')
  })

  it('lets a collapsed, still-loading ancestor inherit the selection', async () => {
    const harness = await renderBrowse(new Map([
      ['', { entries: [{ name: 'docs', type: 'directory', path: 'docs' }] }],
      ['docs', { entries: [], pending: true }],
    ]))
    harness.setTarget({ sessionId: 'session-1', path: 'docs/guide.md' })
    await flush()
    await enterBrowse(harness)
    // The auto-reveal request for docs is pending: while collapsed-loading,
    // the directory inherits the selection so context is not lost.
    const docs = harness.container.querySelector<HTMLElement>('[data-expander="docs"]')?.closest<HTMLElement>('[role="treeitem"]')
    expect(docs?.getAttribute('aria-expanded')).toBe('true')
    expect(docs?.getAttribute('aria-selected')).toBe('true')
  })
})

describe('browser face', () => {
  it('enters the browse face from the panel header and renders the root, folders first', async () => {
    const harness = await renderBrowse(new Map([
      ['', { entries: [
        { name: 'docs', type: 'directory', path: 'docs' },
        { name: 'notes', type: 'directory', path: 'notes' },
        { name: 'README.md', type: 'file', path: 'README.md' },
      ] }],
    ]))
    await enterBrowse(harness)
    const names = [...harness.container.querySelectorAll<HTMLElement>('[role="treeitem"]')].map(node => node.textContent)
    // The host sorts folders first; the face renders the listing verbatim.
    expect(names).toEqual(['docs', 'notes', 'README.md'])
  })

  it('expands a directory lazily through its caret, with a loading placeholder', async () => {
    const harness = await renderBrowse(new Map([
      ['', { entries: [{ name: 'docs', type: 'directory', path: 'docs' }] }],
      ['docs', { entries: [{ name: 'guide.md', type: 'file', path: 'docs/guide.md' }], pending: true }],
    ]))
    await enterBrowse(harness)
    const caret = harness.container.querySelector('[data-expander="docs"]')
    expect(caret).toBeTruthy()
    await act(async () => { caret!.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(harness.list).toHaveBeenCalledWith('session-1', 'docs', expect.anything())
    expect(harness.container.textContent).toContain('browse.loading')
    harness.container.remove()
  })

  it('shows resolved children, an empty hint, and a retryable error', async () => {
    const script = new Map<string, ListScript>([
      ['', { entries: [
        { name: 'docs', type: 'directory', path: 'docs' },
        { name: 'empty', type: 'directory', path: 'empty' },
        { name: 'broken', type: 'directory', path: 'broken' },
      ] }],
      ['docs', { entries: [{ name: 'guide.md', type: 'file', path: 'docs/guide.md' }] }],
      ['empty', { entries: [] }],
      ['broken', { entries: [], fail: true }],
    ])
    const harness = await renderBrowse(script)
    await enterBrowse(harness)
    for (const dir of ['docs', 'empty', 'broken']) {
      const caret = harness.container.querySelector(`[data-expander="${dir}"]`)!
      await act(async () => { caret.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
      await flush()
    }
    expect(harness.container.querySelector('[role="group"] [role="treeitem"]')?.textContent).toContain('guide.md')
    expect(harness.container.textContent).toContain('browse.empty')
    expect(harness.container.textContent).toContain('browse.error')
    script.set('broken', { entries: [{ name: 'fixed.md', type: 'file', path: 'broken/fixed.md' }] })
    await click(harness, 'browse.retry')
    expect(harness.container.textContent).toContain('fixed.md')
  })

  it('single-clicking a file previews it: back to the document face with the target set', async () => {
    const harness = await renderBrowse(new Map([
      ['', { entries: [
        { name: 'docs', type: 'directory', path: 'docs' },
        { name: 'README.md', type: 'file', path: 'README.md' },
      ] }],
      ['docs', { entries: [{ name: 'guide.md', type: 'file', path: 'docs/guide.md' }] }],
    ]))
    await enterBrowse(harness)
    const caret = harness.container.querySelector('[data-expander="docs"]')!
    await act(async () => { caret.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await act(async () => { await Promise.resolve() })
    const file = [...harness.container.querySelectorAll<HTMLElement>('[role="treeitem"] .dsh-md-preview-treerow')]
      .find(node => node.textContent === 'guide.md')!
    await act(async () => { file.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await flush()
    // Back on the document face: the tree stays mounted but hidden (its
    // expansion state survives), and the new target is being read.
    expect(harness.container.querySelector('.dsh-md-preview-browser')?.hasAttribute('hidden')).toBe(true)
    expect(harness.container.querySelector('.dsh-md-preview-document')?.hasAttribute('hidden')).toBe(false)
    expect(harness.reads.at(-1)).toEqual({ path: 'docs/guide.md' })
    expect(harness.container.querySelector('.dsh-md-preview-title')?.textContent).toContain('guide.md')
  })

  it('carries the tree semantics: tree/treeitem/group with level and expanded', async () => {
    const harness = await renderBrowse(new Map([
      ['', { entries: [{ name: 'docs', type: 'directory', path: 'docs' }] }],
      ['docs', { entries: [{ name: 'guide.md', type: 'file', path: 'docs/guide.md' }] }],
    ]))
    await enterBrowse(harness)
    const tree = harness.container.querySelector('[role="tree"]')
    expect(tree).toBeTruthy()
    const dir = harness.container.querySelector<HTMLElement>('[role="treeitem"][aria-level="1"]')!
    expect(dir.getAttribute('aria-expanded')).toBe('false')
    const caret = harness.container.querySelector('[data-expander="docs"]')!
    await act(async () => { caret.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await flush()
    expect(dir.getAttribute('aria-expanded')).toBe('true')
    const child = harness.container.querySelector<HTMLElement>('[role="group"] [role="treeitem"]')
    expect(child?.getAttribute('aria-level')).toBe('2')
  })
})
