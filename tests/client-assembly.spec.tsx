// @vitest-environment jsdom
/**
 * The full client assembly against the real Cordis Context, the production
 * SlotRegistry with its real renderer, the real locale face, and the real
 * mountMdPreview wiring (#21): the produced-file chips, the
 * preview-documents action, and the workspace-docs capsule — all session-
 * scoped slot entries — drive the preview panel (a root-scoped shell.overlay
 * entry) through the shared leave-intent seat, with only the Remote boundary
 * stubbed at the injected seam.
 */

import { act } from 'react-dom/test-utils'
import { useSyncExternalStore } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Context } from '@deepseek-ai/cordis'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { buildRenderApp } from '#harness/renderer/app'
import { createSlotRenderer } from '#harness/renderer/scoped-slots'
import { AppFrame } from '#harness/layout/frame'
import { createLayoutStore } from '#harness/layout/store'
import { EditorView } from '@codemirror/view'
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mountMdPreview } from '../src/client/mount.ts'
import { TYPERT_REMOTE } from '../src/typert/remote-client.ts'
import type { MdPreviewFile } from '../src/protocol.ts'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { createMemoryStorage } from '../src/client/reading.ts'

const SESSION = 'session-1'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
  ;(Range.prototype as unknown as { getClientRects?: () => [] }).getClientRects ??= () => []
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  Object.defineProperty(window, 'innerWidth', { value: 1928, configurable: true })
})

/** One turn's ConversationLocation data store (deliverables + tail data). */
function turnDataOf(produced: ReadonlyArray<{ seq: number; path: string }>, closingSeq = 7) {
  const values = new Map<string, unknown>([
    ['deliverables', { produced }],
    ['turn-tail', { turn: 1, seq: closingSeq + 2, time: 0, closing: { finalNode: { messageId: 'm-1', seq: closingSeq }, blocks: [] } }],
  ])
  return {
    turn: 1,
    status: 'closed' as const,
    steps: [],
    start: undefined,
    end: undefined,
    data: Object.assign(values, {
      source: (key: string) => ({ getSnapshot: () => values.get(key), subscribe: () => () => {} }),
    }),
  }
}

/** One Chat-target snapshot carrying the turn that produced the docs. */
function chatSnapshotOf(produced: ReadonlyArray<{ seq: number; path: string }>) {
  return {
    nodes: {
      values: () => [{
        kind: 'turn-tail',
        data: { closing: { finalNode: { messageId: 'm-1', seq: 7 } } },
        location: { kind: 'turn', turn: turnDataOf(produced) },
      }],
    },
    timeline: {
      turnOrder: [1],
      turns: new Map([[1, turnDataOf(produced)]]),
    },
  }
}

interface AssemblyBench {
  container: HTMLElement
  reads: Array<{ sessionId: string; path: string }>
  searches: Array<{ sessionId: string; query: string }>
  writes: Array<{ path: string; content: string }>
  files: Map<string, string>
  classifications: Map<string, Pick<MdPreviewFile, 'kind' | 'editable'>>
  holdReads: boolean
  pendingReads: Array<{ path: string; signal: AbortSignal; resolve(result: RemoteResult<MdPreviewFile>): void }>
  /** Replace the binding's chat facts and notify the session seats. */
  setChatSnapshot(produced: ReadonlyArray<{ seq: number; path: string }>): void
  disposeMount(): Promise<void>
  unmount(): Promise<void>
}

/**
 * Assemble the whole client: real Context, registry, renderer, locale face,
 * session scope adapter, a bench-owned root frame + chat stand-in declaring
 * the plugin's consumed slots, then the real mountMdPreview. Remote read/
 * write/list record their calls over one mutable file table.
 */
