/**
 * MdPreview Host Remote: reads one markdown document from a session's
 * workspace for in-browser rendering. The read is deliberately scoped: the
 * path must resolve inside the owning session's working directory, carry an
 * allowed extension, and stay under the configured byte cap.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-session'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { FsTarget, FsVersion } from '@deepseek-ai/dsh-fs'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { Config } from './config.ts'
import type { MdPreviewFile, MdPreviewFailureCode, MdPreviewWriteResult } from './protocol.ts'

/** Business rejection with a stable code; the transport preserves it verbatim. */
function failure(code: MdPreviewFailureCode, message: string): RemoteError {
  return new RemoteError(code, message, {})
}

/**
 * `FsErrorCode` of a caught fs-layer error, duck-typed off the `code` property
 * so the Host bundle keeps zero runtime imports beyond its declared peers.
 * @param error - anything thrown by `ctx.fs`.
 * @returns the stable fs code, or undefined for a foreign error shape.
 */
function fsErrorCode(error: unknown): string | undefined {
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string') return code
  }
  return undefined
}

/** Lowercased dot-prefixed extension of a path, or the empty string. */
function extensionOf(path: string): string {
  const name = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}

/** Whether a candidate extension passes the configured allowlist. */
export function isAllowedExtension(path: string, allowedExtensions: readonly string[]): boolean {
  const extension = extensionOf(path)
  return extension !== '' && allowedExtensions.includes(extension)
}

/**
 * Host Remote service exposing `mdPreview/read` over the Gateway.
 */
export class MdPreviewService extends TypertRemoteService {
  static inject = ['fs', 'typert', 'sessions']

  /**
   * Validated deployment configuration. TypeScript-private (not a `#` field):
   * Cordis wraps plugin instances in proxies, and private fields fail their
   * brand check through a proxy boundary.
   */
  private readonly config: Config

  /**
   * Bind the service to its Host context and validated configuration.
   * @param ctx - Host context carrying fs, typert, and sessions services.
   * @param config - Loader-validated deployment configuration.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'mdPreview', { namespace: 'mdPreview' })
    this.config = config
  }

  /**
   * Read one previewable file from the session's workspace.
   * @param sessionId - owning session; its header cwd roots the read.
   * @param path - path as it appeared in the conversation.
   * @param signal - caller cancellation carried through every fs call.
   * @returns the path with its complete text content.
   * @throws RemoteError with a stable MdPreview failure code.
   */
  @Remote
  async read(sessionId: SessionId, path: string, signal: AbortSignal): Promise<MdPreviewFile> {
    if (path.trim().length === 0) {
      throw failure('md-preview/bad-request', 'mdPreview/read requires a non-empty path')
    }
    if (!isAllowedExtension(path, this.config.allowedExtensions)) {
      throw failure('md-preview/unsupported-extension', `mdPreview/read refuses non-previewable path "${path}"`)
    }
    const session = this.ctx.sessions.get(sessionId)
    if (session === undefined) {
      throw failure('md-preview/unknown-session', `mdPreview/read cannot resolve session "${sessionId}"`)
    }
    const cwd = session.header.cwd
    if (cwd === undefined) {
      throw failure('md-preview/no-workspace', `mdPreview/read session "${sessionId}" has no working directory`)
    }
    const root = await this.resolveWorkspacePath(cwd, signal)
    let target: FsTarget
    try {
      target = await this.resolveWorkspacePath(path, signal, cwd)
    } catch (error) {
      // Caller cancellation is an outcome of the call, not a missing file.
      if (signal.aborted) throw error
      throw failure('md-preview/not-found', `mdPreview/read cannot resolve path "${path}"`)
    }
    if (!this.ctx.fs.contains(root, target)) {
      throw failure('md-preview/forbidden', 'mdPreview/read refuses paths outside the session workspace')
    }
    const info = await this.ctx.fs.stat(target, signal)
    if (info === undefined) {
      throw failure('md-preview/not-found', `mdPreview/read cannot find "${path}"`)
    }
    if (info.type !== 'file') {
      throw failure('md-preview/unsupported-extension', `mdPreview/read target "${path}" is not a regular file`)
    }
    if (info.size !== undefined && info.size > this.config.maxBytes) {
      throw failure('md-preview/too-large', `mdPreview/read refuses "${path}" above the configured byte cap`)
    }
    let content: string
    try {
      content = await this.ctx.fs.readText(target, signal)
    } catch (error) {
      if (signal.aborted) throw error
      throw failure('md-preview/unavailable', `mdPreview/read failed for "${path}": ${error instanceof Error ? error.message : String(error)}`)
    }
    if (content.length > this.config.maxBytes) {
      throw failure('md-preview/too-large', `mdPreview/read refuses "${path}" above the configured byte cap`)
    }
    return { path, content, fingerprint: info.version }
  }

