/** MdPreview Host read authority: scoping, caps, and stable failure codes. */

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { Config } from '../src/config.ts'
import { isAllowedExtension, MdPreviewService } from '../src/remote.ts'

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

interface FakeFsOptions {
  root?: string
  files?: ReadonlyMap<string, { type: 'file' | 'directory' | 'other'; size?: number; content?: string }>
  resolveFailure?: ReadonlySet<string>
}

/** Containment-testing fs fake; targets are plain normalized-path objects. */
function fakeFs(options: FakeFsOptions = {}) {
  const root = options.root ?? WORKSPACE
  const files = options.files ?? new Map()
  const resolveFailure = options.resolveFailure ?? new Set<string>()
  const targets = new Set<string>()
  return {
    resolve: async (path: string, opts?: { cwd?: string; signal?: AbortSignal }) => {
      if (opts?.signal?.aborted) throw new DOMException('aborted', 'AbortError')
      if (resolveFailure.has(path)) throw new Error(`no such path ${path}`)
      const absolute = path.startsWith('/') ? joinPath('', path) : joinPath(opts?.cwd ?? root, path)
      targets.add(absolute)
      return { path: absolute } as never
    },
    contains: (parent: { path: string }, child: { path: string }) =>
      parent.path === child.path || child.path.startsWith(`${parent.path}/`),
    stat: async (target: { path: string }, signal?: AbortSignal) => {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      const file = files.get(target.path)
      if (file === undefined) return undefined
      return { version: 1, ...file } as never
    },
    readText: async (target: { path: string }, signal?: AbortSignal) => {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      const file = files.get(target.path)
      if (file?.content === undefined) throw new Error(`unreadable ${target.path}`)
      return file.content
    },
    targets,
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
  // null spells "session without a workspace"; the default is the workspace root.
  ctx.provide('sessions', fakeSessions(options.cwd === null ? undefined : (options.cwd ?? WORKSPACE)))
  const service = new MdPreviewService(ctx, options.config ?? Config({}))
  return { service, fs }
}

describe('isAllowedExtension', () => {
  it('accepts configured extensions case-insensitively', () => {
    expect(isAllowedExtension('README.md', ['.md', '.markdown'])).toBe(true)
    expect(isAllowedExtension('notes.MARKDOWN', ['.md', '.markdown'])).toBe(true)
  })
  it('refuses other extensions and extensionless paths', () => {
    expect(isAllowedExtension('index.ts', ['.md'])).toBe(false)
    expect(isAllowedExtension('Makefile', ['.md'])).toBe(false)
  })
})

describe('MdPreviewService.read', () => {
  it('reads a workspace markdown file', async () => {
    const { service } = await makeService({
      files: new Map([['/workspace/project/README.md', { type: 'file', size: 12, content: '# Hello\n' }]]),
    })
    await expect(service.read(SESSION as never, 'README.md', new AbortController().signal))
      .resolves.toEqual({ path: 'README.md', content: '# Hello\n' })
  })

  it('rejects an empty path with bad-request', async () => {
    const { service } = await makeService()
    await expect(service.read(SESSION as never, '  ', new AbortController().signal))
      .rejects.toThrow(/non-empty path/)
  })

  it('rejects a non-previewable extension before any fs work', async () => {
    const { service, fs } = await makeService()
    await expect(service.read(SESSION as never, 'src/index.ts', new AbortController().signal))
      .rejects.toThrow(/non-previewable/)
    expect(fs.targets.size).toBe(0)
  })

  it('rejects an unknown session', async () => {
    const { service } = await makeService()
    await expect(service.read('nope' as never, 'README.md', new AbortController().signal))
      .rejects.toThrow(/cannot resolve session/)
  })

  it('rejects a session without a working directory', async () => {
    const { service } = await makeService({ cwd: null })
    await expect(service.read(SESSION as never, 'notes.md', new AbortController().signal))
      .rejects.toThrow(/no working directory/)
  })

  it('rejects a path escaping the workspace', async () => {
    const { service } = await makeService()
    await expect(service.read(SESSION as never, '../../etc/secrets.md', new AbortController().signal))
      .rejects.toThrow(/outside the session workspace/)
  })

  it('rejects an absolute path outside the workspace', async () => {
    const { service } = await makeService()
    await expect(service.read(SESSION as never, '/etc/passwd.md', new AbortController().signal))
      .rejects.toThrow(/outside the session workspace/)
  })

  it('maps an unresolvable path to not-found', async () => {
    const { service } = await makeService({ resolveFailure: new Set(['ghost.md']) })
    await expect(service.read(SESSION as never, 'ghost.md', new AbortController().signal))
      .rejects.toThrow(/cannot resolve path/)
  })

  it('maps a missing stat to not-found', async () => {
    const { service } = await makeService()
    await expect(service.read(SESSION as never, 'README.md', new AbortController().signal))
      .rejects.toThrow(/cannot find/)
  })

  it('rejects a directory target', async () => {
    const { service } = await makeService({
      files: new Map([['/workspace/project/docs.md', { type: 'directory' }]]),
    })
    await expect(service.read(SESSION as never, 'docs.md', new AbortController().signal))
      .rejects.toThrow(/not a regular file/)
  })

  it('enforces the configured byte cap from stat', async () => {
    const { service } = await makeService({
      config: Config({ maxBytes: 10 }),
      files: new Map([['/workspace/project/big.md', { type: 'file', size: 11, content: 'x'.repeat(11) }]]),
    })
    await expect(service.read(SESSION as never, 'big.md', new AbortController().signal))
      .rejects.toThrow(/byte cap/)
  })

  it('propagates caller cancellation instead of mapping it to a failure', async () => {
    const { service } = await makeService({
      files: new Map([['/workspace/project/README.md', { type: 'file', size: 3, content: '# H' }]]),
    })
    const controller = new AbortController()
    controller.abort()
    await expect(service.read(SESSION as never, 'README.md', controller.signal))
      .rejects.toThrow()
  })
})

describe('Config schema', () => {
  it('fills universal defaults', () => {
    expect(Config({})).toEqual({ maxBytes: 1_048_576, allowedExtensions: ['.md', '.markdown'] })
  })
  it('rejects invalid deployment values', () => {
    expect(() => Config({ maxBytes: 0 })).toThrow()
  })
})
