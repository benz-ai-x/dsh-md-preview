/** MdPreview Host write specifics: the guarded save itself. Authority cases
 * shared with read live in host-authority.spec.ts. */

import { describe, expect, it } from 'vitest'
import { Config } from '../src/config.ts'
import { WorkspaceFiles } from '@deepseek-ai/dsh-api-workspace-files'
import { makeService, markdownFile, SESSION, WORKSPACE } from './host-harness.ts'

describe('MdPreviewService.write specifics', () => {
  it('cannot grant text write authority by widening the extension configuration', async () => {
    const { service, fs } = await makeService({
      files: new Map([['/workspace/project/notes.txt', markdownFile('plain')]]),
      config: Config({ allowedExtensions: ['.md', '.txt'] }),
    })
    await expect(service.write(SESSION as never, 'notes.txt', 'edited', 'v1', false, new AbortController().signal))
      .rejects.toMatchObject({ code: 'md-preview/unsupported-extension' })
    expect(fs.writes).toEqual([])
  })

  it('counts UTF-8 bytes rather than characters when accepting a write', async () => {
    const { service, fs } = await makeService({
      config: Config({ maxBytes: 4 }),
      files: new Map([['/workspace/project/guide.md', markdownFile('x')]]),
    })
    await expect(service.write(SESSION as never, 'guide.md', '你好', 'v1', false, new AbortController().signal))
      .rejects.toMatchObject({ code: 'md-preview/too-large' })
    expect(fs.writes).toEqual([])
  })

  it('publishes the successful version through the public filesystem observation event', async () => {
    const { service, ctx } = await makeService({ files: new Map([['/workspace/project/guide.md', markdownFile()]]) })
    const observations: unknown[] = []
    const release = ctx.on('fs/observed', (target, observation, actor) => { observations.push({ target, observation, actor }) })
    try {
      await service.write(SESSION as never, 'guide.md', '# Saved\n', 'v1', false, new AbortController().signal)
      expect(observations).toEqual([{
        target: { targetKey: '/workspace/project/guide.md', displayPath: '/workspace/project/guide.md' },
        observation: { kind: 'present', version: 'v1+w1' }, actor: undefined,
      }])
    } finally { release() }
  })

  it('refuses a detectable target change to a link before a forced write', async () => {
    const links = new Map<string, string>()
    const { service, fs } = await makeService({
      files: new Map([
        ['/workspace/project/guide.md', markdownFile()],
        ['/workspace/project/other.md', markdownFile('# Other\n')],
      ]), symlinks: links,
    })
    const stat = fs.stat
    fs.stat = async (...args) => {
      const info = await stat(...args)
      links.set('/workspace/project/guide.md', '/workspace/project/other.md')
      return info
    }
    await expect(service.write(SESSION as never, 'guide.md', '# New\n', undefined, true, new AbortController().signal))
      .rejects.toMatchObject({ code: 'md-preview/unsupported-extension' })
    expect(fs.writes).toEqual([])
  })

  it('delivers a plugin save to the official workspace changes stream', async () => {
    const { service, ctx } = await makeService({ files: new Map([['/workspace/project/guide.md', markdownFile()]]) })
    ctx.provide('sandboxPolicy', { resolve: () => ({ workspaceRoot: WORKSPACE }) } as never)
    let native!: WorkspaceFiles
    const fiber = ctx.plugin((owned) => { native = new WorkspaceFiles(owned, WorkspaceFiles.Config({})) })
    await fiber.await()
    const controller = new AbortController()
    const stream = native.changes({ session: { header: { cwd: WORKSPACE } } } as never, controller.signal)[Symbol.asyncIterator]()
    try {
      expect(await stream.next()).toEqual({ done: false, value: { kind: 'ready' } })
      await service.write(SESSION as never, 'guide.md', '# Saved\n', 'v1', false, new AbortController().signal)
      expect(await stream.next()).toEqual({ done: false, value: {
        kind: 'change', change: { absolutePath: '/workspace/project/guide.md', version: 'v1+w1' },
      } })
    } finally {
      controller.abort()
      await stream.return?.()
      await fiber.dispose()
    }
  })

  it.each(['conflict', 'cancel', 'failure'] as const)('publishes no successful observation after %s', async (outcome) => {
    const { service, ctx } = await makeService({
      files: new Map([['/workspace/project/guide.md', markdownFile()]]),
      ...(outcome === 'failure' ? { writeFailure: new Set(['/workspace/project/guide.md']) } : {}),
    })
    const observations: unknown[] = []
    const release = ctx.on('fs/observed', (_target, observation) => { observations.push(observation) })
    const controller = new AbortController()
    if (outcome === 'cancel') controller.abort()
    try {
      await expect(service.write(SESSION as never, 'guide.md', 'x', outcome === 'conflict' ? 'stale' : 'v1', false, controller.signal)).rejects.toThrow()
      expect(observations).toEqual([])
    } finally { release() }
  })

  it('persists guarded content and returns the new fingerprint', async () => {
    const { service, fs } = await makeService({
      files: new Map([['/workspace/project/README.md', markdownFile()]]),
    })
    const result = await service.write(SESSION as never, 'README.md', '# Edited\n', 'v1', false, new AbortController().signal)
    expect(result).toEqual({ path: 'README.md', fingerprint: 'v1+w1' })
    expect(fs.writes).toEqual([
      {
        path: '/workspace/project/README.md',
        content: '# Edited\n',
        expected: { kind: 'replaceIfVersion', version: 'v1' },
        signal: expect.anything(),
        sandboxPolicy: expect.anything(),
      },
    ])
  })

  it('roots the write sandbox policy at the session workspace', async () => {
    const { service, fs } = await makeService({
      files: new Map([['/workspace/project/README.md', markdownFile()]]),
    })
    await service.write(SESSION as never, 'README.md', '# Edited\n', 'v1', false, new AbortController().signal)
    expect(fs.writes[0]?.sandboxPolicy).toEqual({
      mode: 'workspace-write',
      workspaceRoot: WORKSPACE,
      sessionId: SESSION,
    })
  })

  it('refuses a preview-only extension: text files are not editable', async () => {
    const { service, fs } = await makeService({
      files: new Map([['/workspace/project/notes.txt', markdownFile('plain')]]),
    })
    await expect(service.write(SESSION as never, 'notes.txt', 'edited', 'v1', false, new AbortController().signal))
      .rejects.toThrow(/non-previewable/)
    expect(fs.writes).toHaveLength(0)
  })

  it('refuses a blind write without fingerprint or force', async () => {
    const { service, fs } = await makeService({
      files: new Map([['/workspace/project/README.md', markdownFile()]]),
    })
    await expect(service.write(SESSION as never, 'README.md', '# Edited\n', undefined, false, new AbortController().signal))
      .rejects.toThrow(/fingerprint or force/)
    expect(fs.writes).toHaveLength(0)
  })

  it('maps a stale fingerprint to md-preview/conflict', async () => {
    const { service, fs } = await makeService({
      files: new Map([['/workspace/project/README.md', markdownFile('# Hello\n', 'v2')]]),
    })
    await expect(service.write(SESSION as never, 'README.md', '# Edited\n', 'v1', false, new AbortController().signal))
      .rejects.toThrow(/changed since read/)
    expect(fs.writes).toHaveLength(0)
  })

  it('overwrites unconditionally with force', async () => {
    const { service, fs } = await makeService({
      files: new Map([['/workspace/project/README.md', markdownFile('# Hello\n', 'v9')]]),
    })
    await expect(service.write(SESSION as never, 'README.md', '# Forced\n', undefined, true, new AbortController().signal))
      .resolves.toMatchObject({ path: 'README.md' })
    expect(fs.writes[0]?.expected).toBeUndefined()
  })

  it('rejects content above the configured byte cap', async () => {
    const { service, fs } = await makeService({
      files: new Map([['/workspace/project/README.md', markdownFile()]]),
      config: Config({ maxBytes: 8, allowedExtensions: ['.md'] }),
    })
    await expect(service.write(SESSION as never, 'README.md', '0123456789', 'v1', false, new AbortController().signal))
      .rejects.toThrow(/byte cap/)
    expect(fs.writes).toHaveLength(0)
  })

  it('carries caller cancellation through the write', async () => {
    const { service } = await makeService({
      files: new Map([['/workspace/project/README.md', markdownFile()]]),
    })
    const controller = new AbortController()
    controller.abort()
    await expect(service.write(SESSION as never, 'README.md', 'x', 'v1', false, controller.signal))
      .rejects.toThrow(DOMException)
  })

  it('maps a backend write failure to unavailable', async () => {
    const { service } = await makeService({
      files: new Map([['/workspace/project/README.md', markdownFile()]]),
      writeFailure: new Set(['/workspace/project/README.md']),
    })
    await expect(service.write(SESSION as never, 'README.md', 'x', 'v1', false, new AbortController().signal))
      .rejects.toThrow(/failed for/)
  })
})
