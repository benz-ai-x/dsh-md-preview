/** Styles scoped to document content and the optional conversation action. */
const CSS = `
.dsh-md-tab {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
}
.dsh-md-tab-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}
.dsh-md-tab-toolbar > span:first-child {
  flex: 1 1 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}
.dsh-md-tab-document {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  padding: 16px;
  overflow-wrap: anywhere;
}
.dsh-md-tab-document img { max-width: 100%; }
.dsh-md-tab [hidden] { display: none !important; }
.dsh-md-tab .dsh-md-preview-editor { flex: 1 1 auto; min-height: 0; overflow: hidden; }
.dsh-md-tab > [role="status"], .dsh-md-tab > [role="alert"], .dsh-md-tab-notice {
  flex: 0 0 auto;
  margin: 0;
  padding: 10px 12px;
  font-size: 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}
.dsh-md-tab-notice { background: var(--dsw-alias-bg-layer-1); }
.dsh-md-tab-notice p { margin: 6px 0; }
.dsh-md-tab > [role="alert"] { color: var(--dsw-alias-label-primary); }
.dsh-md-preview-diagram { overflow: auto; padding: 12px; }
.dsh-md-preview-diagram > svg { display: block; max-width: 100%; height: auto; margin: auto; }
.dsh-md-preview-diagram-error { padding: 8px 12px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.dsh-md-preview-anchor { position: relative; display: inline-flex; }
.dsh-md-preview-list {
  position: absolute;
  inset-block-end: 100%;
  inset-inline-end: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  min-width: 180px;
  max-width: min(320px, 90vw);
  max-height: 260px;
  overflow: auto;
  padding: 4px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
}
.dsh-md-preview-list > button { justify-content: start; overflow-wrap: anywhere; }
`

/** Each plugin mount owns its stylesheet and releases it on rollback or unload. */
export function installStyles(): () => void {
  const element = document.createElement('style')
  element.setAttribute('data-plugin-css', 'md-preview')
  element.textContent = CSS
  document.head.append(element)
  return () => element.remove()
}
