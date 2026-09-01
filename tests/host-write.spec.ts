/** MdPreview Host write specifics: the guarded save itself. Authority cases
 * shared with read live in host-authority.spec.ts. */

import { describe, expect, it } from 'vitest'
import { Config } from '../src/config.ts'
import { makeService, markdownFile, SESSION, WORKSPACE } from './host-harness.ts'

describe('MdPreviewService.write specifics', () => {
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
