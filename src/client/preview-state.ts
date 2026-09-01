/** Preview target state shared by the conversation entries and the panel. */

import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { DEFAULT_ALLOWED_EXTENSIONS } from '../constants.ts'

/** The document the preview panel currently shows; null while closed. */
export interface MdPreviewTarget {
  readonly sessionId: SessionId
  readonly path: string
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

/** Lowercased dot-prefixed extension of a path, or the empty string. */
function extensionOf(path: string): string {
  const name = basename(path)
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}

/** Extensions the client offers to preview (kept in sync with the Host default). */
const PREVIEWABLE_EXTENSIONS: readonly string[] = [...DEFAULT_ALLOWED_EXTENSIONS]

/** The editable set mirror (Host config cannot reach the browser bundle). */
const EDITABLE_EXTENSIONS: readonly string[] = [...DEFAULT_ALLOWED_EXTENSIONS]

/** Whether the client treats a produced path as a previewable markdown document. */
export function isPreviewable(path: string): boolean {
  const extension = extensionOf(path)
  return extension !== '' && PREVIEWABLE_EXTENSIONS.includes(extension)
}

/** Whether a path may enter an edit session (the markdown-only editable set). */
export function isEditable(path: string): boolean {
  const extension = extensionOf(path)
  return extension !== '' && EDITABLE_EXTENSIONS.includes(extension)
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