async function assemble(produced: ReadonlyArray<{ seq: number; path: string }>, nativeFrame = false, language = 'en'): Promise<AssemblyBench> {
  const ctx = new Context()
  const bench: AssemblyBench = {
    container: document.createElement('div'),
    reads: [],
    searches: [],
    writes: [],
    holdReads: false,
    pendingReads: [],
    setChatSnapshot: () => {},
    files: new Map([
      ['guide.md', '# Guide\n\nbody'],
      ['notes.md', '# Notes\n\nbody'],
    ]),
    classifications: new Map([
      ['guide.md', { kind: 'markdown', editable: true }],
      ['notes.md', { kind: 'markdown', editable: true }],
    ]),
    disposeMount: async () => {},
    unmount: async () => {},
  }
  // The Remote boundary fake: one namespace object served both as the
  // 'remote.mdPreview' service (the UI fiber waits on it) and as a property
  // of the remote table — the production remote service exposes mounted
  // namespaces the same way, and mount.ts's closures read them off ctx.remote.
  const mdPreview = {
    read: (sessionId: string, path: string, signal: AbortSignal) => {
      bench.reads.push({ sessionId, path })
      if (bench.holdReads) return new Promise<RemoteResult<MdPreviewFile>>(resolve => { bench.pendingReads.push({ path, signal, resolve }) })
      const content = bench.files.get(path)
      if (content === undefined) {
        return Promise.resolve({ ok: false as const, error: { code: 'md-preview/not-found', message: `no ${path}` } })
      }
      return Promise.resolve({ ok: true as const, value: {
        path, content, fingerprint: 'v1',
        ...(bench.classifications.get(path) ?? { kind: 'text', editable: false }),
      } })
    },
    write: (sessionId: string, path: string, content: string) => {
      bench.writes.push({ path, content })
      bench.files.set(path, content)
      return Promise.resolve({ ok: true as const, value: { path, fingerprint: 'v2' } })
    },
    list: (sessionId: string, path: string) => {
      const entries = [...bench.files.keys()].map(name => ({ name, type: 'file' as const, path: name }))
      return Promise.resolve({ ok: true as const, value: { path, entries } })
    },
    search: (sessionId: string, query: string) => {
      bench.searches.push({ sessionId, query })
      const q = query.toLowerCase()
      const matches = [...bench.files.keys()]
        .filter(name => name.toLowerCase().includes(q))
        .map(name => ({ name, path: name }))
      return Promise.resolve({ ok: true as const, value: { query, matches, complete: true, limits: [] } })
    },
  }
  const remoteTable = {
    mounted: [] as unknown[],
    mdPreview,
    $mount(contribution: unknown): Promise<() => Promise<void>> {
      remoteTable.mounted.push(contribution)
      return Promise.resolve(async () => {})
    },
  }
  ctx.provide('remote', remoteTable)
  ctx.provide('remote.mdPreview', mdPreview)
  const locale = new LocaleRuntime(ctx)
  locale.setLocale(language)
  ctx.provide('locale', locale)
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.install(createSlotRenderer())
  ctx.slots.installLocale(locale)

  // The session scope: one live binding carrying the Chat snapshot the
  // preview-documents action selects over. Mutable + notifying so a test can
  // advance the conversation and watch the session-scoped seats follow.
  let chatSnapshot: ReturnType<typeof chatSnapshotOf> = chatSnapshotOf(produced)
  const chatListeners = new Set<() => void>()
  const chatSource = {
    getSnapshot: () => chatSnapshot,
    subscribe: (listener: () => void) => {
      chatListeners.add(listener)
      return () => { chatListeners.delete(listener) }
    },
  }
  bench.setChatSnapshot = (next: ReadonlyArray<{ seq: number; path: string }>) => {
    chatSnapshot = chatSnapshotOf(next)
    for (const listener of chatListeners) listener()
  }
  const binding = {
    key: SESSION,
    props: { sessionId: SESSION },
    hooks: { chat: chatSource },
    keyedHooks: {},
  }
  const current = { getSnapshot: () => binding, subscribe: () => () => {} }
  ctx.slots.installScope('session', {
    current,
    resolve: (key: string) => (key === SESSION ? binding : undefined),
    renderArea: (_binding: unknown, props: { children: unknown }) => props.children,
  } as never)

  // The bench-owned root frame: the overlay outlet plus the chat stand-in
  // inside the session area, exactly the shapes the shipped shell renders.
  const nativeLayout = nativeFrame ? createLayoutStore().create() : null
  const RootFrame = (kit: Record<string, unknown>): React.ReactNode => nativeLayout === null ? (
    <div>
      <div data-testid="overlay">{(kit.renderSlot as (key: string) => React.ReactNode)('shell.overlay', {})}</div>
      {(kit.SessionProvider as React.FC<{ children?: React.ReactNode }>)(
        { children: (kit.renderSlot as (key: string) => React.ReactNode)('bench.chat-view', {}) },
      )}
    </div>
  ) : (
    <AppFrame
      useStore={(selector: (state: unknown) => unknown) => selector(useSyncExternalStore(nativeLayout.subscribe, nativeLayout.getSnapshot))}
      actions={nativeLayout.actions}
      useSessions={(selector: (state: unknown) => unknown) => selector({ current: SESSION, byId: { [SESSION]: { blank: false } } })}
      SessionProvider={kit.SessionProvider}
      t={(key: string) => key}
      renderSlot={(key: string, owner: { width?: number }) => {
        if (key === 'shell.overlay') return (kit.renderSlot as Function)(key, {})
        if (key === 'conversation') {
          const Provider = kit.SessionProvider as React.FC<{ children?: React.ReactNode }>
          return <Provider>{(kit.renderSlot as Function)('bench.chat-view', {})}</Provider>
        }
        if (key === 'sidebar') return <button data-native-sidebar data-width={owner.width} onClick={() => { nativeLayout.actions.toggleSidebar() }}>Native sidebar</button>
        return <input data-native-details defaultValue="Native tool detail" onFocus={() => { nativeLayout.actions.openDetails() }} />
      }}
    />
  )
  const disposeRoot = ctx.slots.register({
    name: 'root',
    children: {
      'shell.overlay': { kind: 'list', scope: 'root' },
      'bench.chat-view': { kind: 'single', scope: 'session' },
    },
  } as never, RootFrame as never)

  // The chat stand-in: declares the plugin's consumed session slots and
  // renders them with owner shapes matching the shipped chat view.
  const ChatView = (kit: Record<string, unknown>): React.ReactNode => {
    const owner = { turn: turnDataOf(produced), seq: 7, openFile: () => Promise.resolve() }
    return (
      <div data-testid="chat">
        <div data-testid="chips">{(kit.renderSlotChain as (key: string, owner: unknown) => React.ReactNode)('conversation.chat.turnTail', owner)}</div>
        <div data-testid="actions">{(kit.renderSlot as (key: string, owner: unknown) => React.ReactNode)('conversation.chat.assistant-actions', { messageId: 'm-1' })}</div>
        <div data-testid="utilities">{(kit.renderSlot as (key: string) => React.ReactNode)('conversation.session.header.utilities', {})}</div>
      </div>
    )
  }
  const disposeChat = ctx.slots.register({
    name: 'bench.chat-view',
    children: {
      'conversation.chat.turnTail': { kind: 'chain', scope: 'session' },
      'conversation.chat.assistant-actions': { kind: 'list', scope: 'session' },
      'conversation.session.header.utilities': { kind: 'list', scope: 'session' },
    },
  } as never, ChatView as never)

  const disposeMount = await mountMdPreview(ctx, TYPERT_REMOTE)
  bench.disposeMount = async () => {
    await disposeMount()
  }

  const app = buildRenderApp({ ctx })
  document.body.appendChild(bench.container)
  const root: Root = createRoot(bench.container)
  bench.unmount = async () => {
    await act(async () => { root.unmount() })
    disposeChat()
    disposeRoot()
    // The bench context itself is fire-and-forget, like the registration
    // bench: every plugin-owned registration died with its disposers above.
  }
  await act(async () => { root.render(app()) })
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
  return bench
}

