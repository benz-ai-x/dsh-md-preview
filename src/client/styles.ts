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
.dsh-md-preview-version {
  flex: none;
  margin-left: 4px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  user-select: none;
}
.dsh-md-preview-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
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
  overflow: auto;
  padding: 16px;
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
.dsh-md-preview-editor { flex: 1; min-height: 0; overflow: hidden; }
.dsh-md-preview-editor .cm-editor { height: 100%; }
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
.dsh-md-preview-document { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: auto; }
.dsh-md-preview-document[hidden] { display: none; }
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
