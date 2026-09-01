/** MdPreview Host read specifics: the byte cap and cancellation. Authority
 * cases shared with write live in host-authority.spec.ts. */

import { describe, expect, it } from 'vitest'
import { Config } from '../src/config.ts'
import { makeService, markdownFile, SESSION } from './host-harness.ts'

describe('MdPreviewService.read specifics', () => {
  it('reads a plain-text file under the preview union (editing stays markdown)', async () => {
    const { service } = await makeService({
      files: new Map([['/workspace/project/notes.txt', markdownFile('plain text\n')]]),
    })
    await expect(service.read(SESSION as never, 'notes.txt', new AbortController().signal))
      .resolves.toMatchObject({ path: 'notes.txt', content: 'plain text\n' })
  })

  it('reads an extension added by previewExtensions configuration', async () => {
    const { service } = await makeService({
      config: Config({ previewExtensions: ['.md', '.markdown', '.txt', '.log'] }),
      files: new Map([['/workspace/project/run.log', markdownFile('log line')]]),
    })
    await expect(service.read(SESSION as never, 'run.log', new AbortController().signal))
      .resolves.toMatchObject({ path: 'run.log' })
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
      files: new Map([['/workspace/project/README.md', markdownFile('# H')]]),
    })
    const controller = new AbortController()
    controller.abort()
    await expect(service.read(SESSION as never, 'README.md', controller.signal))
      .rejects.toThrow()
  })
})

describe('Config schema', () => {
  it('fills universal defaults', () => {
    expect(Config({})).toEqual({
      maxBytes: 1_048_576,
      allowedExtensions: ['.md', '.markdown'],
      previewExtensions: ['.md', '.markdown', '.txt'],
    })
  })
  it('rejects invalid deployment values', () => {
    expect(() => Config({ maxBytes: 0 })).toThrow()
  })
})
