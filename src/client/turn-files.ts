/**
 * Turn-scoped produced-file readers for the browser half. Client-only and
 * deliverables-free at runtime: the vocabulary comes from the `deliverables`
 * Conversation Turn data published by ui-deliverables (absent when that
 * plugin is not composed — the selector declines and no chips render).
 */
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { TurnLocation } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-deliverables/client'
import { isPreviewable, splitPreviewable } from './preview-state.ts'

/** Structural slice of the deliverables Turn data the readers consume. */
interface DeliverablesData {
  readonly produced: ReadonlyArray<{ readonly seq: number; readonly path: string }>
}

/** Structural slice of the ui-chat turn-tail Turn data (closing facts). */
interface TurnTailData {
  readonly seq: number
  readonly closing?: { readonly finalNode: { readonly seq: number } } | null
}

/** Any turn-shaped holder whose data store answers the two keys we read. */
interface TurnDataHolder {
  readonly data: { get(key: 'deliverables'): DeliverablesData | undefined } & { get(key: 'turn-tail'): TurnTailData | undefined }
}

/** Structural slice of a Chat snapshot: the timeline is all we read. */
export interface TurnOutputsSnapshot {
  readonly timeline: {
    readonly turnOrder: readonly number[]
    readonly turns: ReadonlyMap<number, TurnDataHolder & { readonly status: string }>
  }
}

/** Produced paths of one closing Turn, first-seen order, seq-cutoff applied. */
export function producedPaths(turn: TurnLocation, seq: number): readonly string[] {
  return producedOf(turn as unknown as TurnDataHolder, seq)
}

/** The reading core over the structural holder (bench-friendly). */
function producedOf(turn: TurnDataHolder, seq: number): readonly string[] {
  const data = turn.data.get('deliverables')
  if (data === undefined) return []
  const paths: string[] = []
  const seen = new Set<string>()
  for (const produced of data.produced) {
    if (produced.seq > seq || seen.has(produced.path)) continue
    seen.add(produced.path)
    paths.push(produced.path)
  }
  return paths
}

/**
 * The previewable documents the session's newest turn produced — the quick
 * entry's source (#31). Only the newest turn in the timeline counts: an
 * earlier turn's outputs are never passed off as current. A closed turn
 * fences at its closing seq (the same boundary the chip row applies — the
 * turn-tail data's closing final node seq, falling back to the turn-end
 * seq); an open turn keeps its produced-so-far as live facts. Nothing is
 * parsed out of conversation prose, and no turn facts are copied — this
 * derives a view over the owning service's data on each call.
 * @param snapshot - the chat snapshot (timeline slice suffices).
 * @returns previewable produced paths, first-seen order; empty when the
 *   newest turn produced nothing previewable (or no turns exist).
 */
export function latestTurnPreviewable(snapshot: TurnOutputsSnapshot): readonly string[] {
  const { turnOrder, turns } = snapshot.timeline
  const newest = turnOrder.at(-1)
  if (newest === undefined) return []
  const turn = turns.get(newest)
  if (turn === undefined) return []
  const tail = turn.data.get('turn-tail')
  const cutoff = tail === undefined
    ? Number.POSITIVE_INFINITY
    : (tail.closing?.finalNode.seq ?? tail.seq)
  return producedOf(turn, cutoff).filter(isPreviewable)
}

/** Matched value for the turn-tail chain entry. */
export interface MdTurnFiles {
  /** Markdown documents this turn produced (open the preview panel). */
  readonly previewable: readonly string[]
  /** Every other produced file (keeps the shipped external-open behavior). */
  readonly other: readonly string[]
}

/**
 * Claim the turn-tail chain only for turns that produced at least one
 * previewable markdown document. Claimed turns render this plugin's chip row
 * (a superset of the shipped one); all other turns stay with ui-deliverables.
 * @param owner - turn-tail owner currency for the closing assistant message.
 * @returns the split paths when the turn produced markdown, otherwise null.
 */
export function selectMdTurnFiles(owner: TurnTailOwnerProps): MdTurnFiles | null {
  const paths = producedPaths(owner.turn, owner.seq)
  if (!paths.some(isPreviewable)) return null
  return splitPreviewable(paths)
}
