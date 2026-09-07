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
import type { FsDirEntry, FsInfo, FsTarget, FsVersion } from '@deepseek-ai/dsh-fs'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { Config } from './config.ts'
import type {
  MdPreviewEntry, MdPreviewFile, MdPreviewFailureCode, MdPreviewListResult,
  MdPreviewSearchLimit, MdPreviewSearchMatch, MdPreviewSearchResult, MdPreviewWriteResult,
} from './protocol.ts'

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

/** Workspace-relative form of an entry target, falling back to its name. */
function workspaceRelative(rootPath: string, targetPath: string, name: string): string {
  if (targetPath === rootPath) return name
  const prefix = rootPath.endsWith('/') ? rootPath : `${rootPath}/`
  return targetPath.startsWith(prefix) ? targetPath.slice(prefix.length) : name
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
    // Reads admit the preview union; writes (below) stay markdown-only.
    const { target, info } = await this.resolveWorkspaceTarget(sessionId, path, signal, 'read', [...this.config.allowedExtensions, ...this.config.previewExtensions])
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
    const { target, cwd } = await this.resolveWorkspaceTarget(sessionId, path, signal, 'write', this.config.allowedExtensions)
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

  /**
   * List one workspace directory for the browser face; folders sort first,
   * then entries alphabetize by name. A blank path lists the workspace root.
   * @param sessionId - owning session; its header cwd roots the listing.
   * @param path - directory path as the tree spelled it; blank = root.
   * @param signal - caller cancellation carried through every fs call.
   * @returns the requested path with its workspace-relative entries.
   * @throws RemoteError with a stable MdPreview failure code.
   */
  @Remote
  async list(sessionId: SessionId, path: string, signal: AbortSignal): Promise<MdPreviewListResult> {
    const { root, target } = await this.resolveContainedTarget(sessionId, path, signal, 'list')
    const info = await this.ctx.fs.stat(target, signal)
    if (info === undefined) {
      throw failure('md-preview/not-found', `mdPreview/list cannot find "${path}"`)
    }
    if (info.type !== 'directory') {
      throw failure('md-preview/bad-request', `mdPreview/list requires a directory path, not "${path}"`)
    }
    let raw: readonly FsDirEntry[]
    try {
      raw = await this.ctx.fs.listDir(target, signal)
    } catch (error) {
      if (signal.aborted) throw error
      throw failure('md-preview/unavailable', `mdPreview/list failed to list "${path}": ${error instanceof Error ? error.message : String(error)}`)
    }
    const rootPath = root.displayPath
    const entries: MdPreviewEntry[] = raw.map(entry => ({
      name: entry.name,
      type: entry.type,
      path: workspaceRelative(rootPath, entry.target.displayPath, entry.name),
    }))
    entries.sort((a, b) =>
      a.type === b.type || (a.type !== 'directory' && b.type !== 'directory')
        ? a.name.localeCompare(b.name)
        : a.type === 'directory' ? -1 : 1)
    return { path: path.trim().length === 0 ? '' : path, entries }
  }

  /**
   * Search previewable documents by name across the whole session workspace,
   * including directories the browser face never expanded. First-version
   * semantics: case-insensitive substring match on the entry name. The walk
   * stays inside the session authority (root resolve + containment, visited
   * dedupe so links cannot loop it), never reads file bodies, and reports
   * honestly whether the answer is complete — a permission failure, a
   * traversal bound, or the result cap each mark it incomplete with the
   * matching limit.
   * @param sessionId - owning session; its header cwd roots the walk.
   * @param query - raw search text; matched case-insensitively against names.
   * @param signal - caller cancellation carried through every fs call.
   * @returns the query, its matches with workspace-relative paths, and
   *   whether the walk finished whole.
   * @throws RemoteError with a stable MdPreview failure code.
   */
  @Remote
  async search(sessionId: SessionId, query: string, signal: AbortSignal): Promise<MdPreviewSearchResult> {
    const q = query.trim().toLowerCase()
    if (q.length === 0) {
      throw failure('md-preview/bad-request', 'mdPreview/search requires a non-empty query')
    }
    const { root } = await this.resolveContainedTarget(sessionId, '', signal, 'search')
    const rootPath = root.displayPath
    const previewable = [...this.config.allowedExtensions, ...this.config.previewExtensions]
    const matches: MdPreviewSearchMatch[] = []
    const limits = new Set<MdPreviewSearchLimit>()
    // BFS over directory targets, keyed by resolved display path so a
    // revisiting link target never re-enters the walk. `visited` counts
    // every directory admitted to the walk; the traversal bound caps it.
    // The frontier carries the fs layer's own FsTarget objects — entries
    // arrive with real targets and the root comes from resolve, never a
    // reconstructed shape (the backend's contract is {targetKey, displayPath}).
    const visited = new Set<string>([rootPath])
    let frontier: FsTarget[] = [root]
    while (frontier.length > 0) {
      if (signal.aborted) throw new DOMException('aborted', 'AbortError')
      const batch = frontier.splice(0, this.config.searchConcurrency)
      const listings = await Promise.all(batch.map(async dir => {
        try {
          const entries = await this.ctx.fs.listDir(dir, signal)
          return { entries: entries as readonly FsDirEntry[] }
        } catch (error) {
          if (signal.aborted) throw error
          return { entries: null }
        }
      }))
      for (const { entries } of listings) {
        if (entries === null) {
          limits.add('directory-failure')
          continue
        }
        for (const entry of entries) {
          if (entry.type === 'file' && entry.name.toLowerCase().includes(q)
            && isAllowedExtension(entry.name, previewable)) {
            matches.push({
              name: entry.name,
              path: workspaceRelative(rootPath, entry.target.displayPath, entry.name),
            })
          }
          if (entry.type !== 'directory') continue
          const child = entry.target.displayPath
          // Containment and visited-dedupe keep the walk inside the
          // workspace and finite even when links point back up the tree.
          if (visited.has(child) || !this.ctx.fs.contains(root, entry.target)) continue
          if (visited.size >= this.config.searchMaxDirectories) {
            limits.add('traversal-limit')
            continue
          }
          visited.add(child)
          frontier.push(entry.target)
        }
      }
      if (matches.length >= this.config.searchMaxResults) {
        limits.add('result-limit')
        matches.length = this.config.searchMaxResults
        break
      }
    }
    matches.sort((a, b) => a.path.localeCompare(b.path))
    return { query, matches, complete: limits.size === 0, limits: [...limits] }
  }

  /**
   * The shared authority preamble of the remote methods: resolve a path to a
   * live, contained, regular workspace file, or reject it with the stable
   * failure code. One home for the check order and the aborted-rethrow
   * convention; `op` only names the calling method in diagnostics.
   * @param sessionId - owning session; its header cwd roots the resolution.
   * @param path - path as it appeared in the conversation.
   * @param signal - caller cancellation carried through every fs call.
   * @param op - calling method name for diagnostic messages.
   * @returns the resolved target, its stat info, and the workspace cwd.
   * @throws RemoteError with a stable MdPreview failure code.
   */
  private async resolveWorkspaceTarget(
    sessionId: SessionId,
    path: string,
    signal: AbortSignal,
    op: 'read' | 'write',
    extensions: readonly string[],
  ): Promise<{ target: FsTarget; info: FsInfo; cwd: string }> {
    if (path.trim().length === 0) {
      throw failure('md-preview/bad-request', `mdPreview/${op} requires a non-empty path`)
    }
    if (!isAllowedExtension(path, extensions)) {
      throw failure('md-preview/unsupported-extension', `mdPreview/${op} refuses non-previewable path "${path}"`)
    }
    const contained = await this.resolveContainedTarget(sessionId, path, signal, op)
    const info = await this.ctx.fs.stat(contained.target, signal)
    if (info === undefined) {
      throw failure('md-preview/not-found', `mdPreview/${op} cannot find "${path}"`)
    }
    if (info.type !== 'file') {
      throw failure('md-preview/unsupported-extension', `mdPreview/${op} target "${path}" is not a regular file`)
    }
    return { ...contained, info }
  }

  /**
   * The authority middle shared by every method: session → workspace cwd →
   * root resolve → target resolve (a blank path means the root itself) →
   * containment. Extension and type checks belong to the callers.
   * @param sessionId - owning session; its header cwd roots the resolution.
   * @param path - requested path; blank spells the workspace root.
   * @param signal - caller cancellation carried through every fs call.
   * @param op - calling method name for diagnostic messages.
   * @returns the resolved root, target, and the workspace cwd.
   * @throws RemoteError with a stable MdPreview failure code.
   */
  private async resolveContainedTarget(
    sessionId: SessionId,
    path: string,
    signal: AbortSignal,
    op: 'read' | 'write' | 'list' | 'search',
  ): Promise<{ root: FsTarget; target: FsTarget; cwd: string }> {
    const session = this.ctx.sessions.get(sessionId)
    if (session === undefined) {
      throw failure('md-preview/unknown-session', `mdPreview/${op} cannot resolve session "${sessionId}"`)
    }
    const cwd = session.header.cwd
    if (cwd === undefined) {
      throw failure('md-preview/no-workspace', `mdPreview/${op} session "${sessionId}" has no working directory`)
    }
    const root = await this.ctx.fs.resolve(cwd, { signal })
    let target: FsTarget
    if (path.trim().length === 0) {
      target = root
    } else {
      try {
        target = await this.ctx.fs.resolve(path, { cwd, signal })
      } catch (error) {
        // Caller cancellation is an outcome of the call, not a missing file.
        if (signal.aborted) throw error
        throw failure('md-preview/not-found', `mdPreview/${op} cannot resolve path "${path}"`)
      }
    }
    if (!this.ctx.fs.contains(root, target)) {
      throw failure('md-preview/forbidden', `mdPreview/${op} refuses paths outside the session workspace`)
    }
    return { root, target, cwd }
  }
}
