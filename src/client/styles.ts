/**
 * Panel and chip styles. The DSH client shell claims `<style>` tags a plugin
 * injects during materialization (tagged with data-plugin), so a plain
 * one-time injection is lifecycle-correct without a CSS-modules pipeline.
 * Colors ride the shared dsw alias tokens so light/dark themes both hold.
 */

const CSS = `
.dsh-md-preview-dock {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
}
.dsh-md-preview-panel {
  position: relative;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 280px;
  border-left: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
}
.dsh-md-preview-handle {
  position: absolute;
  left: -4px;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: col-resize;
  touch-action: none;
  z-index: 1;
}
.dsh-md-preview-handle::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: transparent;
}
.dsh-md-preview-handle:hover::after,
.dsh-md-preview-handle[data-dragging]::after {
  background: var(--dsw-alias-border-l3, var(--dsw-alias-border-l2));
}
.dsh-md-preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 12px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}
.dsh-md-preview-dirty {
  flex: none;
  margin-left: 2px;
  font-size: 13px;
  line-height: 1;
  color: var(--dsw-alias-accent, var(--dsw-alias-label-primary));
  user-select: none;
}
.dsh-md-preview-editcta {
  border: 1px solid var(--dsw-alias-accent, var(--dsw-alias-border-l2));
  background: var(--dsw-alias-fill-secondary);
}
.dsh-md-preview-seg {
  display: flex;
  flex: none;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  overflow: hidden;
}
.dsh-md-preview-seg button {
  padding: 3px 14px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-base);
  border: none;
  cursor: pointer;
}
.dsh-md-preview-seg button + button { border-left: 1px solid var(--dsw-alias-border-l2); }
.dsh-md-preview-seg button[aria-pressed="true"] {
  background: var(--dsw-alias-accent, var(--dsw-alias-label-primary));
  color: #fff;
  font-weight: 500;
}
.dsh-md-preview-crumbs {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  overflow: hidden;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
}
.dsh-md-preview-crumb { flex: none; }
.dsh-md-preview-crumb + .dsh-md-preview-crumb::before {
  content: '/';
  margin: 0 4px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}
.dsh-md-preview-crumb:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}
.dsh-md-preview-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dsh-md-preview-icon:hover { background: var(--dsw-alias-fill-secondary); }
.dsh-md-preview-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
}
.dsh-md-preview-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
}
.dsh-md-preview-error {
  color: var(--dsw-alias-label-danger, var(--dsw-alias-label-primary));
  font-size: 13px;
}
.dsh-md-preview-retry {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  padding: 2px 10px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  cursor: pointer;
}
.dsh-md-preview-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.dsh-md-preview-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 240px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  padding: 2px 8px;
  background: var(--dsw-alias-fill-secondary);
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}
.dsh-md-preview-chip:hover { border-color: var(--dsw-alias-border-l3, var(--dsw-alias-border-l2)); }
.dsh-md-preview-chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-md-preview-doc {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  border-radius: 6px;
  padding: 4px 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  cursor: pointer;
}
.dsh-md-preview-doc:hover { background: var(--dsw-alias-fill-secondary); }
.dsh-md-preview-list {
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-width: 200px;
  margin-top: 4px;
  padding: 4px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-float, var(--dsw-alias-bg-base));
  box-shadow: 0 4px 16px rgb(0 0 0 / 12%);
}
.dsh-md-preview-list button {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: none;
  border-radius: 6px;
  padding: 6px 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.dsh-md-preview-list button:hover { background: var(--dsw-alias-fill-secondary); }
.dsh-md-preview-anchor { position: relative; }
.dsh-md-preview-outline {
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 2;
  display: flex;
  flex-direction: column;
  min-width: 220px;
  max-width: 320px;
  max-height: 50vh;
  overflow: auto;
  margin-top: 4px;
  padding: 4px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-float, var(--dsw-alias-bg-base));
  box-shadow: 0 4px 16px rgb(0 0 0 / 12%);
}
.dsh-md-preview-outline button {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: none;
  border-radius: 6px;
  padding: 5px 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.dsh-md-preview-outline button:hover { background: var(--dsw-alias-fill-secondary); }
.dsh-md-preview-outline-active {
  background: var(--dsw-alias-fill-secondary);
  font-weight: 500;
}
.dsh-md-preview-diagram {
  margin: 8px 0;
  padding: 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-base);
  overflow: auto;
  text-align: center;
}
.dsh-md-preview-diagram svg { max-width: 100%; height: auto; }
.dsh-md-preview-diagram-error {
  padding: 2px 0 6px;
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}
.dsh-md-preview-editor { flex: 1; min-height: 0; overflow: hidden; }
.dsh-md-preview-keypop {
  position: absolute;
  top: 42px;
  right: 10px;
  z-index: 3;
  min-width: 210px;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-float, var(--dsw-alias-bg-base));
  box-shadow: 0 4px 16px rgb(0 0 0 / 12%);
  font-size: 12px;
}
.dsh-md-preview-keypop dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; }
.dsh-md-preview-keypop dt { font-size: 11px; font-family: ui-monospace, Menlo, Consolas, monospace; color: var(--dsw-alias-accent, var(--dsw-alias-label-primary)); white-space: nowrap; }
.dsh-md-preview-keypop dd { margin: 0; color: var(--dsw-alias-label-secondary); }
.dsh-md-preview-warnbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-float, var(--dsw-alias-fill-secondary));
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}
.dsh-md-preview-warnbar button {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  cursor: pointer;
  padding: 0 4px;
}
.dsh-md-preview-warnbar button:hover { color: var(--dsw-alias-label-primary); }
.dsh-md-preview-statusbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 4px 12px;
  border-top: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
  user-select: none;
}
.dsh-md-preview-editor .cm-editor { height: 100%; }
.dsh-md-preview-findcount {
  flex: none;
  margin: 0 2px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
  user-select: none;
}
.dsh-md-preview-editor .cm-panel.cm-search {
  background: var(--dsw-alias-bg-base);
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  padding: 4px 6px;
  font-size: 12px;
}
.dsh-md-preview-editor .cm-panel.cm-search input,
.dsh-md-preview-editor .cm-panel.cm-search button {
  font-size: 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 4px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  padding: 2px 4px;
}
.dsh-md-preview-editor .cm-panel.cm-search button:hover { background: var(--dsw-alias-fill-secondary); }
.dsh-md-preview-editor .cm-scroller { overflow: auto; }
.dsh-md-preview-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, var(--dsw-alias-border-l1));
  background: var(--dsw-alias-fill-tertiary, var(--dsw-alias-fill-secondary));
  font-size: 12px;
  color: var(--dsw-alias-label-primary);
}
.dsh-md-preview-bar button {
  border: 1px solid var(--dsw-alias-border-l2, var(--dsw-alias-border-l1));
  border-radius: 6px;
  padding: 3px 10px;
  background: var(--dsw-alias-fill-primary);
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  cursor: pointer;
}
.dsh-md-preview-bar button:hover { background: var(--dsw-alias-fill-secondary); }
.dsh-md-preview-bar button:disabled { opacity: 0.5; cursor: default; }
.dsh-md-preview-browser { flex: 1; min-height: 0; overflow: auto; }
.dsh-md-preview-browser[data-open] {
  flex: none;
  width: 148px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
}
.dsh-md-preview-railtabs { display: flex; flex: none; border-bottom: 1px solid var(--dsw-alias-border-l2); }
.dsh-md-preview-railtabs button {
  flex: 1;
  padding: 6px 0 5px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}
.dsh-md-preview-railtabs button[aria-selected="true"] {
  color: var(--dsw-alias-accent, var(--dsw-alias-label-primary));
  border-bottom-color: var(--dsw-alias-accent, var(--dsw-alias-label-primary));
  font-weight: 500;
}
.dsh-md-preview-railfiles, .dsh-md-preview-railoutline {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}
.dsh-md-preview-railfiles[hidden], .dsh-md-preview-railoutline[hidden] { display: none; }
.dsh-md-preview-railoutline button {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: none;
  border-left: 2px solid transparent;
  border-radius: 0 6px 6px 0;
  padding: 5px 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.dsh-md-preview-railoutline button:hover { background: var(--dsw-alias-fill-secondary); }
.dsh-md-preview-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px 0;
}
.dsh-md-preview-refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dsh-md-preview-refresh:hover { background: var(--dsw-alias-fill-secondary); color: var(--dsw-alias-label-primary); }
.dsh-md-preview-document { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: auto; padding: 16px; }
.dsh-md-preview-document[hidden] { display: none; }
.dsh-md-preview-treefilter {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
}
.dsh-md-preview-treename mark {
  background: none;
  color: var(--dsw-alias-accent, var(--dsw-alias-label-primary));
  font-weight: 600;
}
.dsh-md-preview-tree, .dsh-md-preview-treegroup {
  list-style: none;
  margin: 0;
  padding: 2px 0;
}
.dsh-md-preview-treegroup { padding-left: 20px; }
.dsh-md-preview-treerow {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 8px 0 2px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--dsw-alias-label-primary);
  cursor: default;
}
.dsh-md-preview-treeleaf .dsh-md-preview-treerow { cursor: pointer; }
.dsh-md-preview-treerow:hover { background: var(--dsw-alias-fill-secondary); }
.dsh-md-preview-treeitem[data-current] > .dsh-md-preview-treerow {
  background: var(--dsw-alias-fill-tertiary, var(--dsw-alias-fill-secondary));
  font-weight: 500;
}
.dsh-md-preview-treeitem[aria-selected="true"]:not([data-current]) > .dsh-md-preview-treerow {
  background: var(--dsw-alias-fill-secondary);
}
.dsh-md-preview-treeexpander {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dsh-md-preview-treeitem[aria-expanded="true"] > .dsh-md-preview-treerow .dsh-md-preview-treeexpander svg {
  transform: rotate(90deg);
}
.dsh-md-preview-treespacer { width: 16px; flex: none; }
.dsh-md-preview-tree-icon { flex: none; color: var(--dsw-alias-label-secondary); }
.dsh-md-preview-treeitem[data-kind="markdown"] .dsh-md-preview-tree-icon { color: var(--dsw-alias-label-primary); }
.dsh-md-preview-treename {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-md-preview-treehint {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding-left: 23px;
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}
.dsh-md-preview-treeretry {
  border: 1px solid var(--dsw-alias-border-l2, var(--dsw-alias-border-l1));
  border-radius: 4px;
  padding: 1px 8px;
  background: transparent;
  font-size: 11px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
}
.dsh-md-preview-plaintext {
  margin: 0;
  padding: 12px;
  font-family: var(--dsw-alias-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--dsw-alias-label-primary);
}
.dsh-md-preview-toast {
  position: absolute;
  top: 44px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  border-radius: 999px;
  padding: 4px 14px;
  background: var(--dsw-alias-fill-inverted, #2f2f2f);
  color: var(--dsw-alias-label-inverted, #f5f5f5);
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
}
`

let injected = false

/** Inject the plugin stylesheet once per browser document. */
export function ensureStyles(): void {
  if (injected || typeof document === 'undefined') return
  const element = document.createElement('style')
  element.setAttribute('data-plugin-css', 'md-preview')
  element.textContent = CSS
  document.head.append(element)
  injected = true
}
