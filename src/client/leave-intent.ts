/**
 * The common leave-intent entry (#21): one seat through which every way out
 * of the current preview session is requested — the panel's close button,
 * Esc, the 「工作区文档」 collapse, the segmented switch back to the view
 * face, and every external open (produced-file chips, the preview-documents
 * action, tree rows). The seat holds the FIRST intent while the unsaved
 * guard asks; later requests are dropped, never silently swapped in. It is
 * UI-local viewing state only — no file or session facts live here, and it
 * owns no resources beyond the snapshot store.
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { MdPreviewTarget } from './preview-state.ts'

/** One requested way out of the current preview session. */
export type MdPreviewLeaveIntent =
  | { readonly kind: 'close' }
  | { readonly kind: 'switchFace' }
  | { readonly kind: 'open'; readonly target: MdPreviewTarget }

/** The leave-intent seat shared by every entry and the guarding panel. */
export interface LeaveIntentSeat {
  /**
   * Request one leave. Ignored while an earlier intent still waits behind
   * the guard — the pending target cannot be silently replaced.
   * @param intent - the requested close, face switch, or open.
   */
  request(intent: MdPreviewLeaveIntent): void
  /** Drop the pending intent (「继续编辑」, or after execution). */
  clear(): void
  /** Snapshot-store subscription face for the panel's binding. */
  subscribe(listener: () => void): () => void
  /** The pending intent, or null while none waits. */
  getSnapshot(): MdPreviewLeaveIntent | null
}

/**
 * Create the leave-intent seat for one plugin mount.
 * @returns the seat to inject into the entries and the preview panel.
 */
export function createLeaveIntentSeat(): LeaveIntentSeat {
  const store = createSnapshotStore<MdPreviewLeaveIntent | null>(null)
  return {
    request(intent: MdPreviewLeaveIntent): void {
      if (store.getSnapshot() !== null) return
      store.set(intent)
    },
    clear(): void {
      if (store.getSnapshot() !== null) store.set(null)
    },
    subscribe: store.subscribe,
    getSnapshot: store.getSnapshot,
  }
}
