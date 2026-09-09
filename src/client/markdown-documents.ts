/** In-memory document state belongs to tab records, which outlive their bodies. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ISidebarRight } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { MarkdownDocumentApi } from './document-api.ts'
import { canSave, initialPreviewSession, isDirty, transition } from './preview-session.ts'
import type { PreviewSessionAction, PreviewSessionState } from './preview-session.ts'
import { createLeaveDecision } from './leave-intent.ts'

export interface MarkdownDocument extends PreviewSessionState {
  readonly editor?: Record<string, unknown>
  readonly focusRevision?: number
}
export type MarkdownDocuments = Readonly<Record<string, MarkdownDocument>>
export interface MarkdownLeavePrompt { readonly key: string; readonly path: string }

export function documentKey(sessionId: SessionId, tabId: string): string {
  return JSON.stringify([sessionId, tabId])
}

export function createMarkdownDocuments(read: MarkdownDocumentApi['read'], write: MarkdownDocumentApi['write'], beforeClose: ISidebarRight['beforeClose']) {
  const snapshot = createSnapshotStore<MarkdownDocuments>({})
  const prompts = createSnapshotStore<readonly MarkdownLeavePrompt[]>([])
  interface RecordOwner {
    key: string
    fileSessionId: SessionId
    path: string
    signal: AbortSignal
    controller: AbortController
    leave: ReturnType<typeof createLeaveDecision>
    saving: Promise<void> | undefined
    navigation?: { revision: number; face: 'view' | 'edit' }
    release: () => void
  }
  const records = new Map<string, RecordOwner>()
  const tasks = new Set<Promise<void>>()
  let disposed = false
  const update = (record: RecordOwner, action: PreviewSessionAction): void => {
    if (disposed || record.controller.signal.aborted || records.get(record.key) !== record) return
    snapshot.set({ ...snapshot.getSnapshot(), [record.key]: transition(snapshot.getSnapshot()[record.key]!, action) })
  }
  const own = (task: Promise<void>): void => {
    const tracked = task.finally(() => { tasks.delete(tracked) })
    tasks.add(tracked)
  }
  const load = async (record: RecordOwner): Promise<void> => {
    update(record, { type: 'RETRY_READ' })
    try {
      const result = await read(record.fileSessionId, record.path, record.controller.signal)
      update(record, result.ok ? { type: 'READ_RESOLVED', file: result.value }
        : { type: 'READ_FAILED', code: result.error.code, message: result.error.message })
    } catch (error) {
      update(record, { type: 'READ_FAILED', code: 'md-preview/unavailable', message: String(error) })
    }
  }
  const attach = (sessionId: SessionId, tabId: Parameters<ISidebarRight['beforeClose']>[1], fileSessionId: SessionId, path: string, signal: AbortSignal): void => {
    if (disposed || signal.aborted) return
    const key = documentKey(sessionId, tabId)
    if (records.get(key)?.signal === signal) return
    records.get(key)?.release()
    const controller = new AbortController()
    const leave = createLeaveDecision(() => {
      const state = snapshot.getSnapshot()[key]
      return state !== undefined && isDirty(state)
    }, intent => {
      const others = prompts.getSnapshot().filter(prompt => prompt.key !== key)
      prompts.set(intent === null ? others : [...others, { key, path }])
    })
    const releaseGuard = beforeClose(sessionId, tabId, request => {
      const decide = () => leave.request({ kind: 'close' }, request.signal)
      return record.saving === undefined ? decide() : record.saving.then(decide)
    })
    const release = (): void => {
      releaseGuard()
      leave.dispose()
      controller.abort()
      signal.removeEventListener('abort', release)
      records.delete(key)
      const next = { ...snapshot.getSnapshot() }
      delete next[key]
      snapshot.set(next)
    }
    const record: RecordOwner = { key, fileSessionId, path, signal, controller, leave, release, saving: undefined }
    records.set(key, record)
    signal.addEventListener('abort', release, { once: true })
    snapshot.set({ ...snapshot.getSnapshot(), [key]: initialPreviewSession() })
    own(load(record))
  }
  return {
    snapshot, prompts, attach,
    restoreEditor(key: string): Record<string, unknown> | undefined {
      return snapshot.getSnapshot()[key]?.editor
    },
    takeNavigation(key: string, revision: number, face: 'view' | 'edit'): boolean {
      const record = records.get(key)
      if (record === undefined || (record.navigation?.revision === revision && record.navigation.face === face)) return false
      record.navigation = { revision, face }
      return true
    },
    decide(key: string, allow: boolean): void {
      const pending = prompts.getSnapshot().some(prompt => prompt.key === key)
      records.get(key)?.leave.decide(allow)
      const state = snapshot.getSnapshot()[key]
      if (!allow && pending && state !== undefined) {
        snapshot.set({ ...snapshot.getSnapshot(), [key]: { ...state, focusRevision: (state.focusRevision ?? 0) + 1 } })
      }
    },
    rememberEditor(key: string, editor: Record<string, unknown>): void {
      const state = snapshot.getSnapshot()[key]
      if (!disposed && records.has(key) && state?.face === 'edit') {
        snapshot.set({ ...snapshot.getSnapshot(), [key]: { ...state, editor } })
      }
    },
    enterEdit(key: string): void {
      const record = records.get(key)
      const state = snapshot.getSnapshot()[key]
      if (record !== undefined && state !== undefined && state.face !== 'edit') {
        const { editor: _editor, ...clean } = state
        snapshot.set({ ...snapshot.getSnapshot(), [key]: clean })
        update(record, { type: 'ENTER_EDIT' })
      }
    },
    edit(key: string, draft: string): void {
      const record = records.get(key)
      if (record !== undefined && !snapshot.getSnapshot()[key]?.saving) update(record, { type: 'EDIT', draft })
    },
    leave(key: string, kind: 'switchFace' | 'reload'): void {
      const record = records.get(key)
      if (record === undefined || snapshot.getSnapshot()[key]?.saving
        || snapshot.getSnapshot()[key]?.content.state === 'loading') return
      const settle = (allowed: boolean): void => {
        if (!allowed || disposed || record.controller.signal.aborted) return
        update(record, { type: 'CANCEL_EDIT' })
        if (kind === 'reload') own(load(record))
      }
      const decision = record.leave.request({ kind }, record.controller.signal)
      if (typeof decision === 'boolean') settle(decision)
      else own(decision.then(settle))
    },
    save(key: string, force: boolean): void {
      const record = records.get(key)
      const state = snapshot.getSnapshot()[key]
      if (record === undefined || state?.content.state !== 'ready' || !canSave(state)) return
      const fingerprint = force ? undefined : state.content.file.fingerprint
      update(record, { type: 'SAVE_STARTED' })
      const saving = (async () => {
        try {
          const result = await write(record.fileSessionId, record.path, state.draft, fingerprint, force, record.controller.signal)
          if (disposed || record.controller.signal.aborted) return
          if (result.ok) {
            update(record, { type: 'SAVE_RESOLVED', result: result.value })
            await load(record)
          } else {
            update(record, result.error.code === 'md-preview/conflict' ? { type: 'SAVE_CONFLICT' }
              : { type: 'SAVE_FAILED', code: result.error.code, message: result.error.message })
          }
        } catch (error) {
          update(record, { type: 'SAVE_FAILED', code: 'md-preview/unavailable', message: String(error) })
        }
      })().finally(() => { record.saving = undefined })
      record.saving = saving
      own(saving)
    },
    async dispose(): Promise<void> {
      disposed = true
      for (const record of records.values()) record.release()
      await Promise.all(tasks)
    },
  }
}
