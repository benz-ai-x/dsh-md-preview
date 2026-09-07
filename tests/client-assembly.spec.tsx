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
import { createRoot, type Root } from 'react-dom/client'
import { Context } from '@deepseek-ai/cordis'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { buildRenderApp } from '#harness/renderer/app'
import { createSlotRenderer } from '#harness/renderer/scoped-slots'
import { EditorView } from '@codemirror/view'
import { beforeAll, afterEach, describe, expect, it } from 'vitest'
import { mountMdPreview } from '../src/client/mount.ts'
import { TYPERT_REMOTE } from '../src/typert/remote-client.ts'

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

/** One turn's ConversationLocation data store (deliverables Turn data). */
function turnDataOf(produced: ReadonlyArray<{ seq: number; path: string }>) {
  const values = new Map([['deliverables', { produced }]])
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
  }
}

interface AssemblyBench {
  container: HTMLElement
  reads: Array<{ sessionId: string; path: string }>
  writes: Array<{ path: string; content: string }>
  files: Map<string, string>
  disposeMount(): Promise<void>
  unmount(): Promise<void>
}

/**
 * Assemble the whole client: real Context, registry, renderer, locale face,
 * session scope adapter, a bench-owned root frame + chat stand-in declaring
 * the plugin's consumed slots, then the real mountMdPreview. Remote read/
 * write/list record their calls over one mutable file table.
 */
async function assemble(produced: ReadonlyArray<{ seq: number; path: string }>): Promise<AssemblyBench> {
  const ctx = new Context()
  const bench: AssemblyBench = {
    container: document.createElement('div'),
    reads: [],
    writes: [],
    files: new Map([
      ['guide.md', '# Guide\n\nbody'],
      ['notes.md', '# Notes\n\nbody'],
    ]),
    disposeMount: async () => {},
    unmount: async () => {},
  }
  // The Remote boundary fake: one namespace object served both as the
  // 'remote.mdPreview' service (the UI fiber waits on it) and as a property
  // of the remote table — the production remote service exposes mounted
  // namespaces the same way, and mount.ts's closures read them off ctx.remote.
  const mdPreview = {
    read: (sessionId: string, path: string) => {
      bench.reads.push({ sessionId, path })
      const content = bench.files.get(path)
      if (content === undefined) {
        return Promise.resolve({ ok: false as const, error: { code: 'md-preview/not-found', message: `no ${path}` } })
      }
      return Promise.resolve({ ok: true as const, value: { path, content, fingerprint: 'v1' } })
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
  ctx.provide('locale', locale)
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.install(createSlotRenderer())
  ctx.slots.installLocale(locale)

  // The session scope: one live binding carrying the Chat snapshot the
  // preview-documents action selects over.
  const chatSnapshot = chatSnapshotOf(produced)
  const chatSource = { getSnapshot: () => chatSnapshot, subscribe: () => () => {} }
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
  const RootFrame = (kit: Record<string, unknown>): React.ReactNode => (
    <div>
      <div data-testid="overlay">{(kit.renderSlot as (key: string) => React.ReactNode)('shell.overlay', {})}</div>
      {(kit.SessionProvider as React.FC<{ children?: React.ReactNode }>)(
        { children: (kit.renderSlot as (key: string) => React.ReactNode)('bench.chat-view', {}) },
      )}
    </div>
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
    const owner = { turn: turnDataOf(produced), seq: 100, openFile: () => Promise.resolve() }
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

afterEach(() => { document.body.replaceChildren() })

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
      expect(buttonByAria(bench, 'Workspace docs')).toBeDefined()
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
      // The capsule's collapse requests through the leave entry too.
      await act(async () => { buttonByAria(bench, 'Workspace docs')!.click() })
      await flush()
      expect(bench.container.textContent).toContain('You have unsaved changes')
      expect(bench.container.querySelector('.dsh-md-preview-panel')).toBeTruthy()
      await act(async () => { buttonByAria(bench, 'Discard changes')!.click() })
      await flush()
      // The collapse executed: no target, the capsule is not pressed.
      expect(bench.container.querySelector('.dsh-md-preview-panel')).toBeNull()
      expect(buttonByAria(bench, 'Workspace docs')!.getAttribute('aria-pressed')).toBe('false')
      // Closed, the same entry enters the workspace browsing face.
      await act(async () => { buttonByAria(bench, 'Workspace docs')!.click() })
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

  it('collapses every outlet when the mount disposes', async () => {
    const bench = await assemble(PRODUCED)
    await act(async () => { buttonByText(bench, 'guide.md')!.click() })
    await flush()
    expect(bench.container.querySelector('.dsh-md-preview-panel')).toBeTruthy()
    await bench.disposeMount()
    await flush()
    expect(buttonByText(bench, 'guide.md')).toBeUndefined()
    expect(buttonByAria(bench, 'Preview documents')).toBeUndefined()
    expect(buttonByAria(bench, 'Workspace docs')).toBeUndefined()
    expect(bench.container.querySelector('.dsh-md-preview-panel')).toBeNull()
    await bench.unmount()
  })
})
