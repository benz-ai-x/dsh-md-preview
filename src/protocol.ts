/** Wire-level vocabulary shared by the Host service and the browser face. */

import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** One rendered-preview payload: the requested path and its full text content. */
export interface MdPreviewFile {
  /** The path exactly as requested by the caller (tool-produced spelling). */
  readonly path: string
  /** The complete file content, capped by the configured byte limit. */
  readonly content: string
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
