// @vitest-environment jsdom
/** Markdown behavior through the official tab service and production renderer. */
import { act } from 'react-dom/test-utils'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { mountSidebar, SESSION } from './sidebar-harness.tsx'

describe('Markdown in the official right sidebar', () => {
  it('returns keyboard focus and the selection to the editor after Keep editing', async () => {
    const { runtime, view } = await mountSidebar()
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    const editor = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement)!
    await act(async () => {
      editor.dispatch({ changes: { from: 0, insert: 'draft ' }, selection: { anchor: 1, head: 4 } })
      editor.focus()
      const reload = view.view.getByRole('button', { name: 'Reload', exact: true })
      reload.focus(); reload.click()
    })
    const keep = [...document.querySelectorAll('button')].find(button => button.textContent === 'Keep editing')!
    expect(document.activeElement).toBe(keep)
    await act(async () => { keep.click() })
    expect(editor.hasFocus).toBe(true)
    expect(editor.state.selection.main.from).toBe(1)
    expect(editor.state.selection.main.to).toBe(4)
    expect(editor.state.sliceDoc()).toMatch(/^draft /)
  })

  it('keeps the visible draft, selection and history when floating and docking the same tab', async () => {
    const { runtime, view } = await mountSidebar()
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    let editor = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement)!
    await act(async () => { editor.dispatch({ changes: { from: 0, insert: 'float draft ' }, selection: { anchor: 3, head: 8 } }) })
    const expected = editor.state.sliceDoc()
    await act(async () => { runtime.ctx.sidebarRight.float(runtime.ctx.sidebarRight.active()!.id, { x: 10, y: 10, width: 550, height: 600 }) })
    editor = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement)!
    expect(editor.state.sliceDoc()).toBe(expected)
    expect(editor.state.selection.main.from).toBe(3)
    expect(editor.state.selection.main.to).toBe(8)
    const click = (name: string) => [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === name)!.click()
    await act(async () => { click('Undo') })
    expect(editor.state.sliceDoc()).toBe('# Migrated Markdown\n\n**Ready**\n')
    await act(async () => { click('Redo') })
    const dock = document.querySelector<HTMLButtonElement>('[data-dockkit-float-dock]')!
    await act(async () => { dock.click() })
    editor = EditorView.findFromDOM(document.querySelector('.cm-editor') as HTMLElement)!
    expect(editor.state.sliceDoc()).toBe(expected)
    await act(async () => { click('Undo') })
    expect(editor.state.sliceDoc()).toBe('# Migrated Markdown\n\n**Ready**\n')
  })

  it('freezes formatting shortcuts while the draft is being saved', async () => {
    const { runtime, view, remote } = await mountSidebar()
    const write = remote.write
    let finish!: () => void
    remote.write = async (...args) => { await new Promise<void>(resolve => { finish = resolve }); return write(...args) }
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    const format = (key: string) => editor.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true }))
    await act(async () => { format('b') })
    expect(editor.state.sliceDoc()).toContain('****')
    const draft = editor.state.sliceDoc()
    await act(async () => { view.view.getByRole('button', { name: 'Save', exact: true }).click() })
    try {
      await act(async () => { format('b'); format('i'); format('k') })
      expect(editor.state.sliceDoc()).toBe(draft)
    } finally { await act(async () => { finish() }) }
  })

  it('coalesces a rapid double reload so an older read cannot replace the latest file', async () => {
    const { runtime, view, remote } = await mountSidebar()
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    let calls = 0
    const finishes: Array<() => void> = []
    remote.read = async () => {
      calls += 1
      await new Promise<void>(resolve => { finishes.push(resolve) })
      return { ok: true, value: { path: 'guide.md', content: '# Reloaded\n', fingerprint: 'v2' } }
    }
    await act(async () => {
      const reload = view.view.getByRole('button', { name: 'Reload', exact: true })
      reload.click(); reload.click()
    })
    const count = calls
    await act(async () => { finishes.forEach(finish => finish()) })
    expect(count).toBe(1)
    expect(view.view.getByRole('heading', { name: 'Reloaded' })).toBeTruthy()
  })

  it('renders a Markdown resource opened by the official service in its native tab', async () => {
    const { runtime, view, reads } = await mountSidebar()
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    expect(view.view.getByRole('heading', { name: 'Migrated Markdown' })).toBeTruthy()
    expect(view.view.getByText('Ready').tagName).toBe('STRONG')
    expect(reads).toEqual([{ sessionId: SESSION, path: 'guide.md' }])
  })

  it('keeps each live document when switching tabs and reopening with a line target', async () => {
    const { runtime, view, reads } = await mountSidebar()
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'notes.markdown')) })
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md'), { params: { line: 3 } }) })
    expect(view.view.getByRole('heading', { name: 'Migrated Markdown' })).toBeTruthy()
    expect(reads).toEqual([
      { sessionId: SESSION, path: 'guide.md' },
      { sessionId: SESSION, path: 'notes.markdown' },
    ])
  })

  it('edits the full original and saves with its fingerprint before confirming the preview', async () => {
    const { runtime, view, writes, reads } = await mountSidebar()
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    expect((view.view.getByRole('button', { name: 'Save', exact: true }) as HTMLButtonElement).disabled).toBe(true)
    const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    expect(editor.state.sliceDoc()).toBe('# Migrated Markdown\n\n**Ready**\n')
    await act(async () => { editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: '# Saved Markdown\n' } }) })
    await act(async () => { view.view.getByRole('button', { name: 'Save', exact: true }).click() })
    expect(writes).toEqual([{ sessionId: SESSION, path: 'guide.md', content: '# Saved Markdown\n', fingerprint: 'v1', force: false }])
    expect(view.view.getByRole('heading', { name: 'Saved Markdown' })).toBeTruthy()
    expect(view.view.getByRole('status').textContent).toBe('Saved')
    expect(reads).toHaveLength(2)
    await act(async () => { view.view.getByRole('button', { name: 'Reload', exact: true }).click() })
    expect(view.view.queryByText('Saved', { exact: true })).toBeNull()
  })

  it('clears an earlier save confirmation when a new draft is discarded', async () => {
    const { runtime, view } = await mountSidebar()
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    const edit = async (text: string) => {
      await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
      const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
      await act(async () => { editor.dispatch({ changes: { from: 0, insert: text } }) })
    }
    await edit('saved ')
    await act(async () => { view.view.getByRole('button', { name: 'Save', exact: true }).click() })
    expect(view.view.getByRole('status').textContent).toBe('Saved')
    await edit('discarded ')
    await act(async () => { view.view.getByRole('button', { name: 'Preview', exact: true }).click() })
    const discard = [...document.querySelectorAll('button')].find(button => button.textContent === 'Discard changes')!
    await act(async () => { discard.click() })
    expect(view.view.queryByText('Saved', { exact: true })).toBeNull()
    expect(view.container.textContent).not.toContain('discarded ')
  })

  it('retains a draft and its undo/redo history while another tab is viewed', async () => {
    const { runtime, view, writes } = await mountSidebar()
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    let editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    await act(async () => { editor.dispatch({ changes: { from: 0, insert: 'draft ' } }) })
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'notes.md')) })
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    expect(editor.state.sliceDoc()).toBe('draft # Migrated Markdown\n\n**Ready**\n')
    await act(async () => { view.view.getByRole('button', { name: 'Undo', exact: true }).click() })
    expect(editor.state.sliceDoc()).toBe('# Migrated Markdown\n\n**Ready**\n')
    await act(async () => { view.view.getByRole('button', { name: 'Redo', exact: true }).click() })
    expect(editor.state.sliceDoc()).toBe('draft # Migrated Markdown\n\n**Ready**\n')
    expect(writes).toEqual([])
  })

  it('asks once before the native × removes a dirty tab and keeps the draft after cancellation', async () => {
    const { runtime, view, reads } = await mountSidebar()
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    await act(async () => { editor.dispatch({ changes: { from: 0, insert: 'draft ' } }) })
    const tabId = runtime.ctx.sidebarRight.active()!.id
    const close = view.container.querySelector<HTMLButtonElement>(`[data-dockkit-tab-close="${tabId}"]`)!
    await act(async () => { close.click(); close.click() })
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog?.textContent).toContain('You have unsaved changes')
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    const findButton = (name: string) => [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === name)!
    await act(async () => { findButton('Keep editing').click() })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(editor.state.sliceDoc()).toBe('draft # Migrated Markdown\n\n**Ready**\n')
    await act(async () => { close.click() })
    await act(async () => { findButton('Discard changes').click() })
    expect(view.container.querySelector('.cm-editor')).toBeNull()
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    expect(view.view.getByRole('heading', { name: 'Migrated Markdown' })).toBeTruthy()
    expect(reads).toHaveLength(2)
  })

  it('keeps the first discard intent when preview and reload are requested together', async () => {
    const { runtime, view, reads } = await mountSidebar()
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    await act(async () => { editor.dispatch({ changes: { from: 0, insert: 'discard me ' } }) })
    await act(async () => {
      view.view.getByRole('button', { name: 'Preview', exact: true }).click()
      view.view.getByRole('button', { name: 'Reload', exact: true }).click()
    })
    const discard = [...document.querySelectorAll('button')].find(button => button.textContent === 'Discard changes')!
    await act(async () => { discard.click() })
    expect(view.view.getByRole('heading', { name: 'Migrated Markdown' })).toBeTruthy()
    expect(reads).toHaveLength(1)
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    expect(EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!.state.sliceDoc()).toBe('# Migrated Markdown\n\n**Ready**\n')
  })

  it('preserves a conflicted draft and only overwrites after the explicit force action', async () => {
    const { runtime, view, files, writes } = await mountSidebar()
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    await act(async () => { editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: '# My draft\n' } }) })
    files.set(`${SESSION}/guide.md`, { content: '# External\n', fingerprint: 'external-v2' })
    await act(async () => { view.view.getByRole('button', { name: 'Save', exact: true }).click() })
    expect(view.container.textContent).toContain('The file changed elsewhere')
    expect(editor.state.sliceDoc()).toBe('# My draft\n')
    expect(files.get(`${SESSION}/guide.md`)?.content).toBe('# External\n')
    await act(async () => { view.view.getByRole('button', { name: 'Overwrite', exact: true }).click() })
    expect(writes.at(-1)).toEqual({ sessionId: SESSION, path: 'guide.md', content: '# My draft\n', fingerprint: undefined, force: true })
    expect(view.view.getByRole('heading', { name: 'My draft' })).toBeTruthy()
  })

  it('reports a confirming read failure as already saved and lets the user retry without writing twice', async () => {
    const { runtime, view, remote, writes } = await mountSidebar()
    const read = remote.read
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    await act(async () => { editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: '# Written\n' } }) })
    remote.read = async () => ({ ok: false, error: { code: 'md-preview/unavailable', message: 'Read offline', details: {} } })
    await act(async () => { view.view.getByRole('button', { name: 'Save', exact: true }).click() })
    expect(view.container.textContent).toContain('Saved to the workspace, but reading the latest content failed')
    expect(view.container.textContent).not.toContain('Unsaved')
    remote.read = read
    await act(async () => { view.view.getByRole('button', { name: 'Reload', exact: true }).click() })
    expect(view.view.getByRole('heading', { name: 'Written' })).toBeTruthy()
    expect(writes).toHaveLength(1)
  })

  it('waits for an in-flight save before allowing the native tab to close', async () => {
    const { runtime, view, remote, writes } = await mountSidebar()
    const write = remote.write
    let finish!: () => void
    const pending = new Promise<void>(resolve => { finish = resolve })
    remote.write = async (...args) => { await pending; return write(...args) }
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    await act(async () => { editor.dispatch({ changes: { from: 0, insert: 'saved ' } }) })
    const tabId = runtime.ctx.sidebarRight.active()!.id
    await act(async () => { view.view.getByRole('button', { name: 'Save', exact: true }).click() })
    try {
      expect(editor.contentDOM.getAttribute('contenteditable')).toBe('false')
      await act(async () => { runtime.ctx.sidebarRight.close(tabId) })
      expect(document.querySelector('[role="dialog"]')).toBeNull()
      expect(view.container.querySelector('.cm-editor')).not.toBeNull()
    } finally { await act(async () => { finish() }) }
    expect(writes).toHaveLength(1)
    expect(view.container.querySelector('.cm-editor')).toBeNull()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('warns before browser refresh while a hidden live tab has an unsaved draft', async () => {
    const { runtime, view } = await mountSidebar()
    const refresh = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    expect(refresh()).toBe(false)
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    await act(async () => { editor.dispatch({ changes: { from: 0, insert: 'unsaved ' } }) })
    await act(async () => { runtime.ctx.sidebarRight.toggleExpanded() })
    expect(refresh()).toBe(true)
    await act(async () => { runtime.ctx.sidebarRight.toggleExpanded() })
    await act(async () => { view.view.getByRole('button', { name: 'Save', exact: true }).click() })
    expect(refresh()).toBe(false)
  })

  it.each(['# Guide\n', '# Guide\r\n\r\nBody\r\n', '# Guide', ''])('preserves original line endings and trailing bytes while editing %j', async (source) => {
    const { runtime, view, files, writes } = await mountSidebar()
    files.set(`${SESSION}/guide.md`, { content: source, fingerprint: 'original' })
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    expect(editor.state.sliceDoc()).toBe(source)
    await act(async () => { editor.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })) })
    expect(writes).toEqual([])
    await act(async () => { editor.dispatch({ changes: { from: editor.state.doc.length, insert: 'x' } }) })
    await act(async () => { view.view.getByRole('button', { name: 'Save', exact: true }).click() })
    expect(writes).toEqual([{ sessionId: SESSION, path: 'guide.md', content: `${source}x`, fingerprint: 'original', force: false }])
  })

  it('opens in-document find from the editor toolbar and selects the requested match', async () => {
    const { runtime, view } = await mountSidebar()
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    await act(async () => { view.view.getByRole('button', { name: 'Find', exact: true }).click() })
    const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    const input = view.container.querySelector<HTMLInputElement>('.cm-search input[name="search"]')!
    await act(async () => {
      input.value = 'Ready'
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'y', bubbles: true }))
      view.container.querySelector<HTMLButtonElement>('.cm-search button[name="next"]')!.click()
    })
    const selection = editor.state.selection.main
    expect(editor.state.sliceDoc(selection.from, selection.to)).toBe('Ready')
  })

  it('applies a new line navigation without rereading or resetting a live draft', async () => {
    const { runtime, view, reads } = await mountSidebar()
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    const tabId = runtime.ctx.sidebarRight.active()!.id
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    let editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    await act(async () => { editor.dispatch({ changes: { from: 0, insert: 'draft ' } }) })
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md'), { params: { line: 3 } }) })
    expect(editor.state.doc.lineAt(editor.state.selection.main.head).number).toBe(3)
    expect(editor.state.sliceDoc()).toBe('draft # Migrated Markdown\n\n**Ready**\n')
    await act(async () => { editor.dispatch({ selection: { anchor: 0 } }) })
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'notes.md')) })
    await act(async () => { runtime.ctx.sidebarRight.focus(tabId) })
    editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    expect(editor.state.selection.main.head).toBe(0)
    expect(reads.filter(read => read.path === 'guide.md')).toHaveLength(1)
  })

  it('isolates same-named documents across session switches', async () => {
    const { runtime, view, files, reads } = await mountSidebar()
    const other = 'markdown-session-b' as SessionId
    await runtime.sessions.add({ id: other, summary: { cwd: '/workspace/b' } }, { current: false })
    files.set(`${other}/guide.md`, { content: '# Session B\n', fingerprint: 'b1' })
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    await act(async () => { editor.dispatch({ changes: { from: 0, insert: 'A draft ' } }) })
    await runtime.sessions.setCurrent(other)
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(other, 'guide.md')) })
    expect(view.view.getByRole('heading', { name: 'Session B' })).toBeTruthy()
    await runtime.sessions.setCurrent(SESSION)
    expect(EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!.state.sliceDoc()).toBe('A draft # Migrated Markdown\n\n**Ready**\n')
    expect(reads).toEqual([{ sessionId: SESSION, path: 'guide.md' }, { sessionId: other, path: 'guide.md' }])
  })

  it('cancels a closed tab read and ignores its late result after reopening the same resource', async () => {
    const { runtime, view, remote } = await mountSidebar()
    let finish!: (result: Awaited<ReturnType<typeof remote.read>>) => void
    let signal!: AbortSignal
    remote.read = (_session, _path, requestSignal) => {
      signal = requestSignal
      return new Promise(resolve => { finish = resolve })
    }
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { runtime.ctx.sidebarRight.close(runtime.ctx.sidebarRight.active()!.id) })
    expect(signal.aborted).toBe(true)
    remote.read = async () => ({ ok: true, value: { path: 'guide.md', content: '# Current\n', fingerprint: 'new' } })
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { finish({ ok: true, value: { path: 'guide.md', content: '# Late\n', fingerprint: 'old' } }) })
    expect(view.view.getByRole('heading', { name: 'Current' })).toBeTruthy()
    expect(view.view.queryByRole('heading', { name: 'Late' })).toBeNull()
  })

  it('uses platform GFM and math rendering and keeps invalid Mermaid source readable', async () => {
    const { runtime, view, files } = await mountSidebar()
    files.set(`${SESSION}/guide.md`, { fingerprint: 'rich', content: [
      '# Rich', '', '| A | B |', '| --- | --- |', '| one | two |', '', '$x^2$', '',
      '```ts', 'const x = 1', '```', '', '```mermaid', 'not-a-diagram', '```', '',
    ].join('\n') })
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    expect(view.view.getByRole('table').textContent).toContain('onetwo')
    expect(view.container.querySelector('.katex')).not.toBeNull()
    expect(view.container.querySelectorAll('.md-code-block')).toHaveLength(2)
    await view.view.findByText('Diagram failed to render; showing source', {}, { timeout: 3000 })
    const source = [...view.container.querySelectorAll('pre')].find(pre => pre.textContent?.includes('not-a-diagram'))!
    expect(source.hidden).toBe(false)
  })

  it('offers the native read-only viewer when a Markdown file exceeds the editing limit', async () => {
    const { runtime, view, remote, writes } = await mountSidebar()
    remote.read = async () => ({ ok: false, error: { code: 'md-preview/too-large', message: 'Over the configured cap', details: {} } })
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    expect(view.container.textContent).toContain('This file exceeds the editing limit')
    expect(view.view.queryByRole('button', { name: 'Edit', exact: true })).toBeNull()
    await act(async () => { view.view.getByRole('button', { name: 'Open native text viewer', exact: true }).click() })
    expect(view.view.getByText('Native text fallback')).toBeTruthy()
    expect(writes).toEqual([])
  })

  it('keeps a draft after a failed write and provides a successful retry', async () => {
    const { runtime, view, remote } = await mountSidebar()
    const write = remote.write
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    await act(async () => { editor.dispatch({ changes: { from: 0, insert: 'keep ' } }) })
    remote.write = async () => ({ ok: false, error: { code: 'md-preview/forbidden', message: 'Write is not permitted', details: {} } })
    await act(async () => { view.view.getByRole('button', { name: 'Save', exact: true }).click() })
    expect(view.view.getByRole('alert').textContent).toContain('md-preview/forbidden')
    expect(editor.state.sliceDoc()).toBe('keep # Migrated Markdown\n\n**Ready**\n')
    remote.write = write
    await act(async () => { view.view.getByRole('button', { name: 'Save', exact: true }).click() })
    expect(view.view.queryByRole('alert')).toBeNull()
    expect(view.container.querySelector('.cm-editor')).toBeNull()
  })

  it('clears stale metadata after reloading a file changed by an external editor', async () => {
    const { runtime, view, metadata, files } = await mountSidebar()
    const address = sessionFileAddress(SESSION, 'guide.md')
    await act(async () => { runtime.ctx.sidebarRight.openResource(address) })
    const source = metadata(address)
    await act(async () => {
      source.set({
        ...source.getSnapshot(), status: 'live',
        value: { absolutePath: '/workspace/a/guide.md', version: 'v1', changed: false },
        // The public resource reload restats the file; an external editor does
        // not emit fs/observed and therefore does not update this stream itself.
        reload() {
          source.set({ ...source.getSnapshot(), value: {
            absolutePath: '/workspace/a/guide.md', version: files.get(`${SESSION}/guide.md`)!.fingerprint, changed: false,
          } })
        },
      })
    })
    files.set(`${SESSION}/guide.md`, { content: '# Latest from external editor\n', fingerprint: 'v2' })
    await act(async () => { view.view.getByRole('button', { name: 'Reload', exact: true }).click() })
    expect(view.view.getByRole('heading', { name: 'Latest from external editor' })).toBeTruthy()
    expect(view.view.queryByText('The file changed elsewhere', { exact: false })).toBeNull()

    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    await act(async () => { editor.dispatch({ changes: { from: 0, insert: 'unsaved ' } }) })
    files.set(`${SESSION}/guide.md`, { content: '# Another external edit\n', fingerprint: 'v3' })
    await act(async () => { view.view.getByRole('button', { name: 'Reload', exact: true }).click() })
    const dialogButton = (name: string) => [...document.querySelectorAll('[role="dialog"] button')].find(button => button.textContent === name) as HTMLButtonElement
    expect(view.view.queryByText('The file changed elsewhere', { exact: false })).toBeNull()
    await act(async () => { dialogButton('Keep editing').click() })
    expect(editor.state.sliceDoc()).toBe('unsaved # Latest from external editor\n')
    expect(view.view.queryByText('The file changed elsewhere', { exact: false })).toBeNull()
    await act(async () => { view.view.getByRole('button', { name: 'Reload', exact: true }).click() })
    await act(async () => { dialogButton('Discard changes').click() })
    expect(view.view.getByRole('heading', { name: 'Another external edit' })).toBeTruthy()
    expect(view.view.queryByText('The file changed elsewhere', { exact: false })).toBeNull()

    await act(async () => {
      source.set({ ...source.getSnapshot(), value: { absolutePath: '/workspace/a/guide.md', version: 'v4', changed: true } })
    })
    expect(view.view.getByRole('status').textContent).toBe('The file changed elsewhere')
    expect(view.view.getByRole('heading', { name: 'Another external edit' })).toBeTruthy()
  })

  it('does not restat a resource after its reloading tab is closed', async () => {
    const { runtime, view, metadata, remote } = await mountSidebar()
    const address = sessionFileAddress(SESSION, 'guide.md')
    await act(async () => { runtime.ctx.sidebarRight.openResource(address) })
    const metadataRequests: string[] = []
    const source = metadata(address)
    await act(async () => {
      source.set({ ...source.getSnapshot(), reload: () => { metadataRequests.push(address) } })
    })
    let finish!: () => void
    const pending = new Promise<void>(resolve => { finish = resolve })
    const read = remote.read
    remote.read = async (...args) => { await pending; return read(...args) }
    await act(async () => { view.view.getByRole('button', { name: 'Reload', exact: true }).click() })
    try {
      await act(async () => { runtime.ctx.sidebarRight.close(runtime.ctx.sidebarRight.active()!.id) })
    } finally { await act(async () => { finish() }) }
    expect(metadataRequests).toEqual([])
  })

  it('announces a newer first metadata version without replacing the loaded draft', async () => {
    const { runtime, view, metadata, files } = await mountSidebar()
    const address = sessionFileAddress(SESSION, 'guide.md')
    await act(async () => { runtime.ctx.sidebarRight.openResource(address) })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    await act(async () => { editor.dispatch({ changes: { from: 0, insert: 'unsaved ' } }) })
    files.set(`${SESSION}/guide.md`, { content: '# Updated by Host\n', fingerprint: 'v2' })
    await act(async () => {
      const source = metadata(address)
      source.set({ ...source.getSnapshot(), status: 'live', value: { absolutePath: '/workspace/a/guide.md', version: 'v2', changed: false } })
    })
    expect(view.view.getByRole('status').textContent).toContain('The file changed elsewhere')
    expect(editor.state.sliceDoc()).toBe('unsaved # Migrated Markdown\n\n**Ready**\n')
  })

  it('announces a Host-observed version change without refreshing the current document', async () => {
    const { runtime, view, metadata, files, reads } = await mountSidebar()
    const address = sessionFileAddress(SESSION, 'guide.md')
    await act(async () => { runtime.ctx.sidebarRight.openResource(address) })
    files.set(`${SESSION}/guide.md`, { content: '# Updated by Host\n', fingerprint: 'v2' })
    await act(async () => {
      const source = metadata(address)
      source.set({ ...source.getSnapshot(), status: 'live', value: { absolutePath: '/workspace/a/guide.md', version: 'v2', changed: true } })
    })
    expect(view.view.getByRole('status').textContent).toContain('The file changed elsewhere')
    expect(view.view.getByRole('heading', { name: 'Migrated Markdown' })).toBeTruthy()
    expect(reads).toHaveLength(1)
    // A reload in another native viewer clears the shared metadata flag,
    // but this tab still holds its old body until its own Reload action.
    await act(async () => {
      const source = metadata(address)
      source.set({ ...source.getSnapshot(), status: 'live', value: { absolutePath: '/workspace/a/guide.md', version: 'v2', changed: false } })
    })
    expect(view.view.getByRole('status').textContent).toContain('The file changed elsewhere')
    expect(view.view.getByRole('heading', { name: 'Migrated Markdown' })).toBeTruthy()
    await act(async () => { view.view.getByRole('button', { name: 'Reload', exact: true }).click() })
    expect(view.view.getByRole('heading', { name: 'Updated by Host' })).toBeTruthy()
    expect(view.container.textContent).not.toContain('The file changed elsewhere')
  })

  it('does not replay an old source-line target when returning to the editor', async () => {
    const { runtime, view, files } = await mountSidebar()
    const address = sessionFileAddress(SESSION, 'guide.md')
    files.set(`${SESSION}/guide.md`, { content: '# First\n\nIntroduction\n\n## Second\nTarget\n', fingerprint: 'line-v1' })
    await act(async () => { runtime.ctx.sidebarRight.openResource(address, { params: { line: 6 } }) })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    const editor = () => EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    expect(editor().state.doc.lineAt(editor().state.selection.main.head).number).toBe(6)
    await act(async () => { editor().dispatch({ selection: { anchor: 0 } }) })
    await act(async () => { view.view.getByRole('button', { name: 'Preview', exact: true }).click() })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    expect(editor().state.doc.lineAt(editor().state.selection.main.head).number).toBe(1)
    await act(async () => { runtime.ctx.sidebarRight.openResource(address, { params: { line: 3 } }) })
    expect(editor().state.doc.lineAt(editor().state.selection.main.head).number).toBe(3)
  })

  it('locates the source line again when explicitly requested after returning to preview', async () => {
    const { runtime, view, files } = await mountSidebar()
    const address = sessionFileAddress(SESSION, 'guide.md')
    files.set(`${SESSION}/guide.md`, { content: '# First\n\nIntroduction\n\n## Second\nTarget\n', fingerprint: 'line-v1' })
    await act(async () => { runtime.ctx.sidebarRight.openResource(address, { params: { line: 6 } }) })
    await act(async () => { view.view.getByRole('button', { name: 'Source line 6' }).click() })
    const editor = () => EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    expect(editor().state.doc.lineAt(editor().state.selection.main.head).number).toBe(6)
    await act(async () => { editor().dispatch({ selection: { anchor: 0 } }) })
    await act(async () => { view.view.getByRole('button', { name: 'Preview', exact: true }).click() })
    await act(async () => { view.view.getByRole('button', { name: 'Source line 6' }).click() })
    expect(editor().state.doc.lineAt(editor().state.selection.main.head).number).toBe(6)

    await act(async () => { editor().dispatch({ changes: { from: 0, insert: 'draft ' }, selection: { anchor: 0 } }) })
    await act(async () => { view.view.getByRole('button', { name: 'Source line 6' }).click() })
    expect(editor().state.doc.lineAt(editor().state.selection.main.head).number).toBe(6)
    expect(editor().state.sliceDoc()).toBe('draft # First\n\nIntroduction\n\n## Second\nTarget\n')
    await act(async () => { view.view.getByRole('button', { name: 'Undo', exact: true }).click() })
    expect(editor().state.sliceDoc()).toBe('# First\n\nIntroduction\n\n## Second\nTarget\n')
    await act(async () => { view.view.getByRole('button', { name: 'Redo', exact: true }).click() })
    expect(editor().state.sliceDoc()).toBe('draft # First\n\nIntroduction\n\n## Second\nTarget\n')
  })

  it('exposes the requested source line from preview and locates it when editing starts', async () => {
    const { runtime, view, files } = await mountSidebar()
    files.set(`${SESSION}/guide.md`, { content: '# First\n\nIntroduction\n\n## Second\nTarget\n', fingerprint: 'line-v1' })
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md'), { params: { line: 6 } }) })
    expect(view.view.getByRole('heading', { name: 'Second' })).toBeTruthy()
    await act(async () => { view.view.getByRole('button', { name: 'Source line 6' }).click() })
    const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    expect(editor.state.doc.lineAt(editor.state.selection.main.head).text).toBe('Target')
  })

  it('leaves produced-file navigation and sidebar layout to their native owners', async () => {
    const { runtime } = await mountSidebar()
    expect(runtime.slots.entries('conversation.chat.turnTail')).toEqual([])
    expect(runtime.slots.entries('conversation.session.header.utilities')).toEqual([])
    expect(runtime.slots.entries('shell.overlay')).toHaveLength(1)
    expect(document.querySelector('.dsh-md-preview-overlay')).toBeNull()
  })

  it('releases styles, dirty guards and the Remote once on unload while native viewing remains available', async () => {
    const { runtime, view, disposePlugin, mountEvents } = await mountSidebar()
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    await act(async () => { view.view.getByRole('button', { name: 'Edit', exact: true }).click() })
    const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!
    await act(async () => { editor.dispatch({ changes: { from: 0, insert: 'discard on forced unload ' } }) })
    await act(async () => { runtime.ctx.sidebarRight.close(runtime.ctx.sidebarRight.active()!.id) })
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    await act(disposePlugin)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.querySelector('[data-plugin-css="md-preview"]')).toBeNull()
    const refresh = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(refresh)
    expect(refresh.defaultPrevented).toBe(false)
    await act(disposePlugin)
    expect(mountEvents).toEqual(['mount', 'unmount'])
    await act(async () => { runtime.ctx.sidebarRight.openResource(sessionFileAddress(SESSION, 'guide.md')) })
    expect(view.view.getByText('Native text fallback')).toBeTruthy()
  })
})
