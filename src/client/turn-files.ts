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

/** Produced paths of one closing Turn, first-seen order, seq-cutoff applied. */
export function producedPaths(turn: TurnLocation, seq: number): readonly string[] {
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
