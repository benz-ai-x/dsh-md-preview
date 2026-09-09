/**
 * The markdown editor face of the preview panel: a CodeMirror 6 instance
 * (inlined into the client bundle at build time; not a platform module).
 * The panel owns the draft state; this component only reports document
 * changes and the Cmd/Ctrl-S save intent. The extension set is deliberately
 * curated: `@codemirror/lang-markdown` statically pulls `lang-html` (and
 * with it css/javascript/autocomplete, roughly tripling the bundle), so the
 * GFM parser is assembled directly from `@lezer/markdown` — embedded HTML
 * edits as plain text, which is acceptable inside the editor face.
 */
import { useEffect, useMemo, useRef } from 'react'
import { Compartment, EditorSelection, EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyField, historyKeymap } from '@codemirror/commands'
import { getSearchQuery, RegExpCursor, search, searchKeymap } from '@codemirror/search'
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { HighlightStyle, LRLanguage, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { LRParser } from '@lezer/lr'
import { Emoji, GFM, Subscript, Superscript, parser } from '@lezer/markdown'

/**
 * The GFM grammar, configured the way `@codemirror/lang-markdown` ships it.
 * The cast mirrors that package's own `mkLang`: `@lezer/markdown`'s d.ts
 * declares `MarkdownParser extends Parser` (@lezer/common), while at runtime
 * it stays on the LRParser prototype chain `LRLanguage.define` requires.
 */
const markdownLanguage = LRLanguage.define({
  parser: parser.configure([GFM, Subscript, Superscript, Emoji]) as unknown as LRParser,
})

/** Markdown structure follows the platform palette when the theme changes. */
const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--dsw-alias-label-primary)', fontWeight: '600' },
  { tag: tags.strong, fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--shiki-token-link)', textDecoration: 'underline' },
  { tag: [tags.processingInstruction, tags.meta, tags.punctuation, tags.comment], color: 'var(--dsw-alias-label-secondary)' },
  { tag: tags.monospace, color: 'var(--shiki-token-string-expression)' },
])

/**
 * Wrap every selection range in markup markers (#16); an empty selection
 * inserts the empty pair with the cursor between. Returns to the history
 * stack like any edit.
 */
function wrapMarkup(view: EditorView, open: string, close: string): boolean {
  if (view.state.readOnly) return false
  const changes = view.state.changeByRange(range => ({
    changes: [
      { from: range.from, insert: open },
      { from: range.to, insert: close },
    ],
    range: EditorSelection.range(range.from + open.length, range.to + open.length),
  }))
  view.dispatch(changes)
  return true
}

/** What the find chip shows: total matches and the current one (1-based). */
export interface SearchStatus {
  readonly count: number
  readonly index: number
}

/** What the edit status bar shows (#15), plus history availability. */
export interface EditorStatus {
  readonly line: number
  readonly col: number
  readonly chars: number
  readonly canUndo: boolean
  readonly canRedo: boolean
}

/** Props the panel hands to the editor. */
export interface MarkdownEditorProps {
  /** Document text at edit-session start; a changed value remounts the editor. */
  initialValue: string
  /** In-memory JSON captured when a live tab body unmounts; never persisted. */
  restoreMemento?: () => Record<string, unknown> | undefined
  onMemento?: (state: Record<string, unknown>) => void
  /** Freeze typing while this exact draft is being written. */
  readOnly?: boolean
  /** Reports every document change (the panel's draft). */
  onChange: (value: string) => void
  /** Cmd/Ctrl-S from the editor's keymap. */
  onSave: () => void
  /** Reports the mounted editor view (null on unmount) for panel-side calls. */
  onView?: (view: EditorView | null) => void
  /** Reports the cursor's 1-based line at mount and on doc/selection change. */
  onCursorLine?: (line: number) => void
  /** Status-bar payload at mount and on doc/selection/history change; null on unmount. */
  onStatus?: (status: EditorStatus | null) => void
  /** Opens the panel's keymap help (bound to Mod-/ inside the editor). */
  onOpenKeys?: () => void
  /** Search panel localization: CM stock phrase key → panel word. */
  searchPhrases?: Readonly<Record<string, string>>
  /** Match count and 1-based current index; null while search is inactive. */
  onSearchStatus?: (status: SearchStatus | null) => void
}

/**
 * Render one CodeMirror editor bound to the panel's edit session.
 * @param props - initial document plus change, save, and view callbacks.
 * @returns the editor host element.
 */
