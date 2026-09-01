/** The PreviewSession machine: pure transitions of one preview target's
 * lifecycle — read, edit session, save, prompts. No React, no DOM. */

import { describe, expect, it } from 'vitest'
import type { MdPreviewFile, MdPreviewWriteResult } from '../src/protocol.ts'
import {
  canSave,
  initialPreviewSession,
  isDirty,
  transition,
  type PreviewSessionAction,
  type PreviewSessionState,
} from '../src/client/preview-session.ts'

const FILE: MdPreviewFile = { path: 'README.md', content: '# Hi', fingerprint: 'v1' }
const WRITE_OK: { ok: true; value: MdPreviewWriteResult } = { ok: true, value: { path: 'README.md', fingerprint: 'v2' } }

/** Drive the machine from its initial state through a sequence of actions. */
function session(...actions: PreviewSessionAction[]): PreviewSessionState {
  return actions.reduce(transition, initialPreviewSession())
}

/** A loaded, viewed document. */
const loaded: PreviewSessionAction[] = [{ type: 'READ_RESOLVED', file: FILE }]

/** A loaded, edited document with a modified draft. */
const edited: PreviewSessionAction[] = [
  ...loaded,
  { type: 'ENTER_EDIT' },
  { type: 'EDIT', draft: '# Edited' },
]

describe('read lifecycle', () => {
  it('starts loading with a clean edit face', () => {
    const state = initialPreviewSession()
    expect(state.content).toEqual({ state: 'loading' })
    expect(state.face).toBe('view')
    expect(state.saving).toBe(false)
    expect(state.toast).toBe(false)
    expect(state.closeRequested).toBe(false)
  })

  it('READ_STARTED is the single reset point for everything', () => {
    const maximallyDirty = session(
      ...edited,
      { type: 'SAVE_STARTED' },
      { type: 'SAVE_CONFLICT' },
      { type: 'REQUEST_CLOSE' },
      { type: 'READ_RESOLVED', file: FILE },
      { type: 'SAVE_STARTED' },
      { type: 'SAVE_RESOLVED', result: WRITE_OK },
      { type: 'ENTER_EDIT' },
      { type: 'EDIT', draft: '# stale' },
    )
    const reset = transition(maximallyDirty, { type: 'READ_STARTED' })
    expect(reset).toEqual(initialPreviewSession())
  })

  it('resolves and fails the read', () => {
    expect(session(...loaded).content).toEqual({ state: 'ready', file: FILE })
    expect(session({ type: 'READ_FAILED', code: 'md-preview/not-found', message: 'gone' }).content)
      .toEqual({ state: 'failed', code: 'md-preview/not-found', message: 'gone' })
  })

  it('RETRY_READ refreshes content in place without killing the toast', () => {
    const saved = session(...edited, { type: 'SAVE_STARTED' }, { type: 'SAVE_RESOLVED', result: WRITE_OK })
    const refreshing = transition(saved, { type: 'RETRY_READ' })
    expect(refreshing.content).toEqual({ state: 'loading' })
    expect(refreshing.toast).toBe(true)
    expect(refreshing.face).toBe('view')
  })
})

describe('edit session', () => {
  it('ENTER_EDIT seeds the draft from the loaded document', () => {
    const state = session(...edited)
    expect(state.face).toBe('edit')
    expect(state.draft).toBe('# Edited')
    expect(isDirty(state)).toBe(true)
    expect(canSave(state)).toBe(true)
  })

  it('ENTER_EDIT is refused while not loaded', () => {
    const state = transition(initialPreviewSession(), { type: 'ENTER_EDIT' })
    expect(state.face).toBe('view')
  })

  it('an unchanged draft is not dirty and cannot save', () => {
    const state = session(...loaded, { type: 'ENTER_EDIT' })
    expect(isDirty(state)).toBe(false)
    expect(canSave(state)).toBe(false)
  })

  it('CANCEL_EDIT discards the draft back to the view', () => {
    const state = session(...edited, { type: 'CANCEL_EDIT' })
    expect(state.face).toBe('view')
    expect(isDirty(state)).toBe(false)
  })
})

describe('save', () => {
  it('SAVE_RESOLVED returns to the view and raises the toast', () => {
    const state = session(...edited, { type: 'SAVE_STARTED' }, { type: 'SAVE_RESOLVED', result: WRITE_OK })
    expect(state.face).toBe('view')
    expect(state.saving).toBe(false)
    expect(state.toast).toBe(true)
    expect(state.conflicted).toBe(false)
  })

  it('SAVE_CONFLICT keeps the edit face and allows force', () => {
    const conflicted = session(...edited, { type: 'SAVE_STARTED' }, { type: 'SAVE_CONFLICT' })
    expect(conflicted.face).toBe('edit')
    expect(conflicted.conflicted).toBe(true)
    expect(canSave(conflicted)).toBe(true)
    const forced = transition(conflicted, { type: 'SAVE_STARTED' })
    expect(forced.saveError).toBeNull()
  })

  it('SAVE_FAILED keeps a persistent, retryable error', () => {
    const state = session(...edited, { type: 'SAVE_STARTED' }, { type: 'SAVE_FAILED', code: 'md-preview/unavailable', message: 'io' })
    expect(state.face).toBe('edit')
    expect(state.saveError).toEqual({ code: 'md-preview/unavailable', message: 'io' })
    expect(state.saving).toBe(false)
  })

  it('TOAST_EXPIRED drops the toast', () => {
    const state = session(...edited, { type: 'SAVE_STARTED' }, { type: 'SAVE_RESOLVED', result: WRITE_OK }, { type: 'TOAST_EXPIRED' })
    expect(state.toast).toBe(false)
  })
})

describe('close', () => {
  it('a dirty draft raises the unsaved guard instead of closing', () => {
    const state = transition(session(...edited), { type: 'REQUEST_CLOSE' })
    expect(state.unsavedPrompt).toBe(true)
    expect(state.closeRequested).toBe(false)
  })

  it('a clean document closes immediately; DISCARD closes from the guard', () => {
    expect(transition(session(...loaded), { type: 'REQUEST_CLOSE' }).closeRequested).toBe(true)
    expect(transition(session(...edited, { type: 'REQUEST_CLOSE' }), { type: 'DISCARD' }).closeRequested).toBe(true)
  })

  it('KEEP_EDITING drops the guard', () => {
    const state = transition(session(...edited, { type: 'REQUEST_CLOSE' }), { type: 'KEEP_EDITING' })
    expect(state.unsavedPrompt).toBe(false)
    expect(state.closeRequested).toBe(false)
  })
})
