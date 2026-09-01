/** MdPreview Host write authority: guarded saves, conflicts, and stable failure codes. */

import { Context } from '@deepseek-ai/cordis'
import { FsError } from '@deepseek-ai/dsh-fs'
import { describe, expect, it } from 'vitest'
import { Config } from '../src/config.ts'
import { MdPreviewService } from '../src/remote.ts'

const SESSION = 'session-1'
const WORKSPACE = '/workspace/project'

/** Lexically normalize and join a cwd-rooted path. */
function joinPath(base: string, path: string): string {
  const stack: string[] = []
  for (const segment of `${base}/${path}`.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') stack.pop()
    else stack.push(segment)
  }
  return `/${stack.join('/')}`
}

interface FakeFile {
  type: 'file' | 'directory' | 'other'
  size?: number
  content?: string
  version?: string
}

interface FakeFsOptions {
  root?: string
  files?: ReadonlyMap<string, FakeFile>
  writeFailure?: ReadonlySet<string>
}

/** Containment-testing fs fake with versioned guarded writes. */
function fakeFs(options: FakeFsOptions = {}) {
  const root = options.root ?? WORKSPACE
  const files = new Map(options.files ?? [])
  const writes: Array<{ path: string; content: string; expected: unknown; signal: AbortSignal | undefined }> = []
  for (const file of files.values()) file.version ??= 'v1'
  return {
    resolve: async (path: string, opts?: { cwd?: string; signal?: AbortSignal }) => {
      if (opts?.signal?.aborted) throw new DOMException('aborted', 'AbortError')
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
      writes.push({ path: target.path, content, expected, signal })
      return { operation: 'update', version: file.version, before: null, after: content } as never
    },
    writes,
    root,
  }
}

function fakeSessions(cwd?: string) {
  return {
    get: (id: string) => id === SESSION
      ? { header: { id, version: 1, createdAt: 0, ...(cwd === undefined ? {} : { cwd }) } }
      : undefined,
  }
}

async function makeService(options: FakeFsOptions & { cwd?: string | null; config?: ReturnType<typeof Config> } = {}) {
  const ctx = new Context()
  const fs = fakeFs(options)
  ctx.provide('fs', fs)
  ctx.provide('sessions', fakeSessions(options.cwd === null ? undefined : (options.cwd ?? WORKSPACE)))
  const service = new MdPreviewService(ctx, options.config ?? Config({}))
  return { service, fs }
}

const README: FakeFile = { type: 'file', version: 'v1', content: '# Hello\n' }

describe('MdPreviewService.write', () => {
  it('persists guarded content and returns the new fingerprint', async () => {
    const { service, fs } = await makeService({ files: new Map([['/workspace/project/README.md', README]]) })
    const result = await service.write(SESSION as never, 'README.md', '# Edited\n', 'v1', false, new AbortController().signal)
    expect(result).toEqual({ path: 'README.md', fingerprint: 'v1+w1' })
    expect(fs.writes).toEqual([
      { path: '/workspace/project/README.md', content: '# Edited\n', expected: { kind: 'replaceIfVersion', version: 'v1' }, signal: expect.anything() },
    ])
  })

  it('refuses a blind write without fingerprint or force', async () => {
    const { service, fs } = await makeService({ files: new Map([['/workspace/project/README.md', { ...README }]]) })
    await expect(service.write(SESSION as never, 'README.md', '# Edited\n', undefined, false, new AbortController().signal))
      .rejects.toThrow(/fingerprint or force/)
    expect(fs.writes).toHaveLength(0)
  })

  it('maps a stale fingerprint to md-preview/conflict', async () => {
    const { service, fs } = await makeService({ files: new Map([['/workspace/project/README.md', { ...README, version: 'v2' }]]) })
    await expect(service.write(SESSION as never, 'README.md', '# Edited\n', 'v1', false, new AbortController().signal))
      .rejects.toThrow(/changed since read/)
    expect(fs.writes).toHaveLength(0)
  })

  it('overwrites unconditionally with force', async () => {
    const { service, fs } = await makeService({ files: new Map([['/workspace/project/README.md', { ...README, version: 'v9' }]]) })
    await expect(service.write(SESSION as never, 'README.md', '# Forced\n', undefined, true, new AbortController().signal))
      .resolves.toMatchObject({ path: 'README.md' })
    expect(fs.writes[0]?.expected).toBeUndefined()
  })

  it('rejects an empty path with bad-request', async () => {
    const { service } = await makeService()
    await expect(service.write(SESSION as never, '  ', 'x', 'v1', false, new AbortController().signal))
      .rejects.toThrow(/non-empty path/)
  })

  it('rejects a non-previewable extension before any fs work', async () => {
    const { service, fs } = await makeService()
    await expect(service.write(SESSION as never, 'src/index.ts', 'x', 'v1', false, new AbortController().signal))
      .rejects.toThrow(/non-previewable/)
    expect(fs.writes).toHaveLength(0)
  })

  it('rejects a path escaping the workspace', async () => {
    const { service } = await makeService()
    await expect(service.write(SESSION as never, '../../etc/secrets.md', 'x', 'v1', false, new AbortController().signal))
      .rejects.toThrow(/outside the session workspace/)
  })

  it('rejects a missing target with not-found', async () => {
    const { service } = await makeService()
    await expect(service.write(SESSION as never, 'ghost.md', 'x', 'v1', false, new AbortController().signal))
      .rejects.toThrow(/cannot find/)
  })

  it('rejects a directory target', async () => {
    const { service } = await makeService({
      files: new Map([['/workspace/project/docs.md', { type: 'directory' }]]),
    })
    await expect(service.write(SESSION as never, 'docs.md', 'x', 'v1', false, new AbortController().signal))
      .rejects.toThrow(/not a regular file/)
  })

  it('rejects content above the configured byte cap', async () => {
    const { service, fs } = await makeService({
      files: new Map([['/workspace/project/README.md', { ...README }]]),
      config: Config({ maxBytes: 8, allowedExtensions: ['.md'] }),
    })
    await expect(service.write(SESSION as never, 'README.md', '0123456789', 'v1', false, new AbortController().signal))
      .rejects.toThrow(/byte cap/)
    expect(fs.writes).toHaveLength(0)
  })

  it('carries caller cancellation through the write', async () => {
    const { service } = await makeService({ files: new Map([['/workspace/project/README.md', { ...README }]]) })
    const controller = new AbortController()
    controller.abort()
    await expect(service.write(SESSION as never, 'README.md', 'x', 'v1', false, controller.signal))
      .rejects.toThrow(DOMException)
  })

  it('maps a backend write failure to unavailable', async () => {
    const { service } = await makeService({
      files: new Map([['/workspace/project/README.md', { ...README }]]),
      writeFailure: new Set(['/workspace/project/README.md']),
    })
    await expect(service.write(SESSION as never, 'README.md', 'x', 'v1', false, new AbortController().signal))
      .rejects.toThrow(/failed for/)
  })
})
