/** MdPreview Host read specifics: the byte cap and cancellation. Authority
 * cases shared with write live in host-authority.spec.ts. */

import { describe, expect, it } from 'vitest'
import { Config } from '../src/config.ts'
import { makeService, markdownFile, SESSION } from './host-harness.ts'

describe('MdPreviewService.read specifics', () => {
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
    expect(Config({})).toEqual({ maxBytes: 1_048_576, allowedExtensions: ['.md', '.markdown'] })
  })
  it('rejects invalid deployment values', () => {
    expect(() => Config({ maxBytes: 0 })).toThrow()
  })
})
