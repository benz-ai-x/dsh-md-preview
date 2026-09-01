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
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
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

/** Props the panel hands to the editor. */
export interface MarkdownEditorProps {
  /** Document text at edit-session start; a changed value remounts the editor. */
  initialValue: string
  /** Reports every document change (the panel's draft). */
  onChange: (value: string) => void
  /** Cmd/Ctrl-S from the editor's keymap. */
  onSave: () => void
}

/**
 * Render one CodeMirror editor bound to the panel's edit session.
 * @param props - initial document plus change and save callbacks.
 * @returns the editor host element.
 */
export function MarkdownEditor({ initialValue, onChange, onSave }: MarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  // Refs keep the extension closures stable without remounting on callback identity.
  const changeRef = useRef(onChange)
  changeRef.current = onChange
  const saveRef = useRef(onSave)
  saveRef.current = onSave

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
          // Fenced blocks and inline HTML edit as plain text; rendered
          // highlighting stays the preview face's job.
          markdownLanguage,
          keymap.of([
            {
              key: 'Mod-s',
              run: () => { saveRef.current(); return true },
            },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) changeRef.current(update.state.doc.toString())
          }),
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': { fontFamily: 'inherit' },
          }),
        ],
      }),
      ...(parent === null ? {} : { parent }),
    })
    return () => { view.destroy() }
    // A new edit session (different initial document) mounts a fresh editor;
    // callbacks travel through refs, so this effect otherwise runs once.
  }, [initialValue])

  return <div className="dsh-md-preview-editor" ref={host} />
}
