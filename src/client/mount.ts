/** Source-safe MdPreview browser registration and Remote mount lifecycle. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-deliverables/client'
// The layout package's type merge declares the shell.overlay slot key.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { MdPreviewFile, MdPreviewListResult, MdPreviewSearchResult, MdPreviewWriteResult } from '../protocol.ts'
import type { MdPreviewTarget } from './preview-state.ts'
import { MdChips } from './MdChips.tsx'
import { PreviewAction } from './PreviewAction.tsx'
import { PreviewOverlay } from './PreviewOverlay.tsx'
import { WorkspaceDocsAction } from './WorkspaceDocsAction.tsx'
import { en, NS, zh } from './locale.ts'
import { createPreviewStore } from './preview-state.ts'
import { createLeaveIntentSeat } from './leave-intent.ts'
import { browserStorage, createMemoryStorage, createReadingStore } from './reading.ts'
import { createPanelPreferenceStore } from './preferences.ts'
import { selectMdTurnFiles } from './turn-files.ts'
import { ensureStyles } from './styles.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** MdPreview panel, chips, and action copy. */
    'md-preview': import('./locale.ts').MdPreviewKey
  }
}

/** Required browser services for the Remote mount, slots, and locale. */
export const inject = ['remote', 'slots', 'locale']

function registerUi(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-md-preview: dictionaries')
  ensureStyles()
  const previewTarget = createPreviewStore()
  // The common leave-intent entry (#21): every outlet requests opens and
  // closes here; the panel owns the guard and the execution. UI-local
  // viewing state only — it dies with the mount.
  const leave = createLeaveIntentSeat()
  // The measured host session-header strip (#22): the capsule publishes its
  // bottom; the panel starts below it so the entry stays clickable while
  // open. Plain UI-local geometry — zero when nothing publishes.
  const headerStrip = createSnapshotStore<number>(0)
  // The reading record (#25): per-(session, path) positions over the
  // browser's localStorage when reachable, else in-memory for the session.
  // UI-local viewing state only — positions, never bodies or fingerprints.
  const reading = createReadingStore(browserStorage() ?? createMemoryStorage())
  // The panel preference record (#26): manual geometry and navigation
  // choices over the same storage discipline.
  const preferences = createPanelPreferenceStore(browserStorage() ?? createMemoryStorage())
  const openPreview = (sessionId: SessionId) => (path: string): void => {
    leave.request({ kind: 'open', target: { sessionId, path } })
  }
  const read = (
    sessionId: SessionId,
    path: string,
    signal: AbortSignal,
  ): Promise<RemoteResult<MdPreviewFile>> => ctx.remote.mdPreview.read(sessionId, path, signal)
  const write = (
    sessionId: SessionId,
    path: string,
    content: string,
    fingerprint: string | undefined,
    force: boolean,
    signal: AbortSignal,
  ): Promise<RemoteResult<MdPreviewWriteResult>> =>
    ctx.remote.mdPreview.write(sessionId, path, content, fingerprint, force, signal)
  const list = (
    sessionId: SessionId,
    path: string,
    signal: AbortSignal,
  ): Promise<RemoteResult<MdPreviewListResult>> =>
    ctx.remote.mdPreview.list(sessionId, path, signal)
  const search = (
    sessionId: SessionId,
    query: string,
    signal: AbortSignal,
  ): Promise<RemoteResult<MdPreviewSearchResult>> =>
    ctx.remote.mdPreview.search(sessionId, query, signal)
  const setTarget = (target: MdPreviewTarget | null): void => { previewTarget.set(target) }

  // The right-docked overlay panel: an additive shell.overlay entry, mounted
  // for the whole app lifetime and idle (renders null) while no target is
  // set. It stacks in the host's overlay layer above the frame; the panel
  // owns its width (left-edge drag) and dismissal — the host details column
  // keeps its shipped tool/approval surface, untouched.
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'md-preview-panel',
    order: 80,
    locale: NS,
    inject: () => ({
      hooks: { previewTarget },
      leave,
      headerStrip,
      close: () => { previewTarget.set(null) },
      setTarget,
      read,
      write,
      list,
      search,
      reading,
      preferences,
    }),
  }, PreviewOverlay))

  // The markdown-aware chip row: claims turns that produced markdown. The
  // negative priority outranks ui-deliverables' entry (default 0) for those
  // turns only; every other turn still resolves to the shipped row.
  ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
    name: 'conversation.chat.turnTail',
    priority: -100,
    select: selectMdTurnFiles,
    locale: NS,
    inject: (sessionId: SessionId) => ({ openPreview: openPreview(sessionId) }),
  }, MdChips))

  // The per-message action: additive list id, hidden without markdown.
  ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
    name: 'conversation.chat.assistant-actions',
    id: 'md-preview',
    order: 50,
    locale: NS,
    inject: (sessionId: SessionId) => ({ openPreview: openPreview(sessionId) }),
  }, PreviewAction))

  // The workspace-docs browse capsule: joins the Session Header's right-side
  // utilities, rendered ascending by order — the shipped Session-log download
  // capsule sits at the default 0, so order 100 parks us to its right. Session
  // scope hands the component its Session directly; the overlay appears on
  // target set, no host column involved.
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'md-preview-docs',
    order: 100,
    locale: NS,
    inject: () => ({ hooks: { previewTarget }, leave, headerStrip }),
  }, WorkspaceDocsAction))
}

/**
 * Mount the MdPreview Remote contribution, then register its browser UI.
 * @param ctx - client root context carrying the Remote table, slots, and locale.
 * @param contribution - this package's Remote descriptors.
 * @returns disposer for both the UI registrations and the Remote namespace.
 */
export async function mountMdPreview(
  ctx: ClientContext,
  contribution: TypertRemoteContribution,
): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(contribution)
  const ui = ctx.inject(['remote.mdPreview', 'slots', 'locale'], registerUi)
  try {
    await ui
  } catch (error) {
    await ui.dispose()
    await disposeRemote()
    throw error
  }
  return async () => {
    await ui.dispose()
    await disposeRemote()
  }
}