export function MarkdownEditor({ initialValue, restoreMemento, onMemento, readOnly = false, onChange, onSave, onView, onCursorLine, onStatus, onOpenKeys, searchPhrases, onSearchStatus }: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const mounted = useRef<EditorView | null>(null)
  const editability = useMemo(() => new Compartment(), [])
  // Refs keep the extension closures stable without remounting on callback identity.
  const changeRef = useRef(onChange)
  changeRef.current = onChange
  const saveRef = useRef(onSave)
  saveRef.current = onSave
  const viewRef = useRef(onView)
  viewRef.current = onView
  const cursorRef = useRef(onCursorLine)
  cursorRef.current = onCursorLine
  const statusRef = useRef(onSearchStatus)
  statusRef.current = onSearchStatus
  const editStatusRef = useRef(onStatus)
  editStatusRef.current = onStatus
  const openKeysRef = useRef(onOpenKeys)
  openKeysRef.current = onOpenKeys
  const mementoRef = useRef(onMemento)
  mementoRef.current = onMemento

  /** Report the status-bar payload: cursor, size, and history availability. */
  const reportEditStatus = (view: EditorView): void => {
    const head = view.state.selection.main.head
    const line = view.state.doc.lineAt(head)
    // historyField's declared type is opaque {}; the runtime shape is
    // { done, undone } branch stacks (probed in #15).
    const historyState = view.state.field(historyField, false) as
      | { done: readonly unknown[]; undone: readonly unknown[] }
      | undefined
    editStatusRef.current?.({
      line: line.number,
      col: head - line.from + 1,
      chars: view.state.doc.toString().replace(/\s/g, '').length,
      canUndo: historyState !== undefined && historyState.done.length > 0,
      canRedo: historyState !== undefined && historyState.undone.length > 0,
    })
  }

  /** Count matches for the live query; null when the panel is inactive. */
  const reportSearch = (view: EditorView): void => {
    const query = getSearchQuery(view.state)
    if (view.dom.querySelector('.cm-search') === null || query.search.length === 0 || !query.valid) {
      statusRef.current?.(null)
      return
    }
    const head = view.state.selection.main.head
    let count = 0
    let index = 0
    // One cursor kind for both query forms: literal queries ship escaped.
    // (SearchCursor's ignoreCase helper argument drops all matches in this
    // build, so case sensitivity rides the regexp flag instead.)
    const pattern = query.regexp
      ? query.search
      : query.search.replace(/[\\[\]{}()*+?.^$|]/g, '\\$&')
    const iterator = new RegExpCursor(view.state.doc, pattern, { ignoreCase: !query.caseSensitive })
    const onMatch = (from: number, to: number): void => {
      if (query.wholeWord) {
        const before = from > 0 ? view.state.doc.sliceString(from - 1, from) : ''
        const after = to < view.state.doc.length ? view.state.doc.sliceString(to, to + 1) : ''
        if ((before !== '' && /\w/.test(before)) || (after !== '' && /\w/.test(after))) return
      }
      count += 1
      if (from <= head) index = count
    }
    while (!(iterator.next().done ?? false)) onMatch(iterator.value.from, iterator.value.to)
    statusRef.current?.({ count, index })
  }

  useEffect(() => {
    const parent = host.current
    const config = {
        doc: initialValue,
        extensions: [
          editability.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
          // CodeMirror stores logical lines; preserve the original separator
          // when serializing a changed document or a tab's edit memento.
          EditorState.lineSeparator.of(initialValue.includes('\r\n') ? '\r\n' : '\n'),
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          syntaxHighlighting(markdownHighlightStyle),
          EditorView.lineWrapping,
          search({ top: true }),
          searchPhrases === undefined ? [] : EditorState.phrases.of(searchPhrases),
          // Fenced blocks and inline HTML edit as plain text; rendered
          // highlighting stays the preview face's job.
          markdownLanguage,
          keymap.of([
            {
              key: 'Mod-s',
              run: () => { saveRef.current(); return true },
            },
            { key: 'Mod-b', run: view => wrapMarkup(view, '**', '**') },
            { key: 'Mod-i', run: view => wrapMarkup(view, '*', '*') },
            { key: 'Mod-k', run: view => wrapMarkup(view, '[', '](url)') },
            // '?' types inside the document; its command form opens the key help.
            { key: 'Mod-/', run: () => { openKeysRef.current?.(); return true } },
            ...searchKeymap,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) changeRef.current(update.state.sliceDoc())
            if (update.docChanged || update.selectionSet) {
              cursorRef.current?.(update.state.doc.lineAt(update.state.selection.main.head).number)
            }
            reportSearch(update.view)
            reportEditStatus(update.view)
          }),
          EditorView.theme({
            '&': { height: '100%', backgroundColor: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)' },
            '.cm-scroller': { fontFamily: 'var(--ds-font-family-code)', fontSize: 'var(--dsh-content-font-size, 14px)', lineHeight: 'calc(24px + var(--dsh-content-font-delta, 0px))', overflow: 'auto' },
            '.cm-content': { caretColor: 'var(--dsw-alias-label-primary)', padding: '8px 0' },
            '.cm-gutters': { backgroundColor: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-secondary)', borderRight: '1px solid var(--dsw-alias-border-l2)' },
            '.cm-lineNumbers .cm-gutterElement': { minWidth: '32px', padding: '0 8px' },
            '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--dsw-alias-label-primary)' },
            '.cm-activeLine': { backgroundColor: 'var(--dsw-alias-interactive-bg-hover)' },
            '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--dsw-alias-interactive-bg-active)' },
            '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent)', outline: '1px solid var(--dsw-alias-state-business-primary)' },
            '.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, var(--dsw-alias-state-business-primary) 28%, transparent)' },
          }),
        ],
    }
    // Read after old-body cleanup, which can happen in this same React commit
    // when a native tab moves between the dock and a floating portal.
    const memento = restoreMemento?.()
    const view = new EditorView({
      state: memento === undefined ? EditorState.create(config) : EditorState.fromJSON(memento, config, { history: historyField }),
      ...(parent === null ? {} : { parent }),
    })
    mounted.current = view
    viewRef.current?.(view)
    cursorRef.current?.(view.state.doc.lineAt(view.state.selection.main.head).number)
    reportSearch(view)
    reportEditStatus(view)
    return () => {
      mementoRef.current?.(view.state.toJSON({ history: historyField }) as Record<string, unknown>)
      statusRef.current?.(null)
      editStatusRef.current?.(null)
      viewRef.current?.(null)
      mounted.current = null
      view.destroy()
    }
    // A new edit session (different initial document) mounts a fresh editor;
    // callbacks travel through refs, so this effect otherwise runs once.
  }, [initialValue])

  useEffect(() => {
    mounted.current?.dispatch({ effects: editability.reconfigure([
      EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly),
    ]) })
  }, [editability, readOnly])

  return <div className="dsh-md-preview-editor" ref={host} />
}
