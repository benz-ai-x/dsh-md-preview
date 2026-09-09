import { describe, expect, it } from 'vitest'
import { ownedDeliverables, previewableOf } from '../src/client/message-files.ts'
import { latestTurnPreviewable, selectMdTurnFiles } from '../src/client/turn-files.ts'

/** Minimal TurnLocation fake carrying deliverables data. */
function turnWith(produced: ReadonlyArray<{ seq: number; path: string }>) {
  const values = new Map([['deliverables', { produced }]])
  return {
    turn: 1,
    status: 'closed' as const,
    steps: [],
    start: undefined,
    end: undefined,
    // The ConversationLocationDataStore contract (rc.1+) adds `source`; the
    // fake keeps Map semantics and answers source() from the same values.
    data: Object.assign(values, {
      source: (key: string) => ({ getSnapshot: () => values.get(key), subscribe: () => () => {} }),
    }),
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

/** A timeline-style snapshot over turn fakes, as ui-chat publishes them. */
function chatSnapshotOf(turns: ReadonlyArray<{ turn: number; produced: ReadonlyArray<{ seq: number; path: string }>; tail?: { seq: number; closingSeq?: number } | null; status?: 'open' | 'closed' }>) {
  const map = new Map(turns.map(entry => {
    const values = new Map<string, unknown>([['deliverables', { produced: entry.produced }]])
    if (entry.tail !== null && entry.tail !== undefined) {
      values.set('turn-tail', {
        turn: entry.turn,
        seq: entry.tail.seq,
        time: 0,
        closing: entry.tail.closingSeq === undefined ? null : { finalNode: { messageId: 'm', seq: entry.tail.closingSeq }, blocks: [] },
      })
    }
    return [entry.turn, {
      turn: entry.turn,
      status: entry.status ?? 'closed',
      steps: [],
      start: undefined,
      end: undefined,
      data: Object.assign(values, {
        source: (key: string) => ({ getSnapshot: () => values.get(key), subscribe: () => () => {} }),
      }),
    }]
  }))
  return { timeline: { turnOrder: turns.map(entry => entry.turn), turns: map } }
}

describe('latestTurnPreviewable (#31)', () => {
  it('derives the newest turn only, never an earlier turn\'s outputs', () => {
    const snapshot = chatSnapshotOf([
      { turn: 1, produced: [{ seq: 1, path: 'old.md' }], tail: { seq: 5, closingSeq: 4 } },
      { turn: 2, produced: [{ seq: 6, path: 'fresh.md' }], tail: { seq: 9, closingSeq: 8 } },
    ])
    expect(latestTurnPreviewable(snapshot as never)).toEqual(['fresh.md'])
  })

  it('fences closed turns at the closing seq, exactly like the chip row', () => {
    const snapshot = chatSnapshotOf([
      { turn: 1, produced: [
        { seq: 1, path: 'settled.md' },
        { seq: 900, path: 'post-close.md' },
      ], tail: { seq: 100, closingSeq: 99 } },
    ])
    expect(latestTurnPreviewable(snapshot as never)).toEqual(['settled.md'])
  })

  it('keeps an open turn\'s produced-so-far as live facts', () => {
    const snapshot = chatSnapshotOf([
      { turn: 1, produced: [{ seq: 1, path: 'streaming.md' }], tail: null, status: 'open' },
    ])
    expect(latestTurnPreviewable(snapshot as never)).toEqual(['streaming.md'])
  })

  it('keeps only previewable documents and returns nothing without turn facts', () => {
    const mixed = chatSnapshotOf([
      { turn: 1, produced: [
        { seq: 1, path: 'doc.md' },
        { seq: 2, path: 'run.ts' },
        { seq: 3, path: 'note.txt' },
      ], tail: { seq: 9, closingSeq: 8 } },
    ])
    expect(latestTurnPreviewable(mixed as never)).toEqual(['doc.md'])
    expect(latestTurnPreviewable(chatSnapshotOf([]) as never)).toEqual([])
    expect(latestTurnPreviewable({ timeline: { turnOrder: [7], turns: new Map() } } as never)).toEqual([])
  })
})
