/** Shared Host-side test harness: one fs fake, one session fake, one factory. */

import { Context } from '@deepseek-ai/cordis'
import { FsError } from '@deepseek-ai/dsh-fs'
import { Config } from '../src/config.ts'
import { MdPreviewService } from '../src/remote.ts'

export const SESSION = 'session-1'
export const WORKSPACE = '/workspace/project'

/** Lexically normalize and join a cwd-rooted path. */
export function joinPath(base: string, path: string): string {
  const stack: string[] = []
  for (const segment of `${base}/${path}`.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') stack.pop()
    else stack.push(segment)
  }
  return `/${stack.join('/')}`
}

export interface FakeFile {
  type: 'file' | 'directory' | 'other'
  size?: number
  content?: string
  version?: string
}

export interface FakeFsOptions {
  root?: string
  files?: ReadonlyMap<string, FakeFile>
  /** Directory listings by absolute directory path; entry targets resolve inside. */
  dirs?: ReadonlyMap<string, ReadonlyArray<{ name: string; type: 'file' | 'directory' | 'other' }>>
  resolveFailure?: ReadonlySet<string>
  writeFailure?: ReadonlySet<string>
  listFailure?: ReadonlySet<string>
}

/**
 * Containment-testing fs fake with versioned guarded writes: stat reports the
 * file's version, writeText honors replaceIfVersion (bumping the version) and
 * raises the fs stable codes the real backend would.
 */
export function fakeFs(options: FakeFsOptions = {}) {
  const root = options.root ?? WORKSPACE
  const files = new Map(options.files ?? [])
  const writes: Array<{
    path: string
    content: string
    expected: unknown
    signal: AbortSignal | undefined
    sandboxPolicy?: { mode: string; workspaceRoot: string; sessionId?: string }
  }> = []
  for (const file of files.values()) file.version ??= 'v1'
  return {
    resolve: async (path: string, opts?: { cwd?: string; signal?: AbortSignal }) => {
      if (opts?.signal?.aborted) throw new DOMException('aborted', 'AbortError')
      if (options.resolveFailure?.has(path)) throw new Error(`no such path ${path}`)
      const absolute = path.startsWith('/') ? joinPath('', path) : joinPath(opts?.cwd ?? root, path)
      return { targetKey: absolute, displayPath: absolute } as never
    },
    contains: (parent: { displayPath: string }, child: { displayPath: string }) =>
      parent.displayPath === child.displayPath || child.displayPath.startsWith(`${parent.displayPath}/`),
    stat: async (target: { displayPath: string }, signal?: AbortSignal) => {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      const file = files.get(target.displayPath)
      if (file === undefined) return undefined
      return { version: file.version, type: file.type, size: file.size ?? file.content?.length } as never
    },
    readText: async (target: { displayPath: string }, signal?: AbortSignal) => {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      return files.get(target.displayPath)?.content ?? ''
    },
    writeText: async (
      target: { displayPath: string },
      content: string,
      expected?: { kind: 'replaceIfVersion'; version: string },
      signal?: AbortSignal,
      sandboxPolicy?: { mode: string; workspaceRoot: string; sessionId?: string },
    ) => {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      if (options.writeFailure?.has(target.displayPath)) {
        throw new FsError(`io failure ${target.displayPath}`, 'FS_IO_ERROR')
      }
      const file = files.get(target.displayPath)
      if (file === undefined) throw new FsError(`missing ${target.displayPath}`, 'FS_NOT_FOUND')
      if (expected !== undefined && file.version !== expected.version) {
        throw new FsError(`stale version for ${target.displayPath}`, 'FS_STALE_VERSION')
      }
      file.content = content
      file.size = content.length
      file.version = `${file.version}+w${writes.length + 1}`
      writes.push({ path: target.displayPath, content, expected, signal, sandboxPolicy })
      return { operation: 'update', version: file.version, before: null, after: content } as never
    },
    listDir: async (target: { displayPath: string }, signal?: AbortSignal) => {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      if (options.listFailure?.has(target.displayPath)) throw new Error(`io failure listing ${target.displayPath}`)
      return (options.dirs?.get(target.displayPath) ?? []).map(entry => ({
        name: entry.name,
        type: entry.type,
        target: { targetKey: joinPath(target.displayPath, entry.name), displayPath: joinPath(target.displayPath, entry.name) },
      })) as never
    },
    writes,
    root,
  }
}

export function fakeSessions(cwd?: string) {
  return {
    get: (id: string) => id === SESSION
      ? { header: { id, version: 1, createdAt: 0, ...(cwd === undefined ? {} : { cwd }) } }
      : undefined,
  }
}

export async function makeService(
  options: FakeFsOptions & { cwd?: string | null; config?: ReturnType<typeof Config> } = {},
) {
  const ctx = new Context()
  const fs = fakeFs(options)
  ctx.provide('fs', fs)
  // null spells "session without a workspace"; the default is the workspace root.
  ctx.provide('sessions', fakeSessions(options.cwd === null ? undefined : (options.cwd ?? WORKSPACE)))
  const service = new MdPreviewService(ctx, options.config ?? Config({}))
  return { service, fs }
}

/** One previewable file with a known fingerprint, safe to mutate per case. */
export function markdownFile(content = '# Hello\n', version = 'v1'): FakeFile {
  return { type: 'file', version, content }
}
