/** Source-safe Remote lifecycle and official right-sidebar registrations. */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { WorkspaceFileParams } from '@deepseek-ai/dsh-api-workspace-files/client'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { fileAddressFor, parseFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import { MarkdownTab } from './MarkdownTab.tsx'
import { MarkdownLeaveDialog } from './MarkdownLeaveDialog.tsx'
import { PreviewAction } from './PreviewAction.tsx'
import { createMarkdownDocuments } from './markdown-documents.ts'
import { createDiagramRenderer } from './diagrams.ts'
import { isDirty } from './preview-session.ts'
import { en, NS, zh } from './locale.ts'
import { installStyles } from './styles.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'md-preview': import('./locale.ts').MdPreviewKey
  }
}
declare module '@deepseek-ai/dsh-client-ui-sidebar-right/client' {
  interface SidebarRightResourceParamsMap {
    file: WorkspaceFileParams
  }
}

/** The document owner consumes only public platform services. */
export const inject = ['remote', 'slots', 'locale', 'sidebarRightTabs', 'sidebarRight']

function registerUi(ctx: ClientContext): void {
  if (typeof ctx.sidebarRight.beforeClose !== 'function') {
    throw new Error('Markdown editing requires sidebarRight.beforeClose; use the Harness revision in dsh-reference.lock.json.')
  }
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'md-preview: dictionaries')
  ctx.effect(installStyles, 'md-preview: styles')
  const documents = createMarkdownDocuments(
    (sessionId, path, signal) => ctx.remote.mdPreview.read(sessionId, path, signal),
    (sessionId, path, content, fingerprint, force, signal) => ctx.remote.mdPreview.write(sessionId, path, content, fingerprint, force, signal),
    (sessionId, tabId, guard) => ctx.sidebarRight.beforeClose(sessionId, tabId, guard),
  )
  ctx.effect(() => () => documents.dispose(), 'md-preview: document lifetimes')
  const diagrams = createDiagramRenderer()
  ctx.effect(() => () => diagrams.dispose(), 'md-preview: diagram lifetimes')
  ctx.effect(() => {
    const warn = (event: BeforeUnloadEvent): void => {
      if (!Object.values(documents.snapshot.getSnapshot()).some(state => isDirty(state) || state.saving)) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, 'md-preview: browser leave warning')

  const markdownId = '@benz-ai-x/dsh-md-preview'
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: markdownId, kind: 'md-preview', patterns: ['dsh-resource://file/**'],
    canOpen: address => /\.(md|markdown)$/i.test(parseFileAddress(address)?.path ?? ''),
    title: address => parseFileAddress(address)?.path.split('/').at(-1) ?? address,
  }), 'md-preview: Markdown type')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab', key: markdownId, locale: NS,
    inject: () => ({
      hooks: { documents: documents.snapshot }, attach: documents.attach,
      enterEdit: documents.enterEdit, edit: documents.edit, save: documents.save,
      rememberEditor: documents.rememberEditor, restoreEditor: documents.restoreEditor,
      leave: documents.leave, takeNavigation: documents.takeNavigation,
      renderDiagrams: diagrams.render,
      openNativeText: (address: string) => ctx.sidebarRight.openResource(address, { kind: 'text' }),
    }),
  }, MarkdownTab)), 'md-preview: Markdown body')
  // Only the unsaved confirmation lives at root; document layout stays native.
  ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'md-preview-unsaved', locale: NS,
    inject: () => ({ hooks: { prompts: documents.prompts }, decide: documents.decide }),
  }, MarkdownLeaveDialog)), 'md-preview: unsaved confirmation')
  ctx.effect(() => ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
    name: 'conversation.chat.assistant-actions', id: 'md-preview', order: 50, locale: NS,
    inject: (sessionId: SessionId) => ({
      openPreview: (path: string, cwd?: string) => ctx.sidebarRight.openResource(fileAddressFor(sessionId, cwd, path)),
    }),
  }, PreviewAction)), 'md-preview: conversation action')
}

/** Mount the Remote first; rollback or unload releases both halves. */
export async function mountMdPreview(ctx: ClientContext, contribution: TypertRemoteContribution): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(contribution)
  const ui = ctx.inject(['remote.mdPreview', 'slots', 'locale', 'sidebarRightTabs', 'sidebarRight'], registerUi)
  try {
    await ui
  } catch (error) {
    try { await ui.dispose() } finally { await disposeRemote() }
    throw error
  }
  let disposal: Promise<void> | undefined
  return () => disposal ??= (async () => {
    try { await ui.dispose() } finally { await disposeRemote() }
  })()
}
