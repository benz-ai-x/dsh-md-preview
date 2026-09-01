/**
 * The markdown-aware produced-files chip row, contributed into the
 * `conversation.chat.turnTail` chain. This entry claims only turns that
 * produced at least one markdown document and then renders the complete row:
 * markdown chips open the in-browser preview panel, every other produced
 * file keeps the shipped external-open behavior. Turns without markdown stay
 * entirely with ui-deliverables' row.
 */
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { MdTurnFiles } from './turn-files.ts'
import { basename } from './preview-state.ts'

/** Panel admission for one conversation session. */
export interface MdChipsInjected {
  /** Open the preview panel for a markdown document of this session. */
  openPreview(path: string): void
}

/** Matched paths plus the shipped file opener and the locale seat. */
export type MdChipsProps =
  & Pick<TurnTailOwnerProps, 'openFile'>
  & { matched: MdTurnFiles }
  & PropsLocale<'md-preview'>
  & InjectFace<MdChipsInjected>

/**
 * Render one turn's produced files as chips; markdown opens the preview.
 * @param props - selector-matched paths, the chat view's file opener, preview
 * admission, and the locale seat.
 * @returns the produced-files chip row.
 */
export function MdChips({ matched, openFile, openPreview, t }: MdChipsProps) {
  if (matched.previewable.length === 0 && matched.other.length === 0) return null
  return (
    <div className="dsh-md-preview-row">
      {matched.previewable.map((path) => (
        <button
          key={path} type="button" className="dsh-md-preview-chip"
          title={t('chip.preview', { name: path })}
          onClick={() => { openPreview(path) }}
        >
          <span aria-hidden>📄</span>
          <span className="dsh-md-preview-chip-label">{basename(path)}</span>
        </button>
      ))}
      {matched.other.map((path) => (
        <button
          key={path} type="button" className="dsh-md-preview-chip"
          title={t('chip.open', { name: path })}
          onClick={() => {
            // The owner face settles open failures itself; the shipped row
            // calls it the same fire-and-forget way.
            openFile(path)
          }}
        >
          <span className="dsh-md-preview-chip-label">{basename(path)}</span>
        </button>
      ))}
    </div>
  )
}
