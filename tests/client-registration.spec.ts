// @vitest-environment jsdom
/**
 * Client registration lifecycle against the real Cordis Context, Slot
 * registry, and Locale runtime (external boundaries stubbed): contribution
 * presence, mount ordering, rollback, and disposal.
 */

import { Context } from '@deepseek-ai/cordis'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { describe, expect, it, vi } from 'vitest'
import { MdChips } from '../src/client/MdChips.tsx'
import { PreviewAction } from '../src/client/PreviewAction.tsx'
import { PreviewOverlay } from '../src/client/PreviewOverlay.tsx'
import { inject, mountMdPreview } from '../src/client/mount.ts'
import { ownedDeliverables, previewableOf } from '../src/client/message-files.ts'
import { selectMdTurnFiles } from '../src/client/turn-files.ts'
import { TYPERT_REMOTE } from '../src/typert/remote-client.ts'

/** Remote table recording face; a plain provide keeps provider epochs stable. */
function remoteTable() {
  const mounted: unknown[] = []
  const unmounted: unknown[] = []
  return {
    mounted,
    unmounted,
    $mount(contribution: unknown): Promise<() => Promise<void>> {
      mounted.push(contribution)
      return Promise.resolve(async () => { unmounted.push(contribution) })
    },
  }
}

async function bench(options: { registrationFailure?: boolean } = {}) {
  const ctx = new Context()
  const remote = remoteTable()
  ctx.provide('remote', remote)
  const reads: Array<{ sessionId: string; path: string }> = []
  ctx.provide('remote.mdPreview', {
    read: (sessionId: string, path: string) => {
      reads.push({ sessionId, path })
      return Promise.resolve({ ok: true as const, value: { path, content: '# x' } })
    },
  })
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  await ctx.plugin(SlotRegistry).await()
  // Stub owners standing in for ui-layout's root entry and ui-chat's
  // turn-tail node: they declare the slots this plugin contributes into.
  // (The declaration tree does not require intermediate slots to exist; the
  // children table of any live entry can declare the keys its occupants need.)
  const disposeRoot = ctx.slots.register({
    name: 'root',
    children: {
      'shell.overlay': { kind: 'list', scope: 'root' },
      'conversation.chat.node': { kind: 'keyed', scope: 'session' },
    },
  } as never, () => null)
  const disposeChatNode = ctx.slots.register({
    name: 'conversation.chat.node',
    key: 'turn-tail',
    children: {
      'conversation.chat.turnTail': { kind: 'chain', scope: 'session' },
      'conversation.chat.assistant-actions': { kind: 'list', scope: 'session' },
    },
  } as never, () => null)
  if (options.registrationFailure === true) {
    vi.spyOn(ctx.slots, 'register').mockImplementationOnce(() => { throw new Error('slot registration failed') })
  }
  return { ctx, remote, reads, disposeRoot, disposeChatNode }
}

const entryFor = (ctx: Context, key: string, component: unknown) =>
  ctx.slots.entries(key).find(candidate => candidate.component === component)

