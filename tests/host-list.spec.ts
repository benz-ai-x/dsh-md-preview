/** MdPreview Host list: the workspace directory listing behind the browser
 * face. Same authority chain as read/write, but directory targets are the
 * legal destination and entries come back workspace-relative. */

import { describe, expect, it } from 'vitest'
import { makeService, SESSION } from './host-harness.ts'

const ROOT_ENTRIES = [
  { name: 'docs', type: 'directory' as const },
  { name: 'README.md', type: 'file' as const },
]
const DOCS_ENTRIES = [
  { name: 'notes', type: 'directory' as const },
  { name: 'guide.md', type: 'file' as const },
  { name: 'data.bin', type: 'other' as const },
]

function dirOptions() {
  return {
    dirs: new Map([
      ['/workspace/project', ROOT_ENTRIES],
      ['/workspace/project/docs', DOCS_ENTRIES],
    ]),
    files: new Map<string, { type: 'file' | 'directory' | 'other' }>([
      ['/workspace/project', { type: 'directory' }],
      ['/workspace/project/docs', { type: 'directory' }],
    ]),
  }
}

describe('MdPreviewService.list', () => {
  it('lists the workspace root for a blank path, workspace-relative and folders-first', async () => {
    const { service } = await makeService(dirOptions())
    await expect(service.list(SESSION as never, '  ', new AbortController().signal))
      .resolves.toEqual({
        path: '',
        entries: [
          { name: 'docs', type: 'directory', path: 'docs' },
          { name: 'README.md', type: 'file', path: 'README.md' },
        ],
      })
  })

  it('lists a nested directory with file/other typing', async () => {
    const { service } = await makeService(dirOptions())
    await expect(service.list(SESSION as never, 'docs', new AbortController().signal))
      .resolves.toMatchObject({
        path: 'docs',
        entries: [
          { name: 'notes', type: 'directory', path: 'docs/notes' },
          { name: 'data.bin', type: 'other', path: 'docs/data.bin' },
          { name: 'guide.md', type: 'file', path: 'docs/guide.md' },
        ],
      })
  })

  it('rejects an unknown session', async () => {
    const { service } = await makeService(dirOptions())
    await expect(service.list('nope' as never, '', new AbortController().signal))
      .rejects.toThrow(/cannot resolve session/)
  })

  it('rejects a session without a working directory', async () => {
    const { service } = await makeService({ ...dirOptions(), cwd: null })
    await expect(service.list(SESSION as never, '', new AbortController().signal))
      .rejects.toThrow(/no working directory/)
  })

  it('rejects a path escaping the workspace', async () => {
    const { service } = await makeService(dirOptions())
    await expect(service.list(SESSION as never, '../../etc', new AbortController().signal))
      .rejects.toThrow(/outside the session workspace/)
  })

  it('maps a missing directory to not-found and a file path to bad-request', async () => {
    const { service } = await makeService({
      ...dirOptions(),
      files: new Map<string, { type: 'file' | 'directory' | 'other' }>([
        ['/workspace/project/README.md', { type: 'file' }],
        ['/workspace/project/docs', { type: 'directory' }],
      ]),
    })
    await expect(service.list(SESSION as never, 'ghost', new AbortController().signal))
      .rejects.toThrow(/cannot find/)
    await expect(service.list(SESSION as never, 'docs/../README.md', new AbortController().signal))
      .rejects.toThrow(/directory path/)
  })

  it('maps a backend listing failure to unavailable', async () => {
    const { service } = await makeService({
      ...dirOptions(),
      listFailure: new Set(['/workspace/project']),
    })
    await expect(service.list(SESSION as never, '', new AbortController().signal))
      .rejects.toThrow(/failed to list/)
  })

  it('carries caller cancellation through the listing', async () => {
    const { service } = await makeService(dirOptions())
    const controller = new AbortController()
    controller.abort()
    await expect(service.list(SESSION as never, '', controller.signal))
      .rejects.toThrow(DOMException)
  })
})
