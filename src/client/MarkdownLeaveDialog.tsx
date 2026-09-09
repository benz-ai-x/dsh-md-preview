/** One platform dialog remains available even when the dirty tab is hidden. */
import { useEffect, useRef } from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { MarkdownLeavePrompt } from './markdown-documents.ts'

export interface MarkdownLeaveDialogInjected {
  usePrompts: SnapshotSelectorHook<readonly MarkdownLeavePrompt[]>
  decide(key: string, allow: boolean): void
}

type Props = PropsRuntime<'shell.overlay'> & PropsLocale<'md-preview'> & InjectFace<MarkdownLeaveDialogInjected>

export function MarkdownLeaveDialog({ usePrompts, decide, t }: Props) {
  const prompt = usePrompts(snapshot => snapshot[0])
  const keep = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (prompt === undefined) return
    const previous = document.activeElement
    keep.current?.focus()
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus() }
  }, [prompt?.key])
  if (prompt === undefined) return null
  return <Modal open title={t('panel.unsaved.title')} closeLabel={t('panel.unsaved.keep')}
    description={prompt.path} onClose={() => decide(prompt.key, false)}
    footer={<>
      <button type="button" onClick={() => decide(prompt.key, true)}>{t('panel.unsaved.discard')}</button>
      <button type="button" ref={keep} onClick={() => decide(prompt.key, false)}>{t('panel.unsaved.keep')}</button>
    </>} />
}
