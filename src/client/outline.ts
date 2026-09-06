/**
 * The outline: the ATX heading sequence of one previewed document, feeding
 * the panel header's outline popover. Source-derived so both faces share one
 * list; fenced code is skipped so `#` lines inside blocks never count, and
 * setext (underlined) headings stay out by design — the view-face jump
 * resolves rendered headings by text, the edit-face jump by source line.
 */

/** One outline entry: heading level, display text, and its 1-based source line. */
export interface OutlineEntry {
  readonly level: number
  readonly text: string
  readonly line: number
}

/** Opening/closing fence of a fenced code block (``` or ~~~). */
const FENCE = /^([`~]{3,})/

/** ATX heading opener: 1–6 `#` then space/tab-separated text (or nothing). */
const ATX = /^(#{1,6})(?:[ \t]+(.*))?/

/**
 * Heading text for display: emphasis markers and backticks never read. The
 * closing `#` sequence only counts when a space precedes it (commonmark).
 */
function headingText(line: string): string {
  const raw = (ATX.exec(line)?.[2] ?? '')
    .replace(/[ \t]+#+[ \t]*$/, '')
    .replace(/[ \t]+$/, '')
  return raw
    .replace(/`+/g, '')
    .replace(/\*\*?|__?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract the outline of one markdown document.
 * @param content - the document's full text.
 * @returns ATX headings in order; fenced code is not scanned.
 */
export function extractOutline(content: string): readonly OutlineEntry[] {
  const entries: OutlineEntry[] = []
  const lines = content.split('\n')
  let fence: string | null = null
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] as string
    const fenceMatch = FENCE.exec(line)
    if (fence !== null) {
      if (fenceMatch !== null && fenceMatch[1]?.startsWith(fence)) fence = null
      continue
    }
    if (fenceMatch !== null) {
      fence = fenceMatch[1] ?? null
      continue
    }
    if (!/^#{1,6}([ \t]|$)/.test(line)) continue
    const text = headingText(line)
    if (text.length === 0) continue
    entries.push({ level: line.match(/^#+/)![0].length, text, line: index + 1 })
  }
  return entries
}

/** Whitespace-collapsed comparable form of a rendered heading's text. */
function comparable(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Resolve the rendered DOM heading of one outline entry.
 * @param container - the rendered document container.
 * @param entries - the outline the popover shows.
 * @param index - the entry being navigated to.
 * @returns the matching heading element, or undefined when the rendered
 *   document spells it differently (setext forms the source scan skips).
 */
export function findHeadingElement(
  container: ParentNode | null,
  entries: readonly OutlineEntry[],
  index: number,
): HTMLElement | undefined {
  if (container === null) return undefined
  const entry = entries[index]
  if (entry === undefined) return undefined
  const wanted = comparable(entry.text)
  // The entry's occurrence ordinal among same-text headings decides which
  // rendered heading (duplicates included) the jump targets.
  let ordinal = 0
  for (let prior = 0; prior < index; prior += 1) {
    if (comparable(entries[prior]?.text ?? '') === wanted) ordinal += 1
  }
  let seen = 0
  for (const heading of container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')) {
    if (comparable(heading.textContent ?? '') !== wanted) continue
    if (seen === ordinal) return heading
    seen += 1
  }
  return undefined
}
