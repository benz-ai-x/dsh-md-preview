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
import type { FsTarget } from '@deepseek-ai/dsh-fs'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { Config } from './config.ts'
import type { MdPreviewFile, MdPreviewFailureCode } from './protocol.ts'

/** Business rejection with a stable code; the transport preserves it verbatim. */
function failure(code: MdPreviewFailureCode, message: string): RemoteError {
  return new RemoteError(code, message, {})
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
    return { path, content }
  }

  /** Resolve one path against the workspace, with a plain not-found mapping. */
  private async resolveWorkspacePath(path: string, signal: AbortSignal, cwd?: string): Promise<FsTarget> {
    return await this.ctx.fs.resolve(path, cwd === undefined ? { signal } : { cwd, signal })
  }
}