  /**
   * Write one previewable file back into the session's workspace.
   * @param sessionId - owning session; its header cwd roots the write.
   * @param path - path as it appeared in the conversation.
   * @param content - the complete new file content.
   * @param fingerprint - freshness token from the backing read; required
   *   unless `force` opts into an unconditional overwrite.
   * @param force - skip the freshness guard (the conflict prompt's override).
   * @param signal - caller cancellation carried through every fs call.
   * @returns the saved path with its new freshness token.
   * @throws RemoteError with a stable MdPreview failure code.
   */
  @Remote
  async write(
    sessionId: SessionId,
    path: string,
    content: string,
    fingerprint: string | undefined,
    force: boolean,
    signal: AbortSignal,
  ): Promise<MdPreviewWriteResult> {
    if (path.trim().length === 0) {
      throw failure('md-preview/bad-request', 'mdPreview/write requires a non-empty path')
    }
    if (!isAllowedExtension(path, this.config.allowedExtensions)) {
      throw failure('md-preview/unsupported-extension', `mdPreview/write refuses non-previewable path "${path}"`)
    }
    const session = this.ctx.sessions.get(sessionId)
    if (session === undefined) {
      throw failure('md-preview/unknown-session', `mdPreview/write cannot resolve session "${sessionId}"`)
    }
    const cwd = session.header.cwd
    if (cwd === undefined) {
      throw failure('md-preview/no-workspace', `mdPreview/write session "${sessionId}" has no working directory`)
    }
    const root = await this.resolveWorkspacePath(cwd, signal)
    let target: FsTarget
    try {
      target = await this.resolveWorkspacePath(path, signal, cwd)
    } catch (error) {
      if (signal.aborted) throw error
      throw failure('md-preview/not-found', `mdPreview/write cannot resolve path "${path}"`)
    }
    if (!this.ctx.fs.contains(root, target)) {
      throw failure('md-preview/forbidden', 'mdPreview/write refuses paths outside the session workspace')
    }
    const info = await this.ctx.fs.stat(target, signal)
    if (info === undefined) {
      throw failure('md-preview/not-found', `mdPreview/write cannot find "${path}"`)
    }
    if (info.type !== 'file') {
      throw failure('md-preview/unsupported-extension', `mdPreview/write target "${path}" is not a regular file`)
    }
    if (content.length > this.config.maxBytes) {
      throw failure('md-preview/too-large', `mdPreview/write refuses "${path}" above the configured byte cap`)
    }
    if (fingerprint === undefined && !force) {
      throw failure('md-preview/bad-request', 'mdPreview/write requires a fingerprint or force')
    }
    const expected = fingerprint === undefined
      ? undefined
      : { kind: 'replaceIfVersion' as const, version: fingerprint as FsVersion }
    // Per-call sandbox policy carrying the session's cwd as the workspace
    // root — the same convention as the tool layer's mutating tools. Without
    // it a confining backend fences against its global standing root, which
    // is not this session's workspace.
    const sandboxPolicy: SandboxExecutionPolicy = {
      mode: 'workspace-write',
      workspaceRoot: cwd,
      sessionId,
    }
    let outcome: { version: string }
    try {
      outcome = await this.ctx.fs.writeText(target, content, expected, signal, sandboxPolicy) as { version: string }
    } catch (error) {
      if (signal.aborted) throw error
      const code = fsErrorCode(error)
      if (code === 'FS_STALE_VERSION') {
        throw failure('md-preview/conflict', `mdPreview/write refuses "${path}": the file changed since read`)
      }
      if (code === 'FS_NOT_FOUND') {
        throw failure('md-preview/not-found', `mdPreview/write cannot find "${path}"`)
      }
      if (code === 'FS_SANDBOX_DENIED') {
        throw failure('md-preview/forbidden', `mdPreview/write is not permitted inside the session workspace for "${path}"`)
      }
      throw failure('md-preview/unavailable', `mdPreview/write failed for "${path}": ${error instanceof Error ? error.message : String(error)}`)
    }
    return { path, fingerprint: outcome.version }
  }

  /** Resolve one path against the workspace, with a plain not-found mapping. */
  private async resolveWorkspacePath(path: string, signal: AbortSignal, cwd?: string): Promise<FsTarget> {
    return await this.ctx.fs.resolve(path, cwd === undefined ? { signal } : { cwd, signal })
  }
}
