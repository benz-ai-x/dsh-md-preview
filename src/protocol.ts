/** Wire-level vocabulary shared by the Host service and the browser face. */

import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** One rendered-preview payload: the requested path, its full text, and freshness. */
export interface MdPreviewFile {
  /** The path exactly as requested by the caller (tool-produced spelling). */
  readonly path: string
  /** The complete file content, capped by the configured byte limit. */
  readonly content: string
  /** Opaque fs freshness token; pass it back to `write` to guard the save. */
  readonly fingerprint: string
}

/** One persisted write: the saved path and its new freshness token. */
export interface MdPreviewWriteResult {
  /** The path exactly as requested by the caller. */
  readonly path: string
  /** Freshness token of the file after the write; guards the next save. */
  readonly fingerprint: string
}

/** One directory entry of the workspace browser tree. */
export interface MdPreviewEntry {
  /** Entry basename as the fs layer reports it. */
  readonly name: string
  /** Regular file, directory, or anything else. */
  readonly type: 'file' | 'directory' | 'other'
  /** Workspace-relative path of the entry (the tree's node identity). */
  readonly path: string
}

/** One workspace directory listing. */
export interface MdPreviewListResult {
  /** The requested path as the caller spelled it (blank = workspace root). */
  readonly path: string
  /** Directory entries, folders first then alphabetical. */
  readonly entries: readonly MdPreviewEntry[]
}

/** Stable failure codes carried by `RemoteError` across the wire. */
export const MD_PREVIEW_FAILURE_CODES = [
  'md-preview/bad-request',
  'md-preview/unknown-session',
  'md-preview/no-workspace',
  'md-preview/unsupported-extension',
  'md-preview/forbidden',
  'md-preview/not-found',
  'md-preview/too-large',
  'md-preview/conflict',
  'md-preview/unavailable',
] as const

/** One stable MdPreview failure code. */
export type MdPreviewFailureCode = (typeof MD_PREVIEW_FAILURE_CODES)[number]

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** The request path was empty or otherwise unusable. */
    'md-preview/bad-request': {}
    /** The named Session does not exist. */
    'md-preview/unknown-session': {}
    /** The Session carries no working directory to root the read. */
    'md-preview/no-workspace': {}
    /** The target is not a previewable markdown document. */
    'md-preview/unsupported-extension': {}
    /** The resolved path escapes the session workspace. */
    'md-preview/forbidden': {}
    /** Nothing exists at the requested path. */
    'md-preview/not-found': {}
    /** The file exceeds the configured byte cap. */
    'md-preview/too-large': {}
    /** The file changed since the read backing this write's fingerprint. */
    'md-preview/conflict': {}
    /** The read itself failed. */
    'md-preview/unavailable': {}
  }
}

/** Read request shape as the browser face types it (wire fields stay flat). */
export interface MdPreviewReadRequest {
  /** Owning session whose workspace roots the read. */
  readonly sessionId: SessionId
  /** Path as it appeared in the conversation (absolute or workspace-relative). */
  readonly path: string
}
