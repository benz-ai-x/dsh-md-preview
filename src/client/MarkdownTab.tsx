/** Markdown body hosted by an official right-sidebar tab. */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { undo, redo } from '@codemirror/commands'
import { openSearchPanel } from '@codemirror/search'
import type { InjectFace, PropsLocale, PropsRuntime, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import { Button, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { parseFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { documentKey } from './markdown-documents.ts'
import type { MarkdownDocuments, createMarkdownDocuments } from './markdown-documents.ts'
import { MarkdownEditor } from './editor.tsx'
import type { EditorStatus } from './editor.tsx'
import { canSave, isDirty } from './preview-session.ts'
import type { createDiagramRenderer } from './diagrams.ts'
import { activeIndexForLine, extractOutline, findHeadingElement } from './outline.ts'

export interface MarkdownTabInjected {
  useDocuments: SnapshotSelectorHook<MarkdownDocuments>
  attach: ReturnType<typeof createMarkdownDocuments>['attach']
  enterEdit: ReturnType<typeof createMarkdownDocuments>['enterEdit']
  edit: ReturnType<typeof createMarkdownDocuments>['edit']
  save: ReturnType<typeof createMarkdownDocuments>['save']
  rememberEditor: ReturnType<typeof createMarkdownDocuments>['rememberEditor']
  restoreEditor: ReturnType<typeof createMarkdownDocuments>['restoreEditor']
  renderDiagrams: ReturnType<typeof createDiagramRenderer>['render']
  leave: ReturnType<typeof createMarkdownDocuments>['leave']
  takeNavigation: ReturnType<typeof createMarkdownDocuments>['takeNavigation']
  openNativeText(address: string): void
}

export type MarkdownTabProps = PropsRuntime<'sidebar.right.pane.tab'>
  & PropsLocale<'md-preview'> & InjectFace<MarkdownTabInjected>

function selectSourceLine(view: EditorView, line: number): void {
  view.dispatch({ selection: { anchor: view.state.doc.line(Math.min(line, view.state.doc.lines)).from }, scrollIntoView: true })
}

export function MarkdownTab({ useTabInfo, useResource, sessionId, useDocuments, attach, enterEdit, edit, save, rememberEditor, restoreEditor, renderDiagrams, leave, takeNavigation, openNativeText, t }: MarkdownTabProps) {
  const { tab } = useTabInfo()
  const metadata = useResource<'file'>(tab.contentId)
  const key = documentKey(sessionId, tab.id)
  const state = useDocuments(snapshot => snapshot[key])
  const editor = useRef<EditorView | null>(null)
  const requestedSourceLine = useRef<number | undefined>(undefined)
  const rendered = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<EditorStatus | null>(null)
  useEffect(() => {
    if (state?.focusRevision) editor.current?.focus()
  }, [state?.focusRevision])
  const searchPhrases = useMemo(() => ({
    Find: t('find.phrases.find'), Replace: t('find.phrases.replace'),
    next: t('find.phrases.next'), previous: t('find.phrases.previous'), all: t('find.phrases.all'),
    'match case': t('find.phrases.matchCase'), regexp: t('find.phrases.regexp'),
    'by word': t('find.phrases.byWord'), 'replace all': t('find.phrases.replaceAll'), close: t('find.phrases.close'),
  }), [t])
  const labels = useMemo(() => ({ code: { copyLabel: t('copy'), copiedLabel: t('copied') }, footnotes: t('footnotes') }), [t])
  useEffect(() => {
    const target = parseFileAddress(tab.contentId)
    if (target === undefined) return
    attach(sessionId, tab.id, target.scope === 'session' ? target.sessionId as SessionId : sessionId, target.path, tab.signal)
  }, [tab.contentId, tab.id, tab.signal, sessionId, attach])
  const line = tab.navigation.params !== undefined && 'line' in tab.navigation.params ? tab.navigation.params.line : undefined
  useEffect(() => {
    if (state?.content.state !== 'ready'
      || typeof line !== 'number' || !Number.isInteger(line) || line < 1) return
    if (!takeNavigation(key, tab.navigation.revision, state.face)) return
    if (state.face === 'edit' && editor.current !== null) {
      selectSourceLine(editor.current, line)
    } else {
      // Rendered Markdown has no one-to-one source-line layout. Reveal its
      // enclosing section; the source-line action gives an exact editor jump.
      const headings = extractOutline(state.content.file.content)
      findHeadingElement(rendered.current, headings, activeIndexForLine(headings, line))?.scrollIntoView?.({ block: 'start' })
    }
  }, [key, state?.content, state?.face, tab.navigation.revision, line, takeNavigation])
  useEffect(() => {
    if (state?.content.state !== 'ready' || state.face !== 'view' || rendered.current === null) return
    const controller = new AbortController()
    const abort = () => controller.abort()
    tab.signal.addEventListener('abort', abort, { once: true })
    renderDiagrams(rendered.current, state.content.file.content, { error: t('diagram.error') }, controller.signal)
    return () => { controller.abort(); tab.signal.removeEventListener('abort', abort) }
  }, [state?.content, state?.face, tab.signal, t, renderDiagrams])
  return <section className="dsh-md-tab" data-plugin-version={process.env.MD_PREVIEW_VERSION}>
    <div className="dsh-md-tab-toolbar">
      <span title={parseFileAddress(tab.contentId)?.path}>{parseFileAddress(tab.contentId)?.path}</span>
      {state?.content.state === 'ready' && typeof line === 'number' && Number.isInteger(line) && line > 0
        && <Button size="sm" disabled={state.saving} onClick={() => {
          if (editor.current !== null) {
            selectSourceLine(editor.current, line)
            editor.current.focus()
          } else {
            requestedSourceLine.current = line
            enterEdit(key)
          }
        }}>{t('panel.sourceLine', { line })}</Button>}
      <Button size="sm" disabled={state?.saving || state?.content.state === 'loading'} onClick={() => leave(key, { kind: 'reload', reloadMetadata: metadata.reload })}>{t('panel.conflict.reload')}</Button>
      {state?.content.state === 'ready' && (state.face === 'view'
        ? <Button size="sm" onClick={() => enterEdit(key)}>{t('panel.edit')}</Button>
        : <>
          <Button size="sm" disabled={state.saving} onClick={() => leave(key, { kind: 'switchFace' })}>{t('panel.view')}</Button>
          <Button size="sm" onClick={() => { if (editor.current) openSearchPanel(editor.current) }}>{t('panel.find')}</Button>
          <Button size="sm" disabled={!status?.canUndo || state.saving} onClick={() => { if (editor.current) undo(editor.current) }}>{t('panel.undo')}</Button>
          <Button size="sm" disabled={!status?.canRedo || state.saving} onClick={() => { if (editor.current) redo(editor.current) }}>{t('panel.redo')}</Button>
          <Button size="sm" disabled={!canSave(state)} onClick={() => save(key, false)}>{t('panel.save')}</Button>
        </>)}
    </div>
    {state?.content.state === 'ready' && !state.saving && !state.savedPendingRead
      && metadata.value !== undefined && metadata.value.version !== state.content.file.fingerprint
      && <p role="status" className="dsh-md-tab-notice">{t('panel.conflict.title')}</p>}
    {state?.conflicted && <div role="alert" className="dsh-md-tab-notice">
      <strong>{t('panel.conflict.title')}</strong>
      <p>{t('panel.conflict.hint')}</p>
      <Button size="sm" disabled={state.saving} onClick={() => save(key, true)}>{t('panel.conflict.force')}</Button>
    </div>}
    {state?.saving && <p role="status">{t('status.saving')}</p>}
    {state?.toast && state.face === 'view' && state.content.state === 'ready' && <p role="status">{t('status.saved')}</p>}
    {state?.saveError && <p role="alert">{t('panel.saveError')} · {state.saveError.code} — {state.saveError.message}</p>}
    {state?.savedPendingRead && state.content.state === 'failed' && <p role="alert">{t('panel.saved.readFailed')}</p>}
    {state?.content.state === 'failed' && state.content.code === 'md-preview/too-large' && <div className="dsh-md-tab-notice">
      <p>{t('panel.readOnly.limit')}</p>
      <Button size="sm" onClick={() => openNativeText(tab.contentId)}>{t('panel.nativeText')}</Button>
    </div>}
    {state !== undefined && isDirty(state) && <span>{t('status.unsaved')}</span>}
    {state?.content.state === 'ready'
      ? state.face === 'edit'
        ? <MarkdownEditor initialValue={state.content.file.content} restoreMemento={() => restoreEditor(key)}
            readOnly={state.saving}
            searchPhrases={searchPhrases}
            onMemento={value => rememberEditor(key, value)} onView={value => {
              editor.current = value
              if (value !== null && requestedSourceLine.current !== undefined) {
                const requested = requestedSourceLine.current
                requestedSourceLine.current = undefined
                selectSourceLine(value, requested)
                value.focus()
              }
            }} onStatus={setStatus}
            onChange={draft => edit(key, draft)} onSave={() => save(key, false)} />
        : <div className="dsh-md-tab-document" ref={rendered}><MarkdownText text={state.content.file.content} labels={labels} /></div>
      : <p role="status">{state?.content.state === 'failed' ? `${t('panel.error')} · ${state.content.code}` : t('panel.loading')}</p>}
  </section>
}
