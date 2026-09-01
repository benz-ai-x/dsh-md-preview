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
    list: vi.fn((sessionId: string, path: string) => {
      const page = script.get(`${sessionId}:${path}`) ?? script.get(path) ?? { entries: [] }
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
        if (/\.(md|markdown)$/.test(path)) {
          return Promise.resolve({ ok: true as const, value: { path, content: `# ${path}`, fingerprint: 'v1' } satisfies MdPreviewFile })
        }
        if (/\.txt$/.test(path)) {
          return Promise.resolve({ ok: true as const, value: { path, content: `plain:${path}`, fingerprint: 'v1' } satisfies MdPreviewFile })
        }
        return Promise.resolve({ ok: false as const, error: { code: 'md-preview/unsupported-extension', message: `refuses "${path}"` } })
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

describe('preview rendering by type', () => {
  const TREE = new Map([
    ['', { entries: [
      { name: 'notes.txt', type: 'file', path: 'notes.txt' },
      { name: 'logo.bin', type: 'file', path: 'logo.bin' },
      { name: 'run.md', type: 'file', path: 'run.md' },
    ] }],
  ])

  const openFile = async (harness: BrowseHarness, name: string): Promise<void> => {
    await enterBrowse(harness)
    const row = [...harness.container.querySelectorAll<HTMLElement>('[role="treeitem"] .dsh-md-preview-treerow')]
      .find(node => node.textContent === name)!
    await act(async () => { row.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await flush()
  }

  it('renders a text file as plain monospace text with no edit action', async () => {
    const harness = await renderBrowse(TREE)
    await openFile(harness, 'notes.txt')
    const plain = harness.container.querySelector('pre.dsh-md-preview-plaintext')
    expect(plain?.textContent).toContain('plain:notes.txt')
    expect(buttonByLabel(harness, 'panel.edit')).toBeUndefined()
  })

  it('renders a markdown file with the rich renderer and an edit action', async () => {
    const harness = await renderBrowse(TREE)
    await openFile(harness, 'run.md')
    expect(harness.container.querySelector('pre.dsh-md-preview-plaintext')).toBeNull()
    expect(harness.container.querySelector('.dsh-md-preview-body h1')?.textContent).toContain('run.md')
    expect(buttonByLabel(harness, 'panel.edit')).toBeDefined()
  })

  it('lands a non-previewable file on the unsupported state with its own copy', async () => {
    const harness = await renderBrowse(TREE)
    await openFile(harness, 'logo.bin')
    expect(harness.container.textContent).toContain('panel.unsupported')
    expect(harness.container.textContent).toContain('md-preview/unsupported-extension')
    expect(harness.container.textContent).not.toContain('panel.error')
  })
})

describe('session switch', () => {
  it('resets the tree when the owning session changes', async () => {
    const script = new Map<string, ListScript>([
      ['session-1:docs', { entries: [{ name: 'old.md', type: 'file', path: 'docs/old.md' }] }],
      ['session-2:', { entries: [{ name: 'fresh.md', type: 'file', path: 'fresh.md' }] }],
    ])
    const harness = await renderBrowse(new Map([
      ['', { entries: [{ name: 'docs', type: 'directory', path: 'docs' }] }],
      ['docs', { entries: [{ name: 'old.md', type: 'file', path: 'docs/old.md' }] }],
    ]))
    await enterBrowse(harness)
    const caret = harness.container.querySelector('[data-expander="docs"]')!
    await act(async () => { caret.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await flush()
    expect(harness.container.textContent).toContain('old.md')
    // Retarget the panel to another session's document: the tree must not
    // keep the old session's expansion content.
    harness.setTarget({ sessionId: 'session-2', path: 'fresh.md' })
    await flush()
    await flush()
    expect(harness.container.textContent).toContain('fresh.md')
    expect(harness.container.textContent).not.toContain('old.md')
    expect(harness.list).toHaveBeenCalledWith('session-2', '', expect.anything())
  })
})

describe('breadcrumb and keyboard traversal', () => {
  const TREE = new Map([
    ['', { entries: [
      { name: 'alpha', type: 'directory', path: 'alpha' },
      { name: 'README.md', type: 'file', path: 'README.md' },
    ] }],
    ['alpha', { entries: [{ name: 'guide.md', type: 'file', path: 'alpha/guide.md' }] }],
  ])

  const treeitem = (harness: BrowseHarness, path: string) =>
    harness.container.querySelector<HTMLElement>(`[role="treeitem"][data-path="${path}"]`)

  const key = async (harness: BrowseHarness, target: HTMLElement, keyName: string): Promise<void> => {
    await act(async () => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true }))
    })
    await act(async () => { await Promise.resolve() })
  }

  it('renders the preview target as a breadcrumb path', async () => {
    const harness = await renderBrowse(TREE)
    harness.setTarget({ sessionId: 'session-1', path: 'alpha/guide.md' })
    await flush()
    const crumbs = [...harness.container.querySelectorAll('.dsh-md-preview-crumb')].map(node => node.textContent)
    expect(crumbs).toEqual(['alpha', 'guide.md'])
    expect(harness.container.querySelector('.dsh-md-preview-crumb:last-child')?.getAttribute('aria-current')).toBe('page')
  })

  it('walks the tree with the keyboard and opens a file with Enter', async () => {
    const harness = await renderBrowse(TREE)
    await enterBrowse(harness)
    await flush()
    // Single tab stop: exactly one treeitem carries tabindex 0.
    const stops = harness.container.querySelectorAll('[role="treeitem"][tabindex="0"]')
    expect(stops.length).toBe(1)
    const first = stops[0] as HTMLElement
    expect(first.dataset.path).toBe('alpha')
    // ArrowDown moves the roving focus to the next visible node.
    await key(harness, first, 'ArrowDown')
    expect(document.activeElement?.getAttribute('data-path')).toBe('README.md')
    expect(treeitem(harness, 'README.md')?.tabIndex).toBe(0)
    // ArrowRight on the collapsed directory expands it (children fetched).
    await key(harness, treeitem(harness, 'alpha')!, 'ArrowRight')
    await flush()
    expect(treeitem(harness, 'alpha')?.getAttribute('aria-expanded')).toBe('true')
    // End jumps to the last visible node (README.md itself); ArrowUp then
    // walks into the expanded directory's child; ArrowLeft collapses it.
    await key(harness, treeitem(harness, 'README.md')!, 'End')
    expect(document.activeElement?.getAttribute('data-path')).toBe('README.md')
    await key(harness, treeitem(harness, 'README.md')!, 'ArrowUp')
    expect(document.activeElement?.getAttribute('data-path')).toBe('alpha/guide.md')
    await key(harness, treeitem(harness, 'alpha')!, 'ArrowLeft')
    expect(treeitem(harness, 'alpha')?.getAttribute('aria-expanded')).toBe('false')
    // Enter on a file opens it as the preview target.
    await key(harness, treeitem(harness, 'README.md')!, 'Enter')
    await flush()
    expect(harness.reads.at(-1)).toEqual({ path: 'README.md' })
    expect(harness.container.querySelector('.dsh-md-preview-browser')?.hasAttribute('hidden')).toBe(true)
  })
})

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
    expect(harness.container.querySelector('.dsh-md-preview-crumb:last-child')?.textContent).toBe('guide.md')
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
