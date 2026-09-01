/**
 * Message-id to produced-markdown lookup over the Chat snapshot. Pure and
 * bounded by the loaded window: the per-message preview action finds the
 * turn-tail node whose closing assistant message owns the id and reads the
 * same `deliverables` Turn data the chip row uses. The returned references
 * ride the snapshot's structural sharing, so selectors stay identity-stable
 * across unrelated publications.
 */
import type { ChatNode, ChatSnapshot } from '@deepseek-ai/dsh-client-ui-chat/client'
import { isPreviewable } from './preview-state.ts'

/** Deliverables Turn data plus the closing seq that fences it. */
export interface OwnedDeliverables {
  /** Raw `deliverables` Turn data reference (structurally shared). */
  readonly produced: readonly { readonly seq: number; readonly path: string }[]
  /** Closing assistant seq; later settlements are excluded downstream. */
  readonly seq: number
}

/**
 * Find the deliverables data of the turn whose closing message owns an id.
 * @param snapshot - current Chat target snapshot (loaded window only).
 * @param messageId - durable assistant message id from the action row.
 * @returns the turn's produced entries and closing seq, or undefined outside
 * the window or when the turn produced nothing.
 */
export function ownedDeliverables(snapshot: ChatSnapshot, messageId: string): OwnedDeliverables | undefined {
  for (const raw of snapshot.nodes.values()) {
    // The store hands back the base node; the runtime payload carries the
    // renderer kind, so narrow through the ChatNode union.
    const node = raw as unknown as ChatNode
    if (node.kind !== 'turn-tail') continue
    const closing = node.data.closing
    if (closing === null || closing.finalNode.messageId !== messageId) continue
    if (node.location.kind !== 'turn' && node.location.kind !== 'step') continue
    const data = node.location.turn.data.get('deliverables')
    if (data === undefined) return undefined
    return { produced: data.produced, seq: closing.finalNode.seq }
  }
  return undefined
}

/**
 * Previewable markdown documents of one turn, first-seen order, seq-cutoff applied.
 * @param owned - deliverables data and closing seq of one turn.
 * @returns previewable paths in first-seen order.
 */
export function previewableOf(owned: OwnedDeliverables): readonly string[] {
  const paths: string[] = []
  const seen = new Set<string>()
  for (const produced of owned.produced) {
    if (produced.seq > owned.seq || seen.has(produced.path)) continue
    seen.add(produced.path)
    if (isPreviewable(produced.path)) paths.push(produced.path)
  }
  return paths
}
