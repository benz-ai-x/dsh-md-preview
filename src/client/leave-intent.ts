/** One record's destructive intents share a first-request decision seat. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'

/** One requested way out of the current preview session. */
export type MdPreviewLeaveIntent =
  | { readonly kind: 'close' }
  | { readonly kind: 'switchFace' }
  | { readonly kind: 'reload' }

/** The leave-intent seat shared by every entry and the guarding panel. */
export interface LeaveIntentSeat {
  /**
   * Request one leave. Ignored while an earlier intent still waits behind
   * the guard — the pending target cannot be silently replaced.
   * @param intent - the requested close, face switch, or reload.
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
 * Create the leave-intent seat for one live document record.
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

/** A record-owned decision: every destructive intent shares the first pending request. */
export function createLeaveDecision(needsConfirmation: () => boolean, publish: (intent: MdPreviewLeaveIntent | null) => void) {
  const seat = createLeaveIntentSeat()
  let pending: { settle: (allow: boolean) => void } | undefined
  let disposed = false
  return {
    request(intent: MdPreviewLeaveIntent, signal: AbortSignal): boolean | Promise<boolean> {
      if (disposed || signal.aborted || pending !== undefined) return false
      if (!needsConfirmation()) return true
      seat.request(intent)
      return new Promise<boolean>((resolve) => {
        const abort = (): void => { settle(false) }
        const settle = (allow: boolean): void => {
          if (pending?.settle !== settle) return
          pending = undefined
          signal.removeEventListener('abort', abort)
          seat.clear()
          publish(null)
          resolve(allow && !disposed && !signal.aborted)
        }
        pending = { settle }
        signal.addEventListener('abort', abort, { once: true })
        publish(seat.getSnapshot())
        if (signal.aborted) settle(false)
      })
    },
    decide(allow: boolean): void { pending?.settle(allow) },
    dispose(): void { disposed = true; pending?.settle(false) },
  }
}
