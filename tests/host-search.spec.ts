/** MdPreview Host search: document-name search over the whole session
 * workspace, including directories the browser face never expanded. The
 * traversal stays inside the session authority chain, never reads file
 * bodies, and reports honestly whether the result is complete. */

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { Config } from '../src/config.ts'
import { MdPreviewService } from '../src/remote.ts'
import { fakeFs, fakeSessions, makeService, SESSION, WORKSPACE } from './host-harness.ts'

/** A workspace with a deep unexpanded branch and same-name documents. */
function deepTree() {
  return {
    dirs: new Map([
      ['/workspace/project', [
        { name: 'README.md', type: 'file' as const },
        { name: 'docs', type: 'directory' as const },
        { name: 'logo.bin', type: 'other' as const },
      ]],
      ['/workspace/project/docs', [
        { name: 'guide.md', type: 'file' as const },
        { name: 'notes', type: 'directory' as const },
      ]],
      ['/workspace/project/docs/notes', [
        { name: 'guide.md', type: 'file' as const },
        { name: 'Guide-Plan.MD', type: 'file' as const },
        { name: 'diagram.png', type: 'file' as const },
        { name: 'data.csv', type: 'file' as const },
      ]],
    ]),
    files: new Map<string, { type: 'file' | 'directory' | 'other' }>([
      ['/workspace/project', { type: 'directory' }],
      ['/workspace/project/docs', { type: 'directory' }],
      ['/workspace/project/docs/notes', { type: 'directory' }],
    ]),
  }
}

