/** Source-safe MdPreview browser registration and Remote mount lifecycle. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-deliverables/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { MdPreviewFile } from '../protocol.ts'
import { MdChips } from './MdChips.tsx'
import { PreviewAction } from './PreviewAction.tsx'
import { PreviewOverlay } from './PreviewOverlay.tsx'
import { en, NS, zh } from './locale.ts'
import { createPreviewStore } from './preview-state.ts'
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
  const openPreview = (sessionId: SessionId) => (path: string): void => {
    previewTarget.set({ sessionId, path })
  }
  const read = (
    sessionId: SessionId,
    path: string,
    signal: AbortSignal,
  ): Promise<RemoteResult<MdPreviewFile>> => ctx.remote.mdPreview.read(sessionId, path, signal)

  // The right-docked panel: an additive shell.overlay entry, mounted for the
  // whole app lifetime and idle (renders null) while no target is set.
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'md-preview',
    order: 100,
    locale: NS,
    inject: () => ({
      hooks: { previewTarget },
      close: () => { previewTarget.set(null) },
      read,
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
