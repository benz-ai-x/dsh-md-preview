// @vitest-environment jsdom
/**
 * The diagram pass against the real rendered MarkdownText: mermaid blocks
 * gain the SVG host and hide their code, other blocks stay untouched, and a
 * failing render falls back to the source with a caption. Mermaid itself is
 * mocked at the import seam (its own rendering is upstream-tested).
 */

import { useSyncExternalStore } from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import { PreviewOverlay } from '../src/client/PreviewOverlay.tsx'
import { createPreviewStore } from '../src/client/preview-state.ts'
import { createLeaveIntentSeat } from '../src/client/leave-intent.ts'
import type { MdPreviewFile } from '../src/protocol.ts'

const t = (key: string) => key

const initialize = vi.fn()
const render = vi.fn(async (id: string, text: string) => ({ svg: `<svg data-id="${id}" data-src="${text}"></svg>` }))
vi.mock('mermaid', () => ({ default: { initialize, render } }))

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

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
  const store = createPreviewStore()
  const leave = createLeaveIntentSeat()
  const readResult: { ok: true; value: MdPreviewFile } = { ok: true, value: { path: 'doc.md', content, fingerprint: 'v1' } }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const usePreviewTarget = (selector: (state: unknown) => unknown) =>
    selector(useSyncExternalStore(store.subscribe, store.getSnapshot))
  const root: Root = createRoot(container)
  const element = () => (
    <PreviewOverlay
      usePreviewTarget={usePreviewTarget as never}
      leave={leave}
      close={() => { store.set(null) }}
      read={(() => Promise.resolve(readResult)) as never}
      write={(vi.fn(() => Promise.resolve({ ok: true, value: { path: 'doc.md', fingerprint: 'v2' } }))) as never}
      t={t as never}
    />
  )
  store.set({ sessionId: 'session-1', path: 'doc.md' })
  await act(async () => { root.render(element()) })
  await act(async () => { await Promise.resolve() })
  return container
}

const settle = async (): Promise<void> => {
  // The pass awaits the dynamic import plus each render.
  await act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve() })
}

const blocksOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('.md-code-block'))

afterEach(() => {
  document.body.replaceChildren()
  vi.clearAllMocks()
})

describe('diagram pass', () => {
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
    expect(mermaid.querySelector('.dsh-md-preview-diagram-error')?.textContent).toBe('diagram.error')
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
