/** Preview target state shared by the conversation entries and the panel. */

import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { isTextPreviewCandidate } from '../document-kind.ts'

/** The document the preview panel currently shows; null while closed. */
export interface MdPreviewTarget {
  readonly sessionId: SessionId
  readonly path: string
  /** Entry face for the panel (default 'document'); 'browse' opens on the tree. */
  readonly face?: 'document' | 'browse'
}

/** Whole preview panel state: the current target or the closed state. */
export type MdPreviewState = MdPreviewTarget | null

/** Create the plugin-owned preview target store. */
export function createPreviewStore() {
  return createSnapshotStore<MdPreviewState>(null)
}

/** Trailing path segment; the part that identifies a file at a glance. */
export function basename(path: string): string {
  const at = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return at === -1 ? path : path.slice(at + 1)
}

/** A name-only candidate; opening still asks the Host to authorize text reading. */
export function isPreviewable(path: string): boolean {
  return isTextPreviewCandidate(path)
}

/** Produced paths of one turn split into previewable and externally-opened groups, first-seen order preserved. */
export function splitPreviewable(paths: readonly string[]): { previewable: string[]; other: string[] } {
  const previewable: string[] = []
  const other: string[] = []
  const seen = new Set<string>()
  for (const path of paths) {
    if (seen.has(path)) continue
    seen.add(path)
    if (isPreviewable(path)) previewable.push(path)
    else other.push(path)
  }
  return { previewable, other }
}