const flush = async (): Promise<void> => {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

const buttonByText = (bench: AssemblyBench, text: string): HTMLButtonElement | undefined =>
  [...bench.container.querySelectorAll('button')].find(button => button.textContent?.includes(text))

const buttonByAria = (bench: AssemblyBench, label: string): HTMLButtonElement | undefined =>
  [...bench.container.querySelectorAll('button')].find(button =>
    button.getAttribute('aria-label') === label
    || button.getAttribute('title') === label
    || button.textContent?.trim() === label)

beforeEach(() => { vi.stubGlobal('localStorage', createMemoryStorage()) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren() })

describe('read-only text through the full Client and AppFrame (#39)', () => {
  it.each([
    ['en', 'Preview notes.unknown', 'Refresh content', 'Read-only', 'This file is not readable UTF-8 text', 'Retry'],
    ['zh', '预览 notes.unknown', '刷新内容', '只读', '文件不是可读取的 UTF-8 文本', '重试'],
  ])('provides localized read-only, refresh and text-failure controls in %s', async (language, open, refresh, readonly, failure, retry) => {
    const bench = await assemble([{ seq: 1, path: 'notes.unknown' }], true, language)
    bench.files.set('notes.unknown', 'literal source')
    try {
      await act(async () => { buttonByAria(bench, open!)!.click() })
      await flush()
      expect(bench.container.querySelector('.dsh-md-preview-document')?.textContent).toContain(readonly)
      const refreshButton = buttonByAria(bench, refresh!)!
      expect(refreshButton.getAttribute('aria-keyshortcuts')).toBe('Alt+R')
      bench.holdReads = true
      await act(async () => { refreshButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', altKey: true, bubbles: true })) })
      await flush()
      await act(async () => { bench.pendingReads[0]!.resolve({ ok: false, error: { code: 'md-preview/not-text', message: 'fs rejected the content' } } as RemoteResult<MdPreviewFile>) })
      await flush()
      expect(bench.container.textContent).toContain(failure)
      expect(bench.container.textContent).toContain('md-preview/not-text')
      expect(buttonByAria(bench, retry!)).toBeDefined()
    } finally { await bench.unmount() }
  })

  it('keeps text candidates deduplicated and fenced by the owning closing turn in all produced entry points', async () => {
    const bench = await assemble([
      { seq: 1, path: 'Dockerfile' },
      { seq: 2, path: 'Dockerfile' },
      { seq: 3, path: 'Makefile' },
      { seq: 4, path: 'report.docx' },
      { seq: 9, path: 'late.unknown' },
    ], true)
    try {
      expect([...bench.container.querySelectorAll('[data-testid="chips"] button')].map(button => button.getAttribute('title')))
        .toEqual(['Preview Dockerfile', 'Preview Makefile', 'Open report.docx'])
      await act(async () => { buttonByAria(bench, 'Preview documents')!.click() })
      await flush()
      expect([...bench.container.querySelectorAll('[role="menuitem"]')].map(button => button.textContent))
        .toEqual(['Dockerfile', 'Makefile'])
      await act(async () => { buttonByAria(bench, 'Open workspace documents')!.click() })
      await flush()
      expect([...bench.container.querySelectorAll('.dsh-md-preview-quick[data-source="turn"] button')].map(button => button.getAttribute('title')))
        .toEqual(['Dockerfile', 'Makefile'])
      expect(bench.reads).toEqual([])
    } finally { await bench.unmount() }
  })

  it.each(['chip', 'picker', 'tree', 'search', 'turn', 'recent'] as const)('guards the %s entry from Markdown drafts to read-only text', async entry => {
    const bench = await assemble([{ seq: 1, path: 'guide.md' }, { seq: 2, path: 'Dockerfile' }], true)
    bench.files.set('Dockerfile', 'FROM selected text')
    try {
      // Read the text once so the real reading record supplies its recent entry.
      await act(async () => { buttonByAria(bench, 'Preview Dockerfile')!.click() })
      await flush()
      await act(async () => { buttonByAria(bench, 'Preview guide.md')!.click() })
      await flush()
      await act(async () => { buttonByAria(bench, 'Edit')!.click() })
      await flush()
      const editor = EditorView.findFromDOM(bench.container.querySelector('.cm-editor') as HTMLElement)!
      await act(async () => { editor.dispatch({ changes: { from: 0, insert: 'UNSAVED ' } }) })
      expect(buttonByAria(bench, 'Refresh content')).toBeUndefined()
      await act(async () => { editor.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', altKey: true, bubbles: true })) })
      expect(bench.reads).toHaveLength(2)
      if (['tree', 'search', 'turn', 'recent'].includes(entry)) {
        await act(async () => { buttonByAria(bench, 'Workspace')!.click() })
        await flush()
      }
      if (entry === 'search') {
        vi.useFakeTimers()
        const input = bench.container.querySelector<HTMLInputElement>('.dsh-md-preview-searchinput')!
        await act(async () => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Dockerfile')
          input.dispatchEvent(new Event('input', { bubbles: true }))
        })
        await act(async () => { vi.advanceTimersByTime(250) })
        await flush()
        vi.useRealTimers()
      }
      const request = async () => {
        await act(async () => {
          if (entry === 'chip') buttonByAria(bench, 'Preview Dockerfile')!.click()
          else if (entry === 'picker') buttonByAria(bench, 'Preview documents')!.click()
          else if (entry === 'tree') bench.container.querySelector<HTMLElement>('[role="treeitem"][data-path="Dockerfile"] .dsh-md-preview-treerow')!.click()
          else if (entry === 'search') bench.container.querySelector<HTMLElement>('[role="option"][data-path="Dockerfile"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
          else bench.container.querySelector<HTMLButtonElement>(`.dsh-md-preview-quick[data-source="${entry}"] button[title="Dockerfile"]`)!.click()
        })
        if (entry === 'picker') {
          await flush()
          await act(async () => { bench.container.querySelector<HTMLButtonElement>('[role="menuitem"][title="Preview Dockerfile"]')!.click() })
        }
        await flush()
      }
      await request()
      expect(bench.container.textContent).toContain('You have unsaved changes')
      expect(bench.reads).toHaveLength(2)
      await act(async () => { buttonByAria(bench, 'Keep editing')!.click() })
      await flush()
      expect(editor.state.doc.toString()).toBe('UNSAVED # Guide\n\nbody')
      expect(editor.hasFocus).toBe(true)
      await request()
      await act(async () => { buttonByAria(bench, 'Discard changes')!.click() })
      await flush()
      expect(bench.container.querySelector('.dsh-md-preview-document pre')?.textContent).toBe('FROM selected text')
      expect(bench.reads).toHaveLength(3)
      expect(bench.writes).toEqual([])
    } finally { vi.useRealTimers(); await bench.unmount() }
  })

  it.each(['refresh', 'switch', 'close', 'dispose'] as const)('cancels the pending text read on %s and ignores its late result', async next => {
    const bench = await assemble([{ seq: 1, path: 'Dockerfile' }, { seq: 2, path: 'Makefile' }], true)
    bench.files.set('Dockerfile', 'FROM initial')
    bench.files.set('Makefile', 'target: successor')
    try {
      await act(async () => { buttonByAria(bench, 'Preview Dockerfile')!.click() })
      await flush()
      bench.holdReads = true
      await act(async () => { buttonByAria(bench, 'Refresh content')!.click() })
      await flush()
      const old = bench.pendingReads[0]!
      expect(old.signal.aborted).toBe(false)
      await act(async () => {
        if (next === 'refresh') buttonByAria(bench, 'Refresh content')!.click()
        else if (next === 'switch') buttonByAria(bench, 'Preview Makefile')!.click()
        else if (next === 'close') buttonByAria(bench, 'Close document panel')!.click()
        else await bench.disposeMount()
      })
      await flush()
      expect(old.signal.aborted).toBe(true)
      await act(async () => { old.resolve({ ok: true, value: { path: old.path, content: 'LATE TEXT', fingerprint: 'old', kind: 'text', editable: false } }) })
      await flush()
      expect(bench.container.textContent).not.toContain('LATE TEXT')
      const successor = bench.pendingReads[1]
      if (next === 'refresh' || next === 'switch') {
        expect(successor).toBeDefined()
        await act(async () => { successor!.resolve({ ok: true, value: { path: successor!.path, content: 'CURRENT TEXT', fingerprint: 'new', kind: 'text', editable: false } }) })
        await flush()
        expect(bench.container.querySelector('.dsh-md-preview-document pre')?.textContent).toBe('CURRENT TEXT')
      } else {
        expect(successor).toBeUndefined()
        expect(bench.container.querySelector('.dsh-md-preview-panel')).toBeNull()
      }
      expect(bench.writes).toEqual([])
    } finally { await bench.unmount() }
  })

  it('opens text from keyboard tree navigation while Office rows remain unavailable for preview', async () => {
    const bench = await assemble([], true)
    bench.files.set('Dockerfile', 'FROM tree')
    bench.files.set('report.docx', 'Office')
    try {
      await act(async () => { buttonByAria(bench, 'Open workspace documents')!.click() })
      await flush()
      const office = bench.container.querySelector<HTMLElement>('[role="treeitem"][data-path="report.docx"]')!
      expect(office.getAttribute('aria-disabled')).toBe('true')
      await act(async () => {
        office.querySelector<HTMLElement>('.dsh-md-preview-treerow')!.click()
        office.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })
      expect(bench.reads).toEqual([])
      const text = bench.container.querySelector<HTMLElement>('[role="treeitem"][data-path="Dockerfile"]')!
      await act(async () => {
        text.focus()
        text.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })
      await flush()
      expect(bench.container.querySelector('.dsh-md-preview-document pre')?.textContent).toBe('FROM tree')
      expect(buttonByAria(bench, 'Edit')).toBeUndefined()
    } finally { await bench.unmount() }
  })

  it('remembers every successful text open and re-reads from recent and continue-reading entries', async () => {
    const bench = await assemble([{ seq: 1, path: 'Makefile' }], true)
    bench.files.set('Makefile', 'PRIVATE_BODY: initial')
    try {
      await act(async () => { buttonByAria(bench, 'Preview Makefile')!.click() })
      await flush()
      await act(async () => { buttonByAria(bench, 'Close document panel')!.click() })
      await flush()
      await act(async () => { buttonByAria(bench, 'Open workspace documents')!.click() })
      await flush()
      const recent = bench.container.querySelector<HTMLButtonElement>('.dsh-md-preview-quick[data-source="recent"] button')
      expect(recent?.textContent).toContain('Makefile')
      bench.files.set('Makefile', 'PRIVATE_BODY: recent')
      await act(async () => { recent!.click() })
      await flush()
      expect(bench.container.querySelector('.dsh-md-preview-document pre')?.textContent).toBe('PRIVATE_BODY: recent')
      await act(async () => { buttonByAria(bench, 'Close document panel')!.click() })
      await flush()
      await act(async () => { buttonByAria(bench, 'Open workspace documents')!.click() })
      await flush()
      bench.files.set('Makefile', 'PRIVATE_BODY: continued')
      await act(async () => { buttonByText(bench, 'Continue reading')!.click() })
      await flush()
      expect(bench.container.querySelector('.dsh-md-preview-document pre')?.textContent).toBe('PRIVATE_BODY: continued')
      expect(bench.reads).toHaveLength(3)
      const persisted = localStorage.getItem('dsh-md-preview.reading.v1')!
      expect(persisted).toContain('Makefile')
      expect(persisted).not.toMatch(/PRIVATE_BODY|fingerprint|content|draft/)
    } finally { await bench.unmount() }
  })

  it('refreshes text only on explicit request and retries a failed refresh', async () => {
    const produced = [{ seq: 1, path: 'Dockerfile' }]
    const bench = await assemble(produced, true)
    bench.files.set('Dockerfile', 'FROM old')
    try {
      await act(async () => { buttonByAria(bench, 'Preview Dockerfile')!.click() })
      await flush()
      bench.files.set('Dockerfile', 'FROM latest')
      await act(async () => { bench.setChatSnapshot(produced) })
      await act(async () => { buttonByAria(bench, 'Preview Dockerfile')!.click() })
      await flush()
      expect(bench.container.querySelector('.dsh-md-preview-document pre')?.textContent).toBe('FROM old')
      expect(bench.reads).toHaveLength(1)
      expect(buttonByAria(bench, 'Refresh content')).toBeDefined()
      await act(async () => { buttonByAria(bench, 'Refresh content')!.click() })
      await flush()
      expect(bench.container.querySelector('.dsh-md-preview-document pre')?.textContent).toBe('FROM latest')
      expect(bench.reads).toHaveLength(2)
      bench.files.delete('Dockerfile')
      await act(async () => {
        buttonByAria(bench, 'Refresh content')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', altKey: true, bubbles: true }))
      })
      await flush()
      expect(bench.container.textContent).toContain('md-preview/not-found')
      expect(bench.container.querySelector('.dsh-md-preview-document pre')).toBeNull()
      bench.files.set('Dockerfile', 'FROM recovered')
      await act(async () => { buttonByAria(bench, 'Retry')!.click() })
      await flush()
      expect(bench.container.querySelector('.dsh-md-preview-document pre')?.textContent).toBe('FROM recovered')
      expect(bench.writes).toEqual([])
    } finally { await bench.unmount() }
  })

  it('uses the Host category for presentation and its separate edit eligibility', async () => {
    const bench = await assemble([{ seq: 1, path: 'guide.md' }, { seq: 2, path: 'Makefile' }], true)
    bench.files.set('Makefile', '# Resolved Markdown')
    bench.classifications.set('guide.md', { kind: 'text', editable: false })
    bench.classifications.set('Makefile', { kind: 'markdown', editable: false })
    try {
      await act(async () => { buttonByAria(bench, 'Preview guide.md')!.click() })
      await flush()
      expect(bench.container.querySelector('.dsh-md-preview-document pre')?.textContent).toBe('# Guide\n\nbody')
      expect(buttonByAria(bench, 'Edit')).toBeUndefined()
      expect(buttonByAria(bench, 'Outline')).toBeUndefined()
      await act(async () => { buttonByAria(bench, 'Preview Makefile')!.click() })
      await flush()
      expect(bench.container.querySelector('.dsh-md-preview-document h1')?.textContent).toBe('Resolved Markdown')
      expect(buttonByAria(bench, 'Edit')).toBeUndefined()
      expect(bench.writes).toEqual([])
    } finally { await bench.unmount() }
  })

  it.each(['Dockerfile', 'Makefile', 'notes.txt', 'notes.unknown'])('opens %s from produced-file chips as literal read-only text', async path => {
    const bench = await assemble([{ seq: 1, path }], true)
    bench.files.set(path, '# literal text\n<script>not executed</script>\n中文')
    try {
      const chip = buttonByAria(bench, `Preview ${path}`)
      expect(chip).toBeDefined()
      await act(async () => { chip!.click() })
      await flush()
      expect(bench.container.querySelector('.dsh-md-preview-document pre')?.textContent)
        .toBe('# literal text\n<script>not executed</script>\n中文')
      expect(bench.container.querySelector('.dsh-md-preview-document script')).toBeNull()
      expect(buttonByAria(bench, 'Edit')).toBeUndefined()
      expect(bench.writes).toEqual([])
    } finally { await bench.unmount() }
  })
})

describe('client assembly against the real slot machinery (#21)', () => {
  const PRODUCED = [
    { seq: 1, path: 'guide.md' },
    { seq: 2, path: 'notes.md' },
  ]

  it('opens from a produced-file chip through the real assembly', async () => {
    const bench = await assemble(PRODUCED)
    try {
      expect(buttonByText(bench, 'guide.md')).toBeDefined()
      expect(buttonByAria(bench, 'Preview documents')).toBeDefined()
      expect(buttonByAria(bench, 'Open workspace documents')).toBeDefined()
      await act(async () => { buttonByText(bench, 'guide.md')!.click() })
      await flush()
      // The panel opened in the overlay outlet and read the document.
      expect(bench.container.querySelector('.dsh-md-preview-panel')).toBeTruthy()
      expect(bench.reads).toEqual([{ sessionId: SESSION, path: 'guide.md' }])
      expect(bench.container.querySelector('.dsh-md-preview-document')?.textContent).toContain('Guide')
    } finally {
      await bench.unmount()
    }
  })

  it('guards a dirty draft against a chip open of another document', async () => {
    const bench = await assemble(PRODUCED)
    try {
      await act(async () => { buttonByText(bench, 'guide.md')!.click() })
      await flush()
      // Enter the edit face and dirty the draft in the real CodeMirror.
      await act(async () => { buttonByAria(bench, 'Edit')!.click() })
      await flush()
      const host = bench.container.querySelector('.cm-editor') as HTMLElement
      const view = EditorView.findFromDOM(host)!
      await act(async () => { view.dispatch({ changes: { from: 0, insert: 'x' } }) })
      await flush()
      // The chip for another document now routes through the leave guard.
      await act(async () => { buttonByText(bench, 'notes.md')!.click() })
      await flush()
      expect(bench.container.textContent).toContain('You have unsaved changes')
      expect((bench.container.querySelector('.dsh-md-preview-crumbs') as HTMLElement).getAttribute('title')).toContain('guide.md')
      expect(bench.reads.filter(read => read.path === 'notes.md')).toHaveLength(0)
      await act(async () => { buttonByAria(bench, 'Discard changes')!.click() })
      await flush()
      // The held open executes once; the workspace was never written.
      expect((bench.container.querySelector('.dsh-md-preview-crumbs') as HTMLElement).getAttribute('title')).toContain('notes.md')
      expect(bench.reads.filter(read => read.path === 'notes.md')).toHaveLength(1)
      expect(bench.writes).toEqual([])
    } finally {
      await bench.unmount()
    }
  })

  it('guards the workspace-docs capsule collapse and reopens from it', async () => {
    const bench = await assemble(PRODUCED)
    try {
      await act(async () => { buttonByText(bench, 'guide.md')!.click() })
      await flush()
      await act(async () => { buttonByAria(bench, 'Edit')!.click() })
      await flush()
      const host = bench.container.querySelector('.cm-editor') as HTMLElement
      const view = EditorView.findFromDOM(host)!
      await act(async () => { view.dispatch({ changes: { from: 0, insert: 'x' } }) })
      await flush()
      // The header's collapse requests through the leave entry too.
      await act(async () => { buttonByAria(bench, 'Close document panel')!.click() })
      await flush()
      expect(bench.container.textContent).toContain('You have unsaved changes')
      expect(bench.container.querySelector('.dsh-md-preview-panel')).toBeTruthy()
      await act(async () => { buttonByAria(bench, 'Discard changes')!.click() })
      await flush()
      // The collapse executed: no target, the capsule is not pressed.
      expect(bench.container.querySelector('.dsh-md-preview-panel')).toBeNull()
      expect(buttonByAria(bench, 'Open workspace documents')!.getAttribute('aria-expanded')).toBe('false')
      // Closed, the same entry enters the workspace browsing face.
      await act(async () => { buttonByAria(bench, 'Open workspace documents')!.click() })
      await flush()
      expect(bench.container.querySelector('.dsh-md-preview-panel')).toBeTruthy()
      expect(bench.container.querySelector('[role="tree"]')).toBeTruthy()
      // The empty path never reads.
      expect(bench.reads.every(read => read.path !== '')).toBe(true)
    } finally {
      await bench.unmount()
    }
  })

  it('opens from the preview-documents action picker through the same guard', async () => {
    const bench = await assemble(PRODUCED)
    try {
      await act(async () => { buttonByText(bench, 'guide.md')!.click() })
      await flush()
      await act(async () => { buttonByAria(bench, 'Edit')!.click() })
      await flush()
      const host = bench.container.querySelector('.cm-editor') as HTMLElement
      const view = EditorView.findFromDOM(host)!
      await act(async () => { view.dispatch({ changes: { from: 0, insert: 'x' } }) })
      await flush()
      // Two documents: the action opens its picker.
      await act(async () => { buttonByAria(bench, 'Preview documents')!.click() })
      await flush()
      const item = [...bench.container.querySelectorAll('[role="menu"] button')]
        .find(button => button.textContent === 'notes.md') as HTMLButtonElement
      await act(async () => { item.click() })
      await flush()
      expect(bench.container.textContent).toContain('You have unsaved changes')
      await act(async () => { buttonByAria(bench, 'Keep editing')!.click() })
      await flush()
      expect((bench.container.querySelector('.dsh-md-preview-crumbs') as HTMLElement).getAttribute('title')).toContain('guide.md')
      expect(bench.reads.filter(read => read.path === 'notes.md')).toHaveLength(0)
    } finally {
      await bench.unmount()
    }
  })

  it('wires the workspace search from the Remote boundary to the browse area (#30)', async () => {
    const bench = await assemble(PRODUCED)
    try {
      await act(async () => { buttonByAria(bench, 'Open workspace documents')!.click() })
      await flush()
      const input = bench.container.querySelector('.dsh-md-preview-searchinput') as HTMLInputElement
      expect(input).toBeTruthy()
      vi.useFakeTimers()
      await act(async () => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
        set.call(input, 'guide')
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await act(async () => { vi.advanceTimersByTime(250) })
      await act(async () => { await Promise.resolve(); await Promise.resolve() })
      // The mounted Remote namespace answered with the fake workspace's match.
      expect(bench.searches).toEqual([{ sessionId: SESSION, query: 'guide' }])
      const option = bench.container.querySelector<HTMLElement>('[role="option"][data-path="guide.md"]')
      expect(option).toBeTruthy()
      await act(async () => { option!.click() })
      await flush()
      // Opening the result read the document fresh through the same seam.
      expect(bench.reads.at(-1)).toEqual({ sessionId: SESSION, path: 'guide.md' })
    } finally {
      vi.useRealTimers()
      await bench.unmount()
    }
  })

  it('publishes current-turn outputs from the session seat into the panel quick entries (#31)', async () => {
    const bench = await assemble([
      { seq: 1, path: 'guide.md' },
      { seq: 2, path: 'notes.md' },
      { seq: 3, path: 'run.ts' },
    ])
    try {
      // Open the panel on the browse face from the capsule.
      await act(async () => { buttonByAria(bench, 'Open workspace documents')!.click() })
      await flush()
      // Source text now participates alongside Markdown; names and paths render.
      const rows = [...bench.container.querySelectorAll<HTMLElement>('.dsh-md-preview-quick[data-source="turn"] .dsh-md-preview-quickrow')]
      expect(rows.map(row => row.getAttribute('title'))).toEqual(['guide.md', 'notes.md', 'run.ts'])
      // Opening a quick row reads the document through the mounted Remote.
      await act(async () => { rows[1]!.click() })
      await flush()
      expect(bench.reads.at(-1)).toEqual({ sessionId: SESSION, path: 'notes.md' })
      // A new closing turn replaces the quick entries live — the earlier
      // turn's outputs never masquerade as current.
      bench.setChatSnapshot([{ seq: 1, path: 'fresh.md' }])
      await flush()
      const next = [...bench.container.querySelectorAll<HTMLElement>('.dsh-md-preview-quick[data-source="turn"] .dsh-md-preview-quickrow')]
      expect(next.map(row => row.getAttribute('title'))).toEqual(['fresh.md'])
    } finally {
      await bench.unmount()
    }
  })

  it('collapses every outlet when the mount disposes', async () => {
    const bench = await assemble(PRODUCED)
    await act(async () => { buttonByText(bench, 'guide.md')!.click() })
    await flush()
    expect(bench.container.querySelector('.dsh-md-preview-panel')).toBeTruthy()
    await bench.disposeMount()
    await flush()
    expect(buttonByText(bench, 'guide.md')).toBeUndefined()
    expect(buttonByAria(bench, 'Preview documents')).toBeUndefined()
    expect(buttonByAria(bench, 'Open workspace documents')).toBeUndefined()
    expect(bench.container.querySelector('.dsh-md-preview-panel')).toBeNull()
    await bench.unmount()
  })

  it('docks beside the native frame, guards collapse, restores focus and cleans up with its fiber', async () => {
    let available = 1928
    const observers = new Set<() => void>()
    vi.stubGlobal('ResizeObserver', class {
      constructor(private callback: () => void) { observers.add(callback) }
      observe() {}
      unobserve() {}
      disconnect() { observers.delete(this.callback) }
    })
    const originalRect = HTMLElement.prototype.getBoundingClientRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.parentElement === document.body && !this.classList.contains('dsh-md-preview-overlay')) {
        return { width: available, left: 0, top: 0, height: 900 } as DOMRect
      }
      if (this.style.gridTemplateColumns !== '') {
        const reserved = Number(/- ([\d.]+)px/.exec(this.style.maxWidth)?.[1] ?? 0)
        return { width: available - reserved, left: 0, top: 0, height: 900 } as DOMRect
      }
      return originalRect.call(this)
    })
    const resize = async () => {
      await act(async () => {
        for (const callback of observers) callback()
        await new Promise(resolve => { setTimeout(resolve, 40) })
      })
    }
    const bench = await assemble(PRODUCED, true)
    const frame = bench.container.querySelector('[data-shell-overlay]')!.parentElement as HTMLElement
    const entry = bench.container.querySelector<HTMLButtonElement>('[data-md-preview-toggle]')!
    const nativeDetails = bench.container.querySelector('[data-native-details]')!
    const nativeSidebar = bench.container.querySelector<HTMLButtonElement>('[data-native-sidebar]')!
    const panel = () => document.querySelector<HTMLElement>('#dsh-md-preview-panel')
    const panelButton = (label: string) => panel()!.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
    try {
      await act(async () => { buttonByText(bench, 'guide.md')!.click() })
      await resize()
      expect(frame.style.maxWidth).toBe('calc(100% - 720px)')
      // Portal escapes only the clipping frame, staying under the host root
      // so native onboarding/settings can make the whole app inert together.
      expect(panel()?.parentElement).toBe(bench.container)
      expect(panel()?.style.left).toBe('1208px')
      expect(panel()?.dataset.docked).toBe('true')
      expect(entry.getAttribute('aria-expanded')).toBe('true')
      // Native navigation still responds independently and keeps its preference.
      await act(async () => { nativeSidebar.click() })
      expect(nativeSidebar.dataset.width).toBe('56')
      await act(async () => { (nativeDetails as HTMLInputElement).focus() })
      await resize()
      expect(frame.style.gridTemplateColumns).toBe('56px minmax(0, 1fr) 360px')
      expect(bench.container.querySelector('[data-native-details]')).toBe(nativeDetails)

      await act(async () => { panelButton('Edit').click() })
      const editor = EditorView.findFromDOM(panel()!.querySelector('.cm-editor') as HTMLElement)!
      await act(async () => { editor.dispatch({ changes: { from: 0, insert: 'unsaved ' } }) })
      await act(async () => { panelButton('Close document panel').click() })
      expect(panel()?.textContent).toContain('You have unsaved changes')
      expect(frame.style.maxWidth).toBe('calc(100% - 720px)')
      await act(async () => { panelButton('Keep editing').click() })
      expect(editor.state.doc.toString()).toContain('unsaved ')
      expect(editor.hasFocus).toBe(true)
      await act(async () => { entry.click() })
      await act(async () => { panelButton('Discard changes').click() })
      await resize()
      expect(panel()).toBeNull()
      expect(frame.style.maxWidth).toBe('')
      expect(document.activeElement).toBe(entry)
      expect(bench.writes).toEqual([])

      await act(async () => { entry.click() })
      await resize()
      expect(panel()?.querySelector('[role="tree"]')).toBeTruthy()
      await act(async () => { panelButton('Maximize').click() })
      expect(frame.style.maxWidth).toBe('')
      expect(panel()?.style.width).toBe('1928px')
      await act(async () => { panelButton('Restore').click() })
      available = 1200
      await resize()
      expect(panel()?.style.width).toBe('504px')
      expect(frame.style.maxWidth).toBe('calc(100% - 504px)')
      expect(nativeSidebar.dataset.width).toBe('56')
      available = 800
      await resize()
      expect(frame.style.maxWidth).toBe('')
      expect(panel()?.dataset.docked).toBeUndefined()
      available = 1928
      await resize()
      expect(panel()?.style.width).toBe('720px')
      await act(async () => { await bench.disposeMount() })
      expect(panel()).toBeNull()
      expect(frame.style.maxWidth).toBe('')
      expect(bench.container.querySelector('[data-native-details]')).toBe(nativeDetails)
    } finally { await bench.unmount() }
    expect(observers.size).toBe(0)
  })
})
