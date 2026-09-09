// @vitest-environment jsdom
/** Real native-tab MarkdownText with the external Mermaid renderer stubbed. */
import { act } from 'react-dom/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import { mountSidebar, SESSION } from './sidebar-harness.tsx'

const initialize = vi.fn()
const render = vi.fn(async (id: string, text: string, _container?: HTMLElement) => ({ svg: `<svg data-id="${id}" data-src="${text}"></svg>` }))
vi.mock('mermaid', () => ({ default: { initialize, render } }))

const DOC = [
  '# Diagrams',
  '',
  '```mermaid',
  'graph TD; A-->B;',
  '```',
  '',
  '```ts',
  'const x = 1',
  '```',
].join('\n')

async function renderDiagrams(content: string): Promise<HTMLElement> {
  const h = await mountSidebar()
  h.files.set(`${SESSION}/doc.md`, { content, fingerprint: 'v1' })
  await act(async () => { h.runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'doc.md')) })
  return h.view.container
}

const settle = async (): Promise<void> => {
  // The pass awaits the dynamic import plus each render.
  await act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve() })
}

const blocksOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('.md-code-block'))

afterEach(() => {
  // Initialization belongs to the module's cached Mermaid import. Keep that
  // evidence across cases while resetting the per-document external render.
  render.mockClear()
})

describe('diagram pass', () => {
  it('waits for a pending external render and confines its late nodes to the released body', async () => {
    let finish!: () => void
    let renderParent: HTMLElement | undefined
    const lateNode = document.createElement('div')
    render.mockImplementationOnce(async (_id, _text, container) => {
      renderParent = container
      await new Promise<void>(resolve => { finish = resolve })
      ;(container ?? document.body).append(lateNode)
      return { svg: '<svg></svg>' }
    })
    const h = await mountSidebar()
    h.files.set(`${SESSION}/doc.md`, { content: DOC, fingerprint: 'v1' })
    await act(async () => { h.runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'doc.md')) })
    let stopped = false
    const disposal = h.disposePlugin().then(() => { stopped = true })
    await act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve() })
    try {
      expect(stopped).toBe(false)
      expect(renderParent).toBeInstanceOf(HTMLElement)
    } finally { await act(async () => { finish(); await disposal }) }
    try {
      expect(lateNode.isConnected).toBe(false)
      expect(stopped).toBe(true)
    } finally { lateNode.remove() }
  })

  it('renders mermaid blocks as SVG and hides their code; other blocks stay', async () => {
    const container = await renderDiagrams(DOC)
    await settle()
    const blocks = blocksOf(container)
    expect(blocks).toHaveLength(2)
    const [mermaid, code] = blocks as [HTMLElement, HTMLElement]
    const host = mermaid.querySelector<HTMLElement>('.dsh-md-preview-diagram')
    expect(host?.querySelector('svg')?.getAttribute('data-src')).toBe('graph TD; A-->B;')
    expect(mermaid.querySelector('pre')?.hasAttribute('hidden')).toBe(true)
    expect(code.querySelector('.dsh-md-preview-diagram')).toBeNull()
    expect(code.querySelector('pre')?.hasAttribute('hidden')).toBe(false)
    expect(initialize).toHaveBeenCalledWith({ startOnLoad: false, securityLevel: 'strict' })
  })

  it('falls back to the source with a caption when the render fails', async () => {
    render.mockRejectedValueOnce(new Error('bad diagram'))
    const container = await renderDiagrams(DOC)
    await settle()
    const [mermaid] = blocksOf(container) as [HTMLElement, HTMLElement]
    expect(mermaid.querySelector('.dsh-md-preview-diagram')).toBeNull()
    expect(mermaid.querySelector('pre')?.hasAttribute('hidden')).toBe(false)
    expect(mermaid.querySelector('.dsh-md-preview-diagram-error')?.textContent).toContain('Diagram')
  })

  it('enhances nothing for a document without mermaid blocks', async () => {
    const container = await renderDiagrams('# Plain\n\ntext only\n')
    await settle()
    expect(render).not.toHaveBeenCalled()
    expect(container.querySelector('.dsh-md-preview-diagram')).toBeNull()
  })

  it('refuses the pass when rendered blocks and fences disagree in count', async () => {
    // An indented (unfenced) code block renders a .md-code-block the fence
    // scan never counts — parity fails, so nothing is enhanced.
    const container = await renderDiagrams('```mermaid\ngraph TD\n```\n\n    indented code\n')
    await settle()
    expect(container.querySelectorAll('.md-code-block').length).toBeGreaterThanOrEqual(2)
    expect(render).not.toHaveBeenCalled()
    expect(container.querySelector('.dsh-md-preview-diagram')).toBeNull()
  })
})
