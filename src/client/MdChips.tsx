/**
 * The text-aware produced-files chip row, contributed into the
 * `conversation.chat.turnTail` chain. This entry claims only turns that
 * produced at least one text candidate and then renders the complete row:
 * text candidates request the in-browser preview panel, every other produced
 * file keeps the shipped external-open behavior. Turns without candidates stay
 * entirely with ui-deliverables' row.
 */
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { MdTurnFiles } from './turn-files.ts'
import { basename } from './preview-state.ts'
import { DocumentIcon } from './DocumentIcon.tsx'

/** Panel admission for one conversation session. */
export interface MdChipsInjected {
  /** Request a text preview in this session. */
  openPreview(path: string): void
}

/** Matched paths plus the shipped file opener and the locale seat. */
export type MdChipsProps =
  & Pick<TurnTailOwnerProps, 'openFile'>
  & { matched: MdTurnFiles }
  & PropsLocale<'md-preview'>
  & InjectFace<MdChipsInjected>

/**
 * Render one turn's produced files as chips; text candidates request preview.
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
          <DocumentIcon kind={/\.(?:md|markdown)$/i.test(path) ? 'markdown' : 'text'} />
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
