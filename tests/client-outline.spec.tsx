// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { activeIndexForLine, activeIndexForScroll, extractOutline, findHeadingElement } from '../src/client/outline.ts'

const DOC = [
  '# Title',
  '',
  '```md',
  '# Fenced not heading',
  '```',
  '',
  '## Section *A*',
  'text',
  '### Deep `code` heading##',
  '',
  '~~~',
  '~ not fenced heading either',
  '~~~',
  '',
  '## Section A',
  'repeat text',
].join('\n')

describe('extractOutline', () => {
  it('walks ATX headings in order with levels and lines', () => {
    expect(extractOutline(DOC)).toEqual([
      { level: 1, text: 'Title', line: 1 },
      { level: 2, text: 'Section A', line: 7 },
      // No space before the trailing ##, so commonmark keeps it in the text.
      { level: 3, text: 'Deep code heading##', line: 9 },
      { level: 2, text: 'Section A', line: 15 },
    ])
  })
  it('skips fenced content of both fence kinds and empties', () => {
    expect(extractOutline('```\n# a\n```\n## ok')).toEqual([{ level: 2, text: 'ok', line: 4 }])
    expect(extractOutline('####### seven\n#\n## x')).toEqual([{ level: 2, text: 'x', line: 3 }])
    expect(extractOutline('')).toEqual([])
  })
})

describe('findHeadingElement', () => {
  it('resolves repeated headings by occurrence ordinal', () => {
    const container = document.createElement('div')
    container.innerHTML = '<h2>Section A</h2><h2>Other</h2><h2>Section A</h2>'
    const entries = extractOutline('## Section A\n## Other\n## Section A')
    expect(findHeadingElement(container, entries, 0)?.nextElementSibling?.textContent).toBe('Other')
    expect(findHeadingElement(container, entries, 2)?.textContent).toBe('Section A')
    expect(findHeadingElement(container, entries, 1)?.textContent).toBe('Other')
    expect(findHeadingElement(container, entries, 9)).toBeUndefined()
  })
})

describe('activeIndexForLine / activeIndexForScroll', () => {
  const ENTRIES = extractOutline('# A\n\n## B\n\n## C')
  it('activeIndexForLine owns the position from its heading line onward', () => {
    expect(activeIndexForLine(ENTRIES, 0)).toBe(-1)
    expect(activeIndexForLine(ENTRIES, 1)).toBe(0)
    expect(activeIndexForLine(ENTRIES, 2)).toBe(0)
    expect(activeIndexForLine(ENTRIES, 3)).toBe(1)
    expect(activeIndexForLine(ENTRIES, 5)).toBe(2)
    expect(activeIndexForLine(ENTRIES, 99)).toBe(2)
    expect(activeIndexForLine([], 1)).toBe(-1)
  })
  it('activeIndexForScroll picks the last heading at or above the scroll top', () => {
    expect(activeIndexForScroll([0, 120, 240], 0)).toBe(0)
    expect(activeIndexForScroll([0, 120, 240], 119)).toBe(0)
    expect(activeIndexForScroll([0, 120, 240], 120)).toBe(1)
    expect(activeIndexForScroll([0, 120, 240], 300)).toBe(2)
    expect(activeIndexForScroll([], 0)).toBe(-1)
  })
})
