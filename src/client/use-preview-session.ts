/**
 * The React adapter of the PreviewSession machine: it owns every effect —
 * the read lifecycle (target change aborts the previous read), the guarded
 * save (abort on target change, re-read after success), the toast timer, and
 * the one-shot close. The machine stays pure; this hook is the only place
 * the two meet.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { MdPreviewFile, MdPreviewWriteResult } from '../protocol.ts'
import type { MdPreviewTarget } from './preview-state.ts'
import { canSave, initialPreviewSession, isDirty, transition } from './preview-session.ts'

/** The adapter's inputs: the RPCs and dismissal from the plugin's apply world. */
export interface PanelDocumentSessionDeps {
  readonly read: (
    sessionId: SessionId,
    path: string,
    signal: AbortSignal,
  ) => Promise<RemoteResult<MdPreviewFile>>
  readonly write: (
    sessionId: SessionId,
    path: string,
    content: string,
    fingerprint: string | undefined,
    force: boolean,
    signal: AbortSignal,
  ) => Promise<RemoteResult<MdPreviewWriteResult>>
  readonly close: () => void
}

/** The panel-facing surface: machine state plus intent actions. */
export interface PanelDocumentSession {
  readonly state: ReturnType<typeof initialPreviewSession>
  readonly canSave: boolean
  readonly dirty: boolean
  readonly actions: {
    enterEdit(): void
    edit(draft: string): void
    save(force: boolean): void
    cancelEdit(): void
    reload(): void
    retryRead(): void
    requestClose(): void
    discard(): void
    keepEditing(): void
  }
}

/**
 * Run one PreviewSession for the current preview target.
 * @param deps - read/write RPCs and the panel dismissal.
 * @param target - the current preview target; null while the panel is closed.
 * @returns machine state with derived flags and intent actions.
 */
export function usePanelDocumentSession(
  deps: PanelDocumentSessionDeps,
  target: MdPreviewTarget | null,
): PanelDocumentSession {
  const { read, write, close } = deps
  const [state, dispatch] = useReducer(transition, undefined, initialPreviewSession)
  // Manual retry and the post-save re-read re-run the read effect for the
  // same target; only a target change is a full session reset.
  const [revision, setRevision] = useState(0)
  const lastTarget = useRef<MdPreviewTarget | null>(null)
  const saveController = useRef<AbortController | null>(null)

  useEffect(() => {
    if (target === null) {
      lastTarget.current = null
      return
    }
    const previous = lastTarget.current
    lastTarget.current = target
    const isNewTarget = previous === null
      || previous.sessionId !== target.sessionId
      || previous.path !== target.path
    dispatch({ type: isNewTarget ? 'READ_STARTED' : 'RETRY_READ' })
    const controller = new AbortController()
    void read(target.sessionId, target.path, controller.signal).then((result) => {
      if (controller.signal.aborted) return
      dispatch(result.ok
        ? { type: 'READ_RESOLVED', file: result.value }
        : { type: 'READ_FAILED', code: result.error.code, message: result.error.message })
    })
    return () => { controller.abort() }
  }, [read, target, revision])

  // A target change or unmount aborts an in-flight save so it cannot land on
  // the previous document; its outcome dispatch is skipped, and the new
  // target's READ_STARTED has already reset the machine.
  useEffect(() => () => { saveController.current?.abort() }, [])

  useEffect(() => {
    if (state.closeRequested) close()
  }, [state.closeRequested, close])

  useEffect(() => {
    if (!state.toast) return
    const timer = window.setTimeout(() => { dispatch({ type: 'TOAST_EXPIRED' }) }, 2000)
    return () => { window.clearTimeout(timer) }
  }, [state.toast])

  const enterEdit = useCallback(() => { dispatch({ type: 'ENTER_EDIT' }) }, [])
  const edit = useCallback((draft: string) => { dispatch({ type: 'EDIT', draft }) }, [])
  const cancelEdit = useCallback(() => { dispatch({ type: 'CANCEL_EDIT' }) }, [])
  const requestClose = useCallback(() => { dispatch({ type: 'REQUEST_CLOSE' }) }, [])
  const discard = useCallback(() => { dispatch({ type: 'DISCARD' }) }, [])
  const keepEditing = useCallback(() => { dispatch({ type: 'KEEP_EDITING' }) }, [])
  const retryRead = useCallback(() => { setRevision(value => value + 1) }, [])
  const reload = useCallback(() => {
    dispatch({ type: 'CANCEL_EDIT' })
    setRevision(value => value + 1)
  }, [])

  const save = useCallback((force: boolean): void => {
    if (target === null || state.content.state !== 'ready' || !canSave(state)) return
    const file = state.content.file
    const controller = new AbortController()
    saveController.current = controller
    dispatch({ type: 'SAVE_STARTED' })
    void write(target.sessionId, target.path, state.draft, force ? undefined : file.fingerprint, force, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        if (result.ok) {
          dispatch({ type: 'SAVE_RESOLVED', result: result.value })
          setRevision(value => value + 1)
        } else if (result.error.code === 'md-preview/conflict') {
          dispatch({ type: 'SAVE_CONFLICT' })
        } else {
          dispatch({ type: 'SAVE_FAILED', code: result.error.code, message: result.error.message })
        }
      })
  }, [state, target, write])

  return {
    state,
    canSave: canSave(state),
    dirty: isDirty(state),
    actions: { enterEdit, edit, save, cancelEdit, reload, retryRead, requestClose, discard, keepEditing },
  }
}
