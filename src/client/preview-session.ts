/**
 * The PreviewSession machine: the pure state algebra of one preview target's
 * lifecycle — content read, edit session, guarded save, prompts. The React
 * adapter lives beside the panel (use-preview-session.ts); effects and RPC
 * never enter here. `READ_STARTED` is the single reset point: a new read
 * begins only when the previous document's whole session is over. Leaving
 * with a dirty draft is asked about at the leave-intent seat (leave-intent.ts)
 * before anything reaches this machine, so no unsaved prompt lives here.
 */
import type { MdPreviewFile, MdPreviewWriteResult } from '../protocol.ts'

/** Content lifecycle of one preview target. */
export type PreviewSessionContent =
  | { readonly state: 'loading' }
  | { readonly state: 'ready'; readonly file: MdPreviewFile }
  | { readonly state: 'failed'; readonly code: string; readonly message: string }

/** Whole machine state for the panel's current preview target. */
export interface PreviewSessionState {
  /** Read lifecycle of the current target. */
  readonly content: PreviewSessionContent
  /** Panel face: rendering the document or editing a draft of it. */
  readonly face: 'view' | 'edit'
  /** The edit session's draft; meaningful only while `face` is edit. */
  readonly draft: string
  /** A save is in flight. */
  readonly saving: boolean
  /** The last save met a changed file; the conflict bar is up. */
  readonly conflicted: boolean
  /** The last save failed for a non-conflict reason; the error bar is up. */
  readonly saveError: { readonly code: string; readonly message: string } | null
  /** The saved toast is showing. */
  readonly toast: boolean
  /** The write succeeded and the confirming re-read has not settled yet (#23). */
  readonly savedPendingRead: boolean
  /** The session asked the shell to close the panel; the adapter acts once. */
  readonly closeRequested: boolean
}

/** One machine transition. */
export type PreviewSessionAction =
  | { readonly type: 'READ_STARTED' }
  | { readonly type: 'RETRY_READ' }
  | { readonly type: 'READ_RESOLVED'; readonly file: MdPreviewFile }
  | { readonly type: 'READ_FAILED'; readonly code: string; readonly message: string }
  | { readonly type: 'ENTER_EDIT' }
  | { readonly type: 'EDIT'; readonly draft: string }
  | { readonly type: 'SAVE_STARTED' }
  | { readonly type: 'SAVE_RESOLVED'; readonly result: MdPreviewWriteResult }
  | { readonly type: 'SAVE_CONFLICT' }
  | { readonly type: 'SAVE_FAILED'; readonly code: string; readonly message: string }
  | { readonly type: 'CANCEL_EDIT' }
  | { readonly type: 'REQUEST_CLOSE' }
  | { readonly type: 'TOAST_EXPIRED' }

/** The pristine state every session starts (and resets) from. */
export function initialPreviewSession(): PreviewSessionState {
  return {
    content: { state: 'loading' },
    face: 'view',
    draft: '',
    saving: false,
    conflicted: false,
    saveError: null,
    toast: false,
    savedPendingRead: false,
    closeRequested: false,
  }
}

/** Whether the draft differs from the loaded document. */
export function isDirty(state: PreviewSessionState): boolean {
  return state.face === 'edit' && state.content.state === 'ready' && state.draft !== state.content.file.content
}

/** The save-enable policy: something to save (dirty or conflicted), no save in flight. */
export function canSave(state: PreviewSessionState): boolean {
  return !state.saving && (isDirty(state) || state.conflicted)
}

/** Leave the edit face, clearing its prompts. */
function leaveEdit(state: PreviewSessionState): PreviewSessionState {
  return { ...state, face: 'view', conflicted: false, saveError: null }
}

/**
 * Apply one transition.
 * @param state - current machine state.
 * @param action - the transition.
 * @returns the next state (transitions are total; guards decline no-ops).
 */
export function transition(state: PreviewSessionState, action: PreviewSessionAction): PreviewSessionState {
  switch (action.type) {
    case 'READ_STARTED':
      // The single reset point for a NEW target: whatever was in flight or on
      // screen belongs to the previous document's session and dies here.
      return initialPreviewSession()
    case 'RETRY_READ':
      // Same target (manual retry, or the re-read after a successful save):
      // refresh the content only — the toast of the save that triggered this
      // re-read must outlive it.
      return { ...state, content: { state: 'loading' } }
    case 'READ_RESOLVED':
      return { ...state, content: { state: 'ready', file: action.file }, savedPendingRead: false }
    case 'READ_FAILED':
      // The mark survives: a failed re-read after a successful write is a
      // read failure the surface must not dress up as a write failure (#23).
      return { ...state, content: { state: 'failed', code: action.code, message: action.message } }
    case 'ENTER_EDIT':
      if (state.content.state !== 'ready' || state.face === 'edit') return state
      return {
        ...state,
        face: 'edit',
        draft: state.content.file.content,
        conflicted: false,
        saveError: null,
      }
    case 'EDIT':
      if (state.face !== 'edit') return state
      return { ...state, draft: action.draft }
    case 'SAVE_STARTED':
      return { ...state, saving: true, saveError: null }
    case 'SAVE_RESOLVED':
      // The write landed; the adapter's re-read will confirm the workspace
      // body — until it settles, a failure belongs to the read, not the save.
      return { ...state, face: 'view', conflicted: false, toast: true, saving: false, savedPendingRead: true }
    case 'SAVE_CONFLICT':
      return { ...state, conflicted: true, saving: false }
    case 'SAVE_FAILED':
      return { ...state, saveError: { code: action.code, message: action.message }, saving: false }
    case 'CANCEL_EDIT':
      return state.face === 'edit' ? leaveEdit(state) : state
    case 'REQUEST_CLOSE':
      // The leave-intent seat has already settled the unsaved guard; a close
      // reaching the machine executes. (The adapter's one-shot close acts.)
      return { ...state, closeRequested: true }
    case 'TOAST_EXPIRED':
      return { ...state, toast: false }
  }
}
