import { IconCloseOutline16, IconPaperclipOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'

/** The panel relationship shared by the Session Header entry and its close control. */
export const PREVIEW_PANEL_ID = 'dsh-md-preview-panel'

/** Distinct native glyphs for the document entry and close action, with localized next-action labels. */
export function PanelToggle({ open, label, onClick, entry = false }: {
  open: boolean
  label: string
  onClick(): void
  entry?: boolean
}) {
  return (
    <Tooltip label={label} side="bottom" delayMs={500}>
      <button
        type="button"
        className={entry ? 'dsh-md-preview-docsbtn' : 'dsh-md-preview-icon'}
        data-md-preview-toggle={entry || undefined}
        aria-label={label} title={label}
        aria-expanded={entry ? open : undefined}
        aria-controls={open ? PREVIEW_PANEL_ID : undefined}
        onClick={onClick}
      >
        {entry ? <IconPaperclipOutline16 /> : <IconCloseOutline16 />}
      </button>
    </Tooltip>
  )
}
