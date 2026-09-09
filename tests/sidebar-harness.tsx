// @vitest-environment jsdom
/** Native sidebar assembly with external Remote and resource-metadata fixtures. */
import { act } from 'react-dom/test-utils'
import { afterEach, beforeAll } from 'vitest'
import { SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import * as sidebarRight from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { mountMdPreview } from '../src/client/mount.ts'
import { TYPERT_REMOTE } from '../src/typert/remote-client.ts'
import type { MarkdownDocumentApi } from '../src/client/document-api.ts'

export const SESSION = 'markdown-session-a' as SessionId
const cleanup: Array<() => Promise<void>> = []

beforeAll(() => {
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value) },
    removeItem: (key: string) => { storage.delete(key) },
    clear: () => storage.clear(),
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() { return storage.size },
  } })
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
  Object.defineProperty(Element.prototype, 'getAnimations', { configurable: true, value: () => [] })
  ;(Range.prototype as unknown as { getClientRects?: () => [] }).getClientRects ??= () => []
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await act(dispose)
})

export async function mountSidebar(options: { beforePlugin?: (runtime: SlotTestRuntime, events: string[]) => void } = {}) {
  const runtime = await SlotTestRuntime.create()
  cleanup.push(() => runtime.dispose())
  const locale = new LocaleRuntime(runtime.ctx)
  runtime.ctx.provide('locale', locale)
  runtime.slots.installLocale(locale)
  runtime.ctx.provide('layout', { openRightbar() {}, closeRightbar() {} } as never)
  runtime.ctx.provide('resources', { pin() {} } as never)
  type Metadata = {
    status: 'none' | 'live'
    value: { absolutePath: string; version: string; changed: boolean } | undefined
    failure: undefined
    reload: () => void
  }
  const resourceSources = new Map<string, ReturnType<typeof createSnapshotStore<Metadata>>>()
  const metadata = (address: string) => {
    let source = resourceSources.get(address)
    if (!source) {
      source = createSnapshotStore<Metadata>({ status: 'none', value: undefined, failure: undefined, reload() {} })
      resourceSources.set(address, source)
    }
    return source
  }
  runtime.slots.provideRoot({ keyedHooks: { resource: metadata } })
  const reads: Array<{ sessionId: SessionId; path: string }> = []
  const writes: Array<{ sessionId: SessionId; path: string; content: string; fingerprint: string | undefined; force: boolean }> = []
  const mountEvents: string[] = []
  const files = new Map<string, { content: string; fingerprint: string }>()
  const remote: { $mount: () => Promise<() => Promise<void>>; mdPreview: MarkdownDocumentApi } = {
    $mount: async () => { mountEvents.push('mount'); return async () => { mountEvents.push('unmount') } },
    mdPreview: {
      read: async (sessionId: SessionId, path: string) => {
        reads.push({ sessionId, path })
        return { ok: true as const, value: { path, ...(files.get(`${sessionId}/${path}`) ?? { content: '# Migrated Markdown\n\n**Ready**\n', fingerprint: 'v1' }) } }
      },
      write: async (sessionId: SessionId, path: string, content: string, fingerprint: string | undefined, force: boolean) => {
        writes.push({ sessionId, path, content, fingerprint, force })
        const current = files.get(`${sessionId}/${path}`)?.fingerprint ?? 'v1'
        if (!force && fingerprint !== current) return { ok: false, error: { code: 'md-preview/conflict', message: 'File changed', details: {} } }
        files.set(`${sessionId}/${path}`, { content, fingerprint: 'v2' })
        return { ok: true as const, value: { path, fingerprint: 'v2' } }
      },
    },
  }
  runtime.ctx.provide('remote', remote as never)
  runtime.ctx.provide('remote.mdPreview', remote.mdPreview as never)
  await runtime.declare({
    'rightbar': { kind: 'single', scope: 'session' },
    'conversation.session.header.corner': { kind: 'single', scope: 'session' },
    'conversation.session.header.utilities': { kind: 'list', scope: 'session' },
    'conversation.chat.turnTail': { kind: 'chain', scope: 'session' },
    'conversation.chat.assistant-actions': { kind: 'list', scope: 'session' },
    'shell.overlay': { kind: 'list', scope: 'root' },
  })
  await runtime.sessions.add({ id: SESSION, summary: { cwd: '/workspace/a' } })
  await runtime.mount(sidebarRight)
  runtime.ctx.sidebarRightTabs.register({
    id: 'fixture/native-text', kind: 'text', patterns: ['dsh-resource://file/**'], priority: 'fallback',
    title: address => address.slice(address.lastIndexOf('/') + 1),
  })
  runtime.slots.register({ name: 'sidebar.right.pane.tab', key: 'fixture/native-text' }, () => <p>Native text fallback</p>)
  let disposePlugin!: () => Promise<void>
  options.beforePlugin?.(runtime, mountEvents)
  await act(async () => {
    disposePlugin = await mountMdPreview(runtime.ctx, TYPERT_REMOTE)
    cleanup.push(disposePlugin)
  })
  const view = runtime.renderSlot('rightbar', { width: 560, viewportWidth: 1440, canShow: true })
  runtime.renderSlot('shell.overlay', {})
  return { runtime, view, reads, writes, files, remote: remote.mdPreview, metadata, disposePlugin, mountEvents }
}