describe('MdPreviewService.search', () => {
  it('finds previewable documents by case-insensitive name substring across unexpanded directories', async () => {
    const { service, fs } = await makeService(deepTree())
    const readText = vi.spyOn(fs, 'readText')
    await expect(service.search(SESSION as never, 'GuIdE', new AbortController().signal))
      .resolves.toEqual({
        query: 'GuIdE',
        matches: [
          { name: 'guide.md', path: 'docs/guide.md' },
          { name: 'Guide-Plan.MD', path: 'docs/notes/Guide-Plan.MD' },
          { name: 'guide.md', path: 'docs/notes/guide.md' },
        ],
        complete: true,
        limits: [],
      })
    // Name search never reads file bodies to build any index.
    expect(readText).not.toHaveBeenCalled()
  })

  it('returns only previewable files with names and workspace-relative paths, sorted', async () => {
    const { service } = await makeService(deepTree())
    const result = await service.search(SESSION as never, 'guide', new AbortController().signal)
    expect(result.matches.map(match => match.path)).toEqual([
      'docs/guide.md',
      'docs/notes/Guide-Plan.MD',
      'docs/notes/guide.md',
    ])
    expect(result.matches.every(match => typeof match.name === 'string')).toBe(true)
    // The non-previewable neighbors (png/csv/bin) and directories never match.
    expect(result.matches.map(match => match.path).some(path => /\.(png|csv|bin)$/.test(path))).toBe(false)
  })

  it('rejects a blank query as bad-request', async () => {
    const { service } = await makeService(deepTree())
    await expect(service.search(SESSION as never, '   ', new AbortController().signal))
      .rejects.toThrow(/non-empty query/)
  })

  it('rejects an unknown session and a session without a workspace', async () => {
    const { service } = await makeService(deepTree())
    await expect(service.search('nope' as never, 'guide', new AbortController().signal))
      .rejects.toThrow(/cannot resolve session/)
    const bare = await makeService({ ...deepTree(), cwd: null })
    await expect(bare.service.search(SESSION as never, 'guide', new AbortController().signal))
      .rejects.toThrow(/no working directory/)
  })

  it('marks the answer incomplete when a directory cannot be listed, keeping the rest', async () => {
    const { service } = await makeService({
      ...deepTree(),
      listFailure: new Set(['/workspace/project/docs/notes']),
    })
    const result = await service.search(SESSION as never, 'guide', new AbortController().signal)
    expect(result.complete).toBe(false)
    expect(result.limits).toEqual(['directory-failure'])
    // The readable branches still report their matches; the unreadable one's
    // contents are simply absent — zero matches here never claims "no results".
    expect(result.matches.map(match => match.path)).toEqual(['docs/guide.md'])
  })

  it('truncates at the result cap and reports result-limit, not completeness', async () => {
    const { service } = await makeService({ ...deepTree(), config: Config({ searchMaxResults: 2 }) })
    const result = await service.search(SESSION as never, 'guide', new AbortController().signal)
    expect(result.matches).toHaveLength(2)
    expect(result.complete).toBe(false)
    expect(result.limits).toEqual(['result-limit'])
  })

  it('stops admitting directories at the traversal cap and reports traversal-limit', async () => {
    // A binary fan-out tree: 1 root with 3 dirs, each with a match.
    const dirs = new Map([
      ['/workspace/project', [
        { name: 'a', type: 'directory' as const },
        { name: 'b', type: 'directory' as const },
        { name: 'c', type: 'directory' as const },
      ]],
      ['/workspace/project/a', [{ name: 'guide.md', type: 'file' as const }]],
      ['/workspace/project/b', [{ name: 'guide.md', type: 'file' as const }]],
      ['/workspace/project/c', [{ name: 'guide.md', type: 'file' as const }]],
    ])
    const files = new Map<string, { type: 'file' | 'directory' | 'other' }>([
      ['/workspace/project', { type: 'directory' }],
      ['/workspace/project/a', { type: 'directory' }],
      ['/workspace/project/b', { type: 'directory' }],
      ['/workspace/project/c', { type: 'directory' }],
    ])
    // Cap the walk at the root plus two of the three children.
    const { service } = await makeService({ dirs, files, config: Config({ searchMaxDirectories: 3 }) })
    const result = await service.search(SESSION as never, 'guide', new AbortController().signal)
    expect(result.complete).toBe(false)
    expect(result.limits).toEqual(['traversal-limit'])
    expect(result.matches.length).toBeLessThanOrEqual(3)
  })

  it('carries caller cancellation through the walk', async () => {
    const { service } = await makeService(deepTree())
    const controller = new AbortController()
    controller.abort()
    await expect(service.search(SESSION as never, 'guide', controller.signal))
      .rejects.toThrow(DOMException)
  })

  it('bounds concurrent listings to the configured width', async () => {
    // A controllable fake: every listDir waits on its own gate, tracking the
    // in-flight high-water mark.
    const ctx = new Context()
    let inFlight = 0
    let highWater = 0
    const gates: Array<() => void> = []
    const dirs = new Map([
      ['/workspace/project', [
        { name: 'a', type: 'directory' as const },
        { name: 'b', type: 'directory' as const },
        { name: 'c', type: 'directory' as const },
        { name: 'd', type: 'directory' as const },
      ]],
      ['/workspace/project/a', [{ name: 'guide.md', type: 'file' as const }]],
      ['/workspace/project/b', [{ name: 'guide.md', type: 'file' as const }]],
      ['/workspace/project/c', [{ name: 'guide.md', type: 'file' as const }]],
      ['/workspace/project/d', [{ name: 'guide.md', type: 'file' as const }]],
    ])
    const base = fakeFs({
      dirs,
      files: new Map<string, { type: 'file' | 'directory' | 'other' }>([
        ['/workspace/project', { type: 'directory' }],
        ['/workspace/project/a', { type: 'directory' }],
        ['/workspace/project/b', { type: 'directory' }],
        ['/workspace/project/c', { type: 'directory' }],
        ['/workspace/project/d', { type: 'directory' }],
      ]),
    })
    const gatedFs = {
      ...base,
      listDir: async (target: { displayPath: string }, signal?: AbortSignal) => {
        if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
        inFlight += 1
        highWater = Math.max(highWater, inFlight)
        await new Promise<void>(resolve => { gates.push(resolve) })
        inFlight -= 1
        return base.listDir(target, signal)
      },
    }
    ctx.provide('fs', gatedFs)
    ctx.provide('sessions', fakeSessions(WORKSPACE))
    const service = new MdPreviewService(ctx, Config({ searchConcurrency: 2 }))
    let settled = false
    const pending = service.search(SESSION as never, 'guide', new AbortController().signal)
      .then(result => { settled = true; return result })
    // Open whatever gates exist, one macrotask at a time, until the walk
    // settles: the service's own batching is what keeps in-flight ≤ 2.
    for (let round = 0; round < 100 && !settled; round += 1) {
      await new Promise(resolve => { setTimeout(resolve, 0) })
      for (const open of gates.splice(0)) open()
    }
    const result = await pending
    expect(highWater).toBeLessThanOrEqual(2)
    // Concurrency is actually used, not just capped.
    expect(highWater).toBeGreaterThan(1)
    expect(result.complete).toBe(true)
    expect(result.matches).toHaveLength(4)
  })

  it('never re-enters a directory whose link target loops back', async () => {
    // A custom listing where the child directory entry resolves back to the
    // root itself: the visited dedupe must terminate the walk.
    const ctx = new Context()
    const listing = [
      { name: 'guide.md', type: 'file' as const, target: { targetKey: '/workspace/project/guide.md', displayPath: '/workspace/project/guide.md' } },
      { name: 'loop', type: 'directory' as const, target: { targetKey: '/workspace/project', displayPath: '/workspace/project' } },
    ]
    const listCalls: string[] = []
    const loopFs = {
      resolve: async (path: string) => ({ targetKey: path, displayPath: path }),
      contains: (parent: { displayPath: string }, child: { displayPath: string }) =>
        child.displayPath.startsWith(`${parent.displayPath}/`) || child.displayPath === parent.displayPath,
      stat: async () => ({ type: 'directory' }),
      listDir: async (target: { displayPath: string }) => {
        listCalls.push(target.displayPath)
        return target.displayPath === '/workspace/project' ? listing : []
      },
    }
    ctx.provide('fs', loopFs)
    ctx.provide('sessions', fakeSessions(WORKSPACE))
    const service = new MdPreviewService(ctx, Config({}))
    const result = await service.search(SESSION as never, 'guide', new AbortController().signal)
    expect(listCalls).toEqual(['/workspace/project'])
    expect(result).toMatchObject({ complete: true, matches: [{ name: 'guide.md', path: 'guide.md' }] })
  })
})