describe('client registration lifecycle', () => {
  it('mounts the Remote contribution before registering UI', async () => {
    const { ctx, remote } = await bench()
    const fiber = ctx.plugin({ inject: [...inject], apply: clientCtx => mountMdPreview(clientCtx, TYPERT_REMOTE) })
    await fiber.await()
    expect(remote.mounted).toEqual([TYPERT_REMOTE])
    expect(entryFor(ctx, 'shell.overlay', PreviewOverlay)).toBeDefined()
    expect(entryFor(ctx, 'conversation.chat.turnTail', MdChips)).toBeDefined()
    expect(entryFor(ctx, 'conversation.chat.assistant-actions', PreviewAction)).toBeDefined()
    // The active locale is environment-derived (jsdom defaults to en), so
    // accept either dictionary: binding proves the namespace registered.
    const title = ctx.locale.bind('md-preview')('panel.title')
    expect(['Markdown 预览', 'Markdown preview']).toContain(title)
    await fiber.dispose()
    expect(remote.unmounted).toEqual([TYPERT_REMOTE])
    expect(entryFor(ctx, 'shell.overlay', PreviewOverlay)).toBeUndefined()
    expect(entryFor(ctx, 'conversation.chat.turnTail', MdChips)).toBeUndefined()
    expect(entryFor(ctx, 'conversation.chat.assistant-actions', PreviewAction)).toBeUndefined()
  })

  it('rolls the Remote mount back when UI registration fails', async () => {
    const { ctx, remote } = await bench({ registrationFailure: true })
    await expect(mountMdPreview(ctx, TYPERT_REMOTE)).rejects.toThrow(/slot registration failed/)
    expect(remote.unmounted).toEqual([TYPERT_REMOTE])
    expect(entryFor(ctx, 'shell.overlay', PreviewOverlay)).toBeUndefined()
  })

  it('unmounts both halves when mountMdPreview disposer runs', async () => {
    const { ctx, remote } = await bench()
    const dispose = await mountMdPreview(ctx, TYPERT_REMOTE)
    expect(remote.mounted).toHaveLength(1)
    await dispose()
    expect(remote.unmounted).toHaveLength(1)
    expect(entryFor(ctx, 'shell.overlay', PreviewOverlay)).toBeUndefined()
  })

  it('collapses contributions when the declaring owner unmounts', async () => {
    const { ctx, remote, disposeChatNode } = await bench()
    await mountMdPreview(ctx, TYPERT_REMOTE)
    expect(entryFor(ctx, 'conversation.chat.turnTail', MdChips)).toBeDefined()
    disposeChatNode()
    expect(entryFor(ctx, 'conversation.chat.turnTail', MdChips)).toBeUndefined()
    // The Remote namespace and the root-scope overlay survive the collapse.
    expect(entryFor(ctx, 'shell.overlay', PreviewOverlay)).toBeDefined()
    expect(remote.unmounted).toEqual([])
  })
})

/** Minimal TurnLocation fake carrying deliverables data. */
function turnWith(produced: ReadonlyArray<{ seq: number; path: string }>) {
  return {
    turn: 1,
    status: 'closed' as const,
    steps: [],
    start: undefined,
    end: undefined,
    data: new Map([['deliverables', { produced }]]),
  }
}

function ownerFor(produced: ReadonlyArray<{ seq: number; path: string }>, seq = 100) {
  return {
    turn: turnWith(produced),
    seq,
    openFile: () => Promise.resolve(),
  }
}

describe('selectMdTurnFiles', () => {
  it('claims turns with markdown and splits the row', () => {
    const matched = selectMdTurnFiles(ownerFor([
      { seq: 1, path: 'README.md' },
      { seq: 2, path: 'src/index.ts' },
      { seq: 3, path: 'notes.markdown' },
    ]))
    expect(matched?.previewable).toEqual(['README.md', 'notes.markdown'])
    expect(matched?.other).toEqual(['src/index.ts'])
  })
  it('declines turns without markdown and without vocabulary', () => {
    expect(selectMdTurnFiles(ownerFor([{ seq: 1, path: 'a.ts' }]))).toBeNull()
    expect(selectMdTurnFiles({ ...ownerFor([]), turn: { ...turnWith([]) } })).toBeNull()
  })
  it('applies the closing-seq cutoff', () => {
    const matched = selectMdTurnFiles(ownerFor([
      { seq: 1, path: 'a.md' },
      { seq: 200, path: 'late.md' },
    ], 100))
    expect(matched?.previewable).toEqual(['a.md'])
  })
})

describe('ownedDeliverables and previewableOf', () => {
  const snapshot = {
    nodes: {
      values: () => [
        {
          kind: 'turn-tail',
          data: { closing: { finalNode: { messageId: 'm-1', seq: 7 } } },
          location: { kind: 'turn', turn: turnWith([{ seq: 1, path: 'doc.md' }, { seq: 9, path: 'later.md' }]) },
        },
      ],
    },
  }
  it('finds the owning turn and fences by closing seq', () => {
    const owned = ownedDeliverables(snapshot as never, 'm-1')
    expect(owned?.seq).toBe(7)
    expect(previewableOf(owned as never)).toEqual(['doc.md'])
  })
  it('returns undefined for unknown messages', () => {
    expect(ownedDeliverables(snapshot as never, 'm-2')).toBeUndefined()
  })
})
