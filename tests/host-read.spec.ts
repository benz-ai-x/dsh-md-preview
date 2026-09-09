/** MdPreview Host read specifics: the byte cap and cancellation. Authority
 * cases shared with write live in host-authority.spec.ts. */

import { describe, expect, it } from 'vitest'
import { FsError } from '@deepseek-ai/dsh-fs'
import { Config } from '../src/config.ts'
import { makeService, markdownFile, SESSION } from './host-harness.ts'

describe('MdPreviewService.read specifics', () => {
  it('keeps Markdown rendered but read-only when editing is disabled by configuration', async () => {
    const { service } = await makeService({
      config: Config({ allowedExtensions: [], previewExtensions: [] }),
      files: new Map([['/workspace/project/README.md', markdownFile('# Read-only Markdown')]]),
    })
    await expect(service.read(SESSION as never, 'README.md', new AbortController().signal))
      .resolves.toMatchObject({ kind: 'markdown', editable: false, content: '# Read-only Markdown' })
    await expect(service.write(SESSION as never, 'README.md', '# Changed', undefined, true, new AbortController().signal))
      .rejects.toMatchObject({ code: 'md-preview/unsupported-extension' })
  })

  it('carries cancellation into text streaming and releases the active iterator without publishing a partial file', async () => {
    const { service, fs } = await makeService({
      files: new Map([['/workspace/project/Dockerfile', markdownFile('FROM base')]]),
    })
    const controller = new AbortController()
    let released = false
    fs.streamText = async (_target, signal) => (async function* () {
      expect(signal).toBe(controller.signal)
      try {
        yield 'FROM '
        controller.abort()
        yield 'late suffix'
      } finally { released = true }
    })()
    await expect(service.read(SESSION as never, 'Dockerfile', controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' })
    expect(released).toBe(true)
  })

  it('does not admit an Office target through a text-named alias', async () => {
    const { service, fs } = await makeService({
      files: new Map([['/workspace/project/report.docx', markdownFile('text-like fixture')]]),
    })
    const resolve = fs.resolve
    fs.resolve = (path, options) => resolve(path === 'alias.txt' ? 'report.docx' : path, options)
    await expect(service.read(SESSION as never, 'alias.txt', new AbortController().signal))
      .rejects.toMatchObject({ code: 'md-preview/unsupported-extension' })
  })

  it.each(['root', 'target', 'stat'] as const)('preserves filesystem permission failure during %s resolution', async boundary => {
    const { service, fs } = await makeService({
      files: new Map([['/workspace/project/Dockerfile', markdownFile('FROM base')]]),
    })
    if (boundary === 'stat') fs.stat = async () => { throw new FsError('permission denied', 'FS_PERMISSION_DENIED') }
    else {
      const resolve = fs.resolve
      fs.resolve = (path, options) => {
        if (path === (boundary === 'root' ? '/workspace/project' : 'Dockerfile')) throw new FsError('permission denied', 'FS_PERMISSION_DENIED')
        return resolve(path, options)
      }
    }
    await expect(service.read(SESSION as never, 'Dockerfile', new AbortController().signal))
      .rejects.toMatchObject({ code: 'md-preview/forbidden' })
  })

  it('reports a stable non-regular-file failure before reading content', async () => {
    const { service } = await makeService({
      files: new Map([['/workspace/project/Dockerfile', { type: 'directory' }]]),
    })
    await expect(service.read(SESSION as never, 'Dockerfile', new AbortController().signal))
      .rejects.toMatchObject({ code: 'md-preview/not-regular-file' })
  })

  it.each(['report.docx', 'sheet.xlsx', 'slides.pptx', 'page.html', 'scene.png'])('refuses excluded format %s even when configured as text', async path => {
    const { service } = await makeService({
      config: Config({ previewExtensions: [path.slice(path.lastIndexOf('.'))] }),
      files: new Map([[`/workspace/project/${path}`, markdownFile('decodable bytes do not grant this format')]]),
    })
    await expect(service.read(SESSION as never, path, new AbortController().signal))
      .rejects.toMatchObject({ code: 'md-preview/unsupported-extension' })
  })

  it.each(['Dockerfile', 'Makefile', 'notes.unknown'])('reads %s as host-classified read-only text', async path => {
    const { service } = await makeService({
      files: new Map([[`/workspace/project/${path}`, markdownFile('# literal text\n中文')]]),
    })
    await expect(service.read(SESSION as never, path, new AbortController().signal))
      .resolves.toMatchObject({ path, content: '# literal text\n中文', kind: 'text', editable: false })
  })

  it('reads plain text while editing stays limited to Markdown', async () => {
    const { service } = await makeService({
      files: new Map([['/workspace/project/notes.txt', markdownFile('plain text\n')]]),
    })
    await expect(service.read(SESSION as never, 'notes.txt', new AbortController().signal))
      .resolves.toMatchObject({ path: 'notes.txt', content: 'plain text\n' })
  })

  it('accepts a legacy previewExtensions configuration while reading text', async () => {
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

  it('stops a file growing beyond its stat size by UTF-8 bytes and closes the stream', async () => {
    const { service, fs } = await makeService({
      config: Config({ maxBytes: 3 }),
      files: new Map([['/workspace/project/growing.md', { type: 'file', size: 1, content: 'éé' }]]),
    })
    let released = false
    let consumedSuffix = false
    fs.streamText = async () => (async function* () {
      try {
        yield 'é'
        yield 'é'
        consumedSuffix = true
        yield 'unbounded suffix'
      } finally { released = true }
    })()
    await expect(service.read(SESSION as never, 'growing.md', new AbortController().signal))
      .rejects.toMatchObject({ code: 'md-preview/too-large' })
    expect(consumedSuffix).toBe(false)
    expect(released).toBe(true)
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

  it.each([
    ['FS_NOT_TEXT', 'md-preview/not-text'],
    ['FS_NOT_FOUND', 'md-preview/not-found'],
    ['FS_NOT_REGULAR_FILE', 'md-preview/not-regular-file'],
    ['FS_PERMISSION_DENIED', 'md-preview/forbidden'],
    ['FS_IO_ERROR', 'md-preview/unavailable'],
  ] as const)('preserves the stable meaning of %s during text consumption', async (code, expected) => {
    const { service, fs } = await makeService({
      files: new Map([['/workspace/project/notes.unknown', markdownFile('prefix')]]),
    })
    fs.streamText = async () => (async function* () {
      yield 'prefix'
      throw new FsError('provider rejected text', code)
    })()
    await expect(service.read(SESSION as never, 'notes.unknown', new AbortController().signal))
      .rejects.toMatchObject({ code: expected })
  })
})

describe('Config schema', () => {
  it('fills universal defaults', () => {
    expect(Config({})).toEqual({
      maxBytes: 1_048_576,
      allowedExtensions: ['.md', '.markdown'],
      previewExtensions: ['.md', '.markdown', '.txt'],
      searchMaxResults: 200,
      searchMaxDirectories: 2000,
      searchConcurrency: 8,
    })
  })
  it('rejects invalid deployment values', () => {
    expect(() => Config({ maxBytes: 0 })).toThrow()
    expect(() => Config({ searchMaxResults: 0 })).toThrow()
    expect(() => Config({ searchMaxDirectories: 0 })).toThrow()
    expect(() => Config({ searchConcurrency: 0 })).toThrow()
  })
})
