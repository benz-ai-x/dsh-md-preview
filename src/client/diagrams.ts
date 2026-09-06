/**
 * The diagram pass: once the platform renderer settles the document, the
 * panel enhances mermaid code blocks inside its own rendered subtree. The
 * block's banner stays (copy keeps reading the source), the code hides, and
 * mermaid's SVG shows above it. Every failure — a bad diagram, a failed
 * import, a shape the parity check refuses — falls back to the plain code
 * block; the platform renderer itself is never touched.
 */

/** The mermaid surface this pass uses (the import seam tests mock). */
interface MermaidSurface {
  initialize(config: Record<string, unknown>): void
  render(id: string, text: string): Promise<{ svg: string }>
}

let surfacePromise: Promise<MermaidSurface> | null = null
let idCounter = 0

/** Load mermaid once per document, initializing it for manual rendering. */
function loadSurface(): Promise<MermaidSurface> {
  surfacePromise ??= import('mermaid').then((module) => {
    const surface = (module as { default?: MermaidSurface }).default
    if (surface === undefined) throw new Error('mermaid default export missing')
    surface.initialize({ startOnLoad: false, securityLevel: 'strict' })
    return surface
  })
  return surfacePromise
}

/** Opening/closing fence of a fenced code block (``` or ~~~). */
const FENCE = /^([`~]{3,})/

/**
 * The fenced-block languages of one markdown document, in document order —
 * the info word of each fence, lowercased. Indented (unfenced) code never
 * lists, so the array aligns 1:1 with the rendered `.md-code-block` sequence.
 */
export function fenceLanguages(content: string): readonly string[] {
  const langs: string[] = []
  let fence: string | null = null
  for (const line of content.split('\n')) {
    const match = FENCE.exec(line)
    if (fence !== null) {
      if (match !== null && match[1]?.startsWith(fence)) fence = null
      continue
    }
    if (match === null) continue
    const marker = match[1] ?? ''
    fence = marker
    langs.push(line.slice(marker.length).trim().split(/\s+/)[0]?.toLowerCase() ?? '')
  }
  return langs
}

/**
 * The panel's mermaid blocks: rendered `.md-code-block`s whose backing fence
 * said mermaid. Matched by order parity — the only stable class the platform
 * renderer guarantees — and refused wholesale on any count mismatch.
 */
export function findDiagramBlocks(root: ParentNode, fenceLangs: readonly string[]): readonly HTMLElement[] {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('.md-code-block'))
  if (blocks.length !== fenceLangs.length) return []
  return blocks.filter((_, index) => fenceLangs[index] === 'mermaid')
}

/** Labels the panel injects (locale lives in the React world, not here). */
export interface DiagramLabels {
  /** Caption under a block whose diagram failed to render. */
  readonly error: string
}

/**
 * Render every not-yet-enhanced mermaid block of one rendered document.
 * Idempotent per block; safe to re-run after the DOM is replaced.
 * @param root - the panel's rendered document container.
 * @param content - the document source backing the rendered container.
 * @param labels - the fallback caption.
 */
export async function enhanceDiagrams(root: ParentNode, content: string, labels: DiagramLabels): Promise<void> {
  for (const block of findDiagramBlocks(root, fenceLanguages(content))) {
    if (block.hasAttribute('data-md-preview-diagram')) continue
    block.setAttribute('data-md-preview-diagram', 'pending')
    const pre = block.querySelector('pre')
    const source = (pre?.textContent ?? '').trim()
    if (source.length === 0) continue
    let svg: string
    try {
      svg = (await (await loadSurface()).render(`dsh-md-preview-diagram-${idCounter++}`, source)).svg
    } catch {
      block.setAttribute('data-md-preview-diagram', 'failed')
      const note = document.createElement('div')
      note.className = 'dsh-md-preview-diagram-error'
      note.textContent = labels.error
      block.append(note)
      continue
    }
    const host = document.createElement('div')
    host.className = 'dsh-md-preview-diagram'
    // Mermaid's own SVG output; securityLevel strict sanitizes its labels.
    host.innerHTML = svg
    block.append(host)
    pre?.setAttribute('hidden', 'hidden')
  }
}
