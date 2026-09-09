// @vitest-environment jsdom
/** Retained conversation action uses native resource navigation with owning session facts. */
import { act } from 'react-dom/test-utils'
import { describe, expect, it } from 'vitest'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import { mountSidebar, SESSION } from './sidebar-harness.tsx'

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


async function assemble(produced: ReadonlyArray<{ seq: number; path: string }>) {
  const chat = createSnapshotStore(chatSnapshotOf(produced))
  const h = await mountSidebar({ beforePlugin(runtime) {
    runtime.ctx.uiSession.provide({ hooks: ['chat'], resolve: () => ({ hooks: { chat: chat as never } }) })
  } })
  const action = h.runtime.renderSlot('conversation.chat.assistant-actions', { messageId: 'm-1' })
  return { ...h, action }
}

describe('conversation Markdown navigation', () => {
  it('opens an absolute produced path inside cwd as the same native resource as a relative tree entry', async () => {
    const h = await assemble([{ seq: 1, path: '/workspace/a/guide.md' }])
    await act(async () => { h.action.view.getByRole('button', { name: 'Preview documents' }).click() })
    expect(h.reads).toEqual([{ sessionId: SESSION, path: 'guide.md' }])
    const tab = h.runtime.ctx.sidebarRight.active()!.id
    await act(async () => { h.runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md'), { params: { line: 3 } }) })
    expect(h.runtime.ctx.sidebarRight.active()!.id).toBe(tab)
    expect(h.reads).toHaveLength(1)
  })

  it('keeps encoded paths distinct and offers only this message’s Markdown deliverables', async () => {
    const h = await assemble([{ seq: 1, path: 'notes/a #1%.md' }, { seq: 2, path: 'b.markdown' }, { seq: 3, path: 'code.ts' }, { seq: 9, path: 'later.md' }])
    await act(async () => { h.action.view.getByRole('button', { name: 'Preview documents' }).click() })
    expect(h.action.view.getAllByRole('menuitem')).toHaveLength(2)
    await act(async () => { h.action.view.getByRole('menuitem', { name: 'a #1%.md' }).click() })
    expect(h.reads).toEqual([{ sessionId: SESSION, path: 'notes/a #1%.md' }])
    expect(h.view.view.getByRole('heading', { name: 'Migrated Markdown' })).toBeTruthy()
  })

  it('contributes no action when the owning message has no Markdown', async () => {
    const h = await assemble([{ seq: 1, path: 'code.ts' }])
    expect(h.action.view.queryByRole('button', { name: 'Preview documents' })).toBeNull()
  })
})
