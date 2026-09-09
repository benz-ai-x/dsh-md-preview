/** Source-line navigation within the platform-rendered Markdown body. */
/**
 * Find the enclosing ATX section using the platform renderer's source
 * positions. DOM order can differ from source order for footnote headings.
 */
export function findPreviewSection(container: ParentNode | null, content: string, line: number): HTMLElement | undefined {
  if (container === null) return undefined
  let latestLine = 0
  let target: HTMLElement | undefined
  for (const heading of container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')) {
    const sourceLine = Number(heading.dataset.mdSourceLine)
    const offset = Number(heading.dataset.mdSourceOffset)
    if (sourceLine > latestLine && sourceLine <= line
      && Number.isInteger(offset) && offset >= 0
      && /^#{1,6}(?=[ \t\r\n]|$)/.test(content.slice(offset))) {
      latestLine = sourceLine
      target = heading
    }
  }
  return target
}
