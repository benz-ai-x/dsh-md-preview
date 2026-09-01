/**
 * The authority preamble, table-driven over both remote methods: every
 * resolve/containment failure must behave identically for read and write —
 * same check order, same stable failure code, same message shape.
 */

import { describe, expect, it } from 'vitest'
import { makeService, markdownFile, SESSION, type FakeFsOptions } from './host-harness.ts'
import type { MdPreviewService } from '../src/remote.ts'

/** One authority case: how to build the service and which path to ask for. */
interface AuthorityCase {
  name: string
  options?: FakeFsOptions & { cwd?: string | null }
  path: string
  session?: string
  message: RegExp
}

const CASES: readonly AuthorityCase[] = [
  {
    name: 'an empty path',
    path: '  ',
    message: /non-empty path/,
  },
  {
    name: 'a non-previewable extension',
    path: 'src/index.ts',
    message: /non-previewable/,
  },
  {
    name: 'an unknown session',
    path: 'README.md',
    session: 'nope',
    message: /cannot resolve session/,
  },
  {
    name: 'a session without a working directory',
    path: 'notes.md',
    options: { cwd: null },
    message: /no working directory/,
  },
  {
    name: 'a path escaping the workspace',
    path: '../../etc/secrets.md',
    message: /outside the session workspace/,
  },
  {
    name: 'an absolute path outside the workspace',
    path: '/etc/passwd.md',
    message: /outside the session workspace/,
  },
  {
    name: 'an unresolvable path',
    path: 'ghost.md',
    options: { resolveFailure: new Set(['ghost.md']) },
    message: /cannot resolve path/,
  },
  {
    name: 'a missing stat',
    path: 'README.md',
    options: { files: new Map() },
    message: /cannot find/,
  },
  {
    name: 'a directory target',
    path: 'docs.md',
    options: { files: new Map([['/workspace/project/docs.md', { type: 'directory' }]]) },
    message: /not a regular file/,
  },
]

type Method = 'read' | 'write'

async function call(
  service: MdPreviewService,
  method: Method,
  session: string,
  path: string,
  signal: AbortSignal,
): Promise<unknown> {
  return method === 'read'
    ? service.read(session as never, path, signal)
    : service.write(session as never, path, '# x', 'v1', false, signal)
}

describe('mdPreview authority (read × write)', () => {
  for (const method of ['read', 'write'] as const) {
    for (const testCase of CASES) {
      it(`${method} rejects ${testCase.name}`, async () => {
        const { service } = await makeService({
          files: new Map([['/workspace/project/README.md', markdownFile()]]),
          ...testCase.options,
        })
        await expect(call(service, method, testCase.session ?? SESSION, testCase.path, new AbortController().signal))
          .rejects.toThrow(testCase.message)
      })
    }
  }

  it('both methods accept a workspace markdown file', async () => {
    const { service } = await makeService({
      files: new Map([['/workspace/project/README.md', markdownFile()]]),
    })
    await expect(call(service, 'read', SESSION, 'README.md', new AbortController().signal))
      .resolves.toMatchObject({ path: 'README.md', content: '# Hello\n' })
    await expect(call(service, 'write', SESSION, 'README.md', new AbortController().signal))
      .resolves.toMatchObject({ path: 'README.md' })
  })
})
