/**
 * Panel and chip styles. The DSH client shell claims `<style>` tags a plugin
 * injects during materialization (tagged with data-plugin), so a plain
 * one-time injection is lifecycle-correct without a CSS-modules pipeline.
 * Colors ride the shared dsw alias tokens so light/dark themes both hold.
 */

const CSS = `
.dsh-md-preview-overlay {
  box-sizing: border-box;
  font: 14px/20px var(--dsw-font-family);
  color: var(--dsw-alias-label-primary);
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--dsw-alias-bg-base);
  /* A shared panel shadow and one edge preserve the theme's layer boundary. */
  border-left: 1px solid var(--dsw-alias-border-l3);
  box-shadow: var(--dsw-elevation-panel);
  /* The host overlay layer is pointer-events: none; the panel re-arms itself. */
  pointer-events: auto;
}
/* Keep form controls on the shared font while allowing component metrics below. */
.dsh-md-preview-overlay :is(button, input) { font-family: inherit; }
.dsh-md-preview-overlay button:disabled { opacity: 0.4; cursor: default; }
.dsh-md-preview-overlay[data-docked] { box-shadow: none; }
.dsh-md-preview-overlay [hidden] { display: none !important; }
.dsh-md-preview-edgehandle {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -4px;
  width: 8px;
  cursor: col-resize;
  touch-action: none;
  z-index: 2;
}
.dsh-md-preview-edgehandle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 32px;
  border-radius: 10px;
  box-sizing: border-box;
  background: var(--dsw-alias-button-floating-fill);
  border: 0.5px solid var(--dsw-alias-border-l2-darkmode-thin);
  opacity: 0;
  transition: opacity var(--ds-transition-duration-slow, 0.2s) ease-in-out;
}
.dsh-md-preview-overlay:hover .dsh-md-preview-edgehandle::after,
.dsh-md-preview-edgehandle:hover::after {
  opacity: 1;
}
.dsh-md-preview-overlay[data-maximized] {
  left: 0;
  width: auto;
}
.dsh-md-preview-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--dsw-alias-bg-base);
}
/* The header is one row (#22): the document identity shrinks (flex 1,
 * min-width 0, the last crumb ellipsizes), the face control and edit tools
 * group after it, and maximize/close hold the last two seats. Nothing
 * wraps and nothing overflows horizontally; the low-frequency tools fold
 * into the ⋯ menu below the compact width instead. */
.dsh-md-preview-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
  min-width: 0;
  min-height: 72px;
  box-sizing: border-box;
  padding: 6px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-specific-sidebar-fill);
}
/* Visible focus for every interactive control this plugin renders (#22):
 * header icons, segmented control, rail tabs, tree rows and filter, bars
 * and popovers, chips, the docs capsule — one accent-token ring, so light
 * and dark both hold. */
.dsh-md-preview-overlay :is(button, input, [role="treeitem"], [role="option"], [tabindex="0"]):focus-visible,
.dsh-md-preview-docsbtn:focus-visible,
.dsh-md-preview-doc:focus-visible,
.dsh-md-preview-chip:focus-visible,
.dsh-md-preview-list button:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, var(--dsw-alias-label-primary));
  outline-offset: 1px;
}
/* The compact ⋯ menu (#22): same floating-panel language as the outline
 * popover, right-aligned under the button. */
.dsh-md-preview-more {
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 2;
  display: flex;
  flex-direction: column;
  padding: 4px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base));
  box-shadow: var(--dsw-elevation-panel);
}
.dsh-md-preview-docsbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-family: var(--dsw-font-family);
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
}
.dsh-md-preview-docsbtn:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-md-preview-docsbtn[aria-expanded='true'] {
  background: var(--dsw-alias-interactive-bg-active);
}
.dsh-md-preview-docsbtn span,
.dsh-md-preview-docsbtn svg {
  flex: none;
}
.dsh-md-preview-dirty {
  flex: none;
  margin-left: 2px;
  font-size: 13px;
  line-height: 1;
  color: var(--dsw-alias-state-business-primary, var(--dsw-alias-label-primary));
  user-select: none;
}
.dsh-md-preview-editcta {
  border: 1px solid var(--dsw-alias-state-business-primary, var(--dsw-alias-border-l2));
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-md-preview-seg {
  display: flex;
  align-items: stretch;
  flex: none;
  height: 30px;
  margin-inline: 4px;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  overflow: hidden;
}
.dsh-md-preview-seg button {
  padding: 0 10px;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-base);
  border: none;
  cursor: pointer;
}
.dsh-md-preview-seg button + button { border-left: 1px solid var(--dsw-alias-border-l2); }
.dsh-md-preview-seg button:focus-visible { outline-offset: -3px; }
.dsh-md-preview-seg button[aria-pressed="true"] {
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-foreground);
  font-weight: 500;
}
.dsh-md-preview-identity { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
.dsh-md-preview-identity > svg { flex: none; color: var(--dsw-alias-label-secondary); }
.dsh-md-preview-paneltools { display: flex; align-items: center; gap: 4px; flex: none; margin-left: 4px; }
.dsh-md-preview-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
}
.dsh-md-preview-titleicon {
  flex: none;
  color: var(--dsw-alias-label-secondary);
}
.dsh-md-preview-crumbs {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  font-size: 14px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
}
.dsh-md-preview-crumb {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 35%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dsh-md-preview-crumb + .dsh-md-preview-crumb::before {
  content: '/';
  margin: 0 4px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-md-preview-crumb:last-child {
  flex: 1;
  min-width: 0;
  max-width: none;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}
.dsh-md-preview-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dsh-md-preview-icon > svg { width: 16px; height: 16px; flex: none; }
.dsh-md-preview-icon:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-md-preview-body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: row;
}
.dsh-md-preview-state {
  line-height: 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
}
.dsh-md-preview-error {
  color: var(--dsw-alias-state-error-primary, var(--dsw-alias-label-primary));
  font-size: 13px;
}
.dsh-md-preview-retry {
  min-height: 28px;
  line-height: 20px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  padding: 2px 10px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
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
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
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
  font-size: 13px;
  cursor: pointer;
}
.dsh-md-preview-doc:hover { background: var(--dsw-alias-interactive-bg-hover); }
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
  background: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base));
  box-shadow: var(--dsw-elevation-panel);
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
  font-size: 14px;
  line-height: 20px;
  min-height: 32px;
  flex: none;
  box-sizing: border-box;
  text-align: left;
  cursor: pointer;
}
.dsh-md-preview-list button:hover { background: var(--dsw-alias-interactive-bg-hover); }
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
  background: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base));
  box-shadow: var(--dsw-elevation-panel);
}
.dsh-md-preview-header > .dsh-md-preview-outlineanchor { position: static; }
.dsh-md-preview-header .dsh-md-preview-outline { right: 8px; max-width: calc(100% - 16px); box-sizing: border-box; }
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
  font-size: 14px;
  line-height: 20px;
  min-height: 32px;
  flex: none;
  box-sizing: border-box;
  text-align: left;
  cursor: pointer;
}
.dsh-md-preview-outline button:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-md-preview-outline-active {
  background: var(--dsw-alias-interactive-bg-hover);
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
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
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
  background: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base));
  box-shadow: var(--dsw-elevation-panel);
  font-size: 13px;
}
.dsh-md-preview-keypop dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; }
.dsh-md-preview-keypop dt { font-size: 12px; font-family: var(--ds-font-family-code); color: var(--dsw-alias-state-business-primary, var(--dsw-alias-label-primary)); white-space: nowrap; }
.dsh-md-preview-keypop dd { margin: 0; color: var(--dsw-alias-label-secondary); }
.dsh-md-preview-warnbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1, var(--dsw-alias-interactive-bg-hover));
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
}
.dsh-md-preview-warnbar button {
  min-width: 28px;
  min-height: 28px;
  margin-left: auto;
  border: none;
  background: none;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  cursor: pointer;
  padding: 0 4px;
}
.dsh-md-preview-warnbar button:hover { color: var(--dsw-alias-label-primary); }
.dsh-md-preview-statusbar {
  flex-wrap: wrap;
  line-height: 18px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px 12px;
  padding: 4px 12px;
  border-top: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
  user-select: none;
}
.dsh-md-preview-editor .cm-editor { height: 100%; }
.dsh-md-preview-findcount {
  flex: none;
  margin: 0 2px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
  user-select: none;
}
.dsh-md-preview-editor .cm-panel.cm-search {
  background: var(--dsw-alias-bg-base);
  border-bottom: 1px solid var(--dsw-alias-border-l2);
  padding: 6px 36px 6px 8px;
  font-size: 13px;
}
.dsh-md-preview-editor .cm-panel.cm-search input,
.dsh-md-preview-editor .cm-panel.cm-search button {
  font-size: 13px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 4px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  padding: 2px 4px;
}
.dsh-md-preview-editor .cm-panel.cm-search button:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-md-preview-editor .cm-panel.cm-search button,
.dsh-md-preview-editor .cm-panel.cm-search input:not([type="checkbox"]) { min-height: 28px; box-sizing: border-box; line-height: 20px; max-width: 100%; }
.dsh-md-preview-editor .cm-panel.cm-search button[name="close"] { width: 28px; height: 28px; top: 4px; right: 4px; }
.dsh-md-preview-editor .cm-scroller { overflow: auto; scrollbar-gutter: stable; }
.dsh-md-preview-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, var(--dsw-alias-border-l1));
  background: var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover));
  font-size: 13px;
  color: var(--dsw-alias-label-primary);
}
.dsh-md-preview-bar button {
  min-height: 28px;
  line-height: 20px;
  border: 1px solid var(--dsw-alias-border-l2, var(--dsw-alias-border-l1));
  border-radius: 6px;
  padding: 3px 10px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  cursor: pointer;
}
.dsh-md-preview-bar button:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-md-preview-bar button:disabled { opacity: 0.5; cursor: default; }
.dsh-md-preview-browser {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  background: var(--dsw-specific-sidebar-fill);
}
.dsh-md-preview-browser[data-open] {
  position: relative;
  flex: none;
  width: 220px;
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
  font-size: 13px;
  color: var(--dsw-alias-label-secondary);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}
.dsh-md-preview-railtabs button[aria-selected="true"] {
  color: var(--dsw-alias-state-business-primary, var(--dsw-alias-label-primary));
  border-bottom-color: var(--dsw-alias-state-business-primary, var(--dsw-alias-label-primary));
  font-weight: 500;
}
.dsh-md-preview-railhandle {
  position: absolute;
  top: 0;
  bottom: 0;
  right: -4px;
  width: 8px;
  cursor: col-resize;
  touch-action: none;
  z-index: 2;
}
.dsh-md-preview-railhandle:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-md-preview-railfiles, .dsh-md-preview-railoutline {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.dsh-md-preview-railoutline { overflow: auto; padding: 8px; scrollbar-gutter: stable; }
.dsh-md-preview-browsescroll { flex: 1; min-height: 0; overflow: auto; padding: 0 12px 12px; scrollbar-gutter: stable; }
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
  font-size: 14px;
  line-height: 20px;
  min-height: 32px;
  flex: none;
  box-sizing: border-box;
  text-align: left;
  cursor: pointer;
}
.dsh-md-preview-railoutline button.dsh-md-preview-outline-active, .dsh-md-preview-outline button.dsh-md-preview-outline-active { background: var(--dsw-alias-interactive-bg-active); color: var(--dsw-alias-label-primary); font-weight: 500; }
.dsh-md-preview-railoutline button:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-md-preview-toolbar {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
  padding: 12px;
  background: var(--dsw-alias-bg-base);
}
/* Quick entries sit in the scroll region below the fixed search toolbar.
 * Name and parent context have separate lines; full paths remain available
 * on hover and keyboard focus. Empty sources and active searches hide them. */
.dsh-md-preview-quick {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: none;
  margin: 0 0 12px;
}
.dsh-md-preview-quicklabel {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  padding: 0 8px;
  user-select: none;
}
.dsh-md-preview-quickrow {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
  min-height: 48px;
  box-sizing: border-box;
  border: none;
  border-radius: 8px;
  padding: 5px 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: 14px/20px var(--dsw-font-family);
  cursor: pointer;
  text-align: left;
}
.dsh-md-preview-entrytext { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.dsh-md-preview-quickrow > svg, .dsh-md-preview-searchrow > svg { flex: none; margin-top: 2px; }
.dsh-md-preview-quickrow:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-md-preview-quickrow[aria-current] { background: var(--dsw-alias-interactive-bg-active); }
.dsh-md-preview-quickrow[aria-current] .dsh-md-preview-quickname { font-weight: 500; }
.dsh-md-preview-quickname {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 400;
}
.dsh-md-preview-quickpath {
  display: block;
  min-width: 0;
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
  color: var(--dsw-alias-label-secondary);
}
.dsh-md-preview-quickpath, .dsh-md-preview-searchpath {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
/* The continue-reading entry (#28): one bordered row carrying the label and the last-read
 * document's name (path on hover), reachable by keyboard like every
 * control. */
.dsh-md-preview-continue {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  flex: none;
  min-width: 0;
  margin: 0 0 12px;
  padding: 6px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: 14px/20px var(--dsw-font-family);
  cursor: pointer;
  text-align: left;
}
.dsh-md-preview-continue:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-md-preview-continue svg { flex: none; color: var(--dsw-alias-label-secondary); }
.dsh-md-preview-continue > span:first-of-type { flex: none; color: var(--dsw-alias-label-secondary); }
.dsh-md-preview-continuename {
  flex: 1 1 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.dsh-md-preview-refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: none;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dsh-md-preview-refresh:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dsh-md-preview-document {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 20px 24px;
}
.dsh-md-preview-document[hidden] { display: none; }
/* The read measure (#27): the rendered body centers on a comfortable
 * reading measure at normal panel widths instead of stretching edge to
 * edge; long tables and code blocks keep scrolling inside their own
 * regions (the primitive's wrappers) within the measure. */
.dsh-md-preview-read {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
}
/* Maximized widens the measure and outer space; MarkdownText continues to
 * own paragraph and heading rhythm at every panel width. */
.dsh-md-preview-overlay[data-maximized] .dsh-md-preview-read { max-width: 940px; }
.dsh-md-preview-overlay[data-maximized] .dsh-md-preview-document { padding: 32px; }
.dsh-md-preview-searchfield { display: flex; align-items: center; flex: 1; min-width: 0; height: 32px; box-sizing: border-box; gap: 6px; padding: 0 6px; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); }
.dsh-md-preview-searchglyph { flex: none; color: var(--dsw-alias-label-secondary); }
.dsh-md-preview-searchfield:focus-within { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }
.dsh-md-preview-searchfield .dsh-md-preview-searchinput:focus-visible { outline: none; }
.dsh-md-preview-searchinput::placeholder { color: var(--dsw-alias-label-secondary); }
.dsh-md-preview-searchinput {
  flex: 1;
  width: 0;
  min-width: 0;
  border: none;
  outline: none;
  padding: 0;
  font-size: 14px;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
  background: transparent;
}
/* The clear seat shares the refresh button's 28px hit area. */
.dsh-md-preview-searchclear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: none;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dsh-md-preview-searchclear:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
/* The workspace search results (#30): one column of option rows under the
 * toolbar, same row rhythm as the tree. The name carries the hit mark; the
 * path rides a quieter second span so same-name documents stay apart. */
.dsh-md-preview-searchresults {
  list-style: none;
  margin: 0;
  padding: 2px 0;
}
.dsh-md-preview-searchitem {
  border-radius: 8px;
  cursor: pointer;
}
.dsh-md-preview-searchitem[aria-selected='true'] { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-md-preview-searchitem:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-md-preview-searchrow {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-height: 48px;
  box-sizing: border-box;
  padding: 5px 8px;
  font-size: 14px;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
}
.dsh-md-preview-searchpath {
  min-width: 0;
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
  color: var(--dsw-alias-label-secondary);
}
.dsh-md-preview-searchlimit {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 4px;
  padding: 0 4px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-md-preview-treename mark {
  background: none;
  color: inherit;
  font-weight: 600;
  text-decoration: underline;
}
.dsh-md-preview-tree, .dsh-md-preview-treegroup {
  list-style: none;
  margin: 0;
  padding: 2px 0;
}
.dsh-md-preview-treegroup { padding-left: 16px; }
.dsh-md-preview-treebranch > .dsh-md-preview-treerow { height: 34px; }
.dsh-md-preview-treerow {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  box-sizing: border-box;
  padding: 0 8px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
  cursor: default;
}
.dsh-md-preview-treeleaf .dsh-md-preview-treerow { cursor: pointer; }
.dsh-md-preview-treerow:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-md-preview-treeitem[data-current] > .dsh-md-preview-treerow {
  background: var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover));
  font-weight: 500;
}
.dsh-md-preview-treeitem[aria-selected="true"]:not([data-current]) > .dsh-md-preview-treerow {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-md-preview-treeexpander {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex: none;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dsh-md-preview-treeitem[aria-expanded="true"] > .dsh-md-preview-treerow .dsh-md-preview-treeexpander svg {
  transform: rotate(90deg);
}
/* Directory icons convey hierarchy; names keep the navigation's normal weight. */
.dsh-md-preview-treebranch > .dsh-md-preview-treerow .dsh-md-preview-tree-icon {
  color: var(--dsw-alias-label-primary);
}
.dsh-md-preview-treebranch > .dsh-md-preview-treerow .dsh-md-preview-treename {
  font-weight: 400;
}
.dsh-md-preview-treespacer { width: 24px; flex: none; }
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
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 4px 8px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-md-preview-treeretry {
  min-height: 28px;
  line-height: 20px;
  border: 1px solid var(--dsw-alias-border-l2, var(--dsw-alias-border-l1));
  border-radius: 4px;
  padding: 1px 8px;
  background: transparent;
  font-size: 12px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
}
.dsh-md-preview-plaintext {
  margin: 0;
  padding: 12px;
  font-family: var(--ds-font-family-code);
  font-size: 13px;
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
  background: var(--dsw-alias-label-primary, #2f2f2f);
  color: var(--dsw-alias-label-primary-inverted, #f5f5f5);
  font-size: 13px;
  pointer-events: none;
  white-space: nowrap;
}
/* The in-flight save marker (#23): a small spinner in the save seat. */
.dsh-md-preview-savebusy {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--dsw-alias-border-l3, var(--dsw-alias-border-l2));
  border-top-color: var(--dsw-alias-state-business-primary, var(--dsw-alias-label-primary));
  animation: dsh-md-preview-spin 0.8s linear infinite;
}
@keyframes dsh-md-preview-spin {
  to { transform: rotate(360deg); }
}
/* The conflict bar's consequence line (#23): full-width caption under the
 * title, above the two choices. */
.dsh-md-preview-barhint {
  flex-basis: 100%;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}
.dsh-md-preview-overlay[data-compact] .dsh-md-preview-document { padding: 16px; }
.dsh-md-preview-overlay[data-narrow] .dsh-md-preview-header { padding-inline: 8px; }
.dsh-md-preview-overlay[data-narrow] .dsh-md-preview-seg { margin-inline: 2px; }
.dsh-md-preview-overlay[data-narrow] .dsh-md-preview-seg button { padding-inline: 6px; }
.dsh-md-preview-overlay[data-narrow] .dsh-md-preview-identity > svg,
.dsh-md-preview-overlay[data-narrow] .dsh-md-preview-crumb:not(:last-child) { display: none; }
.dsh-md-preview-overlay[data-narrow] .dsh-md-preview-crumb + .dsh-md-preview-crumb::before { display: none; }
.dsh-md-preview-browser[data-narrow] .dsh-md-preview-toolbar { padding: 8px; }
.dsh-md-preview-browser[data-narrow] .dsh-md-preview-browsescroll { padding-inline: 8px; }
.dsh-md-preview-browser[data-narrow] .dsh-md-preview-searchglyph { display: none; }
@media (prefers-reduced-motion: reduce) {
  .dsh-md-preview-savebusy { animation: none; }
  .dsh-md-preview-edgehandle::after { transition: none; }
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
