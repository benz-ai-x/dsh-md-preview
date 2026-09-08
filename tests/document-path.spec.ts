import { describe, expect, it } from 'vitest'
import { documentParent, workspaceDisplayPath } from '../src/client/document-path.ts'

describe('workspace display paths', () => {
  it.each([
    ['/work/docs/report.md', '/work', 'docs/report.md'],
    ['/work/docs/report.md', '/work/', 'docs/report.md'],
    ['/work-other/report.md', '/work', '/work-other/report.md'],
    ['/elsewhere/report.md', '/work', '/elsewhere/report.md'],
    ['/work/report.md', undefined, '/work/report.md'],
    ['docs/report.md', '/work', 'docs/report.md'],
    ['C:\\work\\docs\\report.md', 'C:\\work', 'docs/report.md'],
    ['/docs/report.md', '/', 'docs/report.md'],
  ])('formats %s against only the known root %s', (path, root, expected) => {
    expect(workspaceDisplayPath(path, root)).toBe(expected)
  })

  it('keeps parent context separate from the basename, including workspace-root documents', () => {
    expect(documentParent('alpha/nested/report.md')).toBe('alpha/nested')
    expect(documentParent('beta/report.md')).toBe('beta')
    expect(documentParent('report.md')).toBe('.')
  })
})
