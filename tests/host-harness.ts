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
  resolveFailure?: ReadonlySet<string>
  writeFailure?: ReadonlySet<string>
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
      return { path: absolute } as never
    },
    contains: (parent: { path: string }, child: { path: string }) =>
      parent.path === child.path || child.path.startsWith(`${parent.path}/`),
    stat: async (target: { path: string }, signal?: AbortSignal) => {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      const file = files.get(target.path)
      if (file === undefined) return undefined
      return { version: file.version, type: file.type, size: file.size ?? file.content?.length } as never
    },
    readText: async (target: { path: string }, signal?: AbortSignal) => {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      return files.get(target.path)?.content ?? ''
    },
    writeText: async (
      target: { path: string },
      content: string,
      expected?: { kind: 'replaceIfVersion'; version: string },
      signal?: AbortSignal,
      sandboxPolicy?: { mode: string; workspaceRoot: string; sessionId?: string },
    ) => {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      if (options.writeFailure?.has(target.path)) {
        throw new FsError(`io failure ${target.path}`, 'FS_IO_ERROR')
      }
      const file = files.get(target.path)
      if (file === undefined) throw new FsError(`missing ${target.path}`, 'FS_NOT_FOUND')
      if (expected !== undefined && file.version !== expected.version) {
        throw new FsError(`stale version for ${target.path}`, 'FS_STALE_VERSION')
      }
      file.content = content
      file.size = content.length
      file.version = `${file.version}+w${writes.length + 1}`
      writes.push({ path: target.path, content, expected, signal, sandboxPolicy })
      return { operation: 'update', version: file.version, before: null, after: content } as never
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
