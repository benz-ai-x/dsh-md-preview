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
import { useEffect, useRef } from 'react'
import { EditorSelection, EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyField, historyKeymap } from '@codemirror/commands'
import { getSearchQuery, RegExpCursor, search, searchKeymap } from '@codemirror/search'
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { LRLanguage, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
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

/**
 * Wrap every selection range in markup markers (#16); an empty selection
 * inserts the empty pair with the cursor between. Returns to the history
 * stack like any edit.
 */
function wrapMarkup(view: EditorView, open: string, close: string): boolean {
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
export function MarkdownEditor({ initialValue, onChange, onSave, onView, onCursorLine, onStatus, searchPhrases, onSearchStatus }: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null)
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
    const view = new EditorView({
      state: EditorState.create({
        doc: initialValue,
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
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
            ...searchKeymap,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) changeRef.current(update.state.doc.toString())
            if (update.docChanged || update.selectionSet) {
              cursorRef.current?.(update.state.doc.lineAt(update.state.selection.main.head).number)
            }
            reportSearch(update.view)
            reportEditStatus(update.view)
          }),
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': { fontFamily: 'inherit' },
          }),
        ],
      }),
      ...(parent === null ? {} : { parent }),
    })
    viewRef.current?.(view)
    cursorRef.current?.(view.state.doc.lineAt(view.state.selection.main.head).number)
    reportSearch(view)
    reportEditStatus(view)
    return () => {
      statusRef.current?.(null)
      editStatusRef.current?.(null)
      viewRef.current?.(null)
      view.destroy()
    }
    // A new edit session (different initial document) mounts a fresh editor;
    // callbacks travel through refs, so this effect otherwise runs once.
  }, [initialValue])

  return <div className="dsh-md-preview-editor" ref={host} />
}
