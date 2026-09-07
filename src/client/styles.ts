/**
 * Panel and chip styles. The DSH client shell claims `<style>` tags a plugin
 * injects during materialization (tagged with data-plugin), so a plain
 * one-time injection is lifecycle-correct without a CSS-modules pipeline.
 * Colors ride the shared dsw alias tokens so light/dark themes both hold.
 */

const CSS = `
.dsh-md-preview-overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--dsw-alias-bg-base);
  /* #8: 1px edge + a heavier shadow keeps the layer's boundary legible in
   * dark themes, where the light shadow alone disappears. */
  border-left: 1px solid var(--dsw-alias-border-l3);
  box-shadow: -16px 0 40px rgba(0, 0, 0, 0.14);
  /* The host overlay layer is pointer-events: none; the panel re-arms itself. */
  pointer-events: auto;
}
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
  display: flex;
  align-items: center;
  gap: 2px;
  flex: none;
  min-width: 0;
  padding: 6px 8px 6px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}
/* Visible focus for every interactive control this plugin renders (#22):
 * header icons, segmented control, rail tabs, tree rows and filter, bars
 * and popovers, chips, the docs capsule — one accent-token ring, so light
 * and dark both hold. */
.dsh-md-preview-overlay :is(button, input, [role="treeitem"]):focus-visible,
.dsh-md-preview-docsbtn:focus-visible,
.dsh-md-preview-doc:focus-visible,
.dsh-md-preview-chip:focus-visible,
.dsh-md-preview-list button:focus-visible {
  outline: 2px solid var(--dsw-alias-accent, var(--dsw-alias-label-primary));
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
  background: var(--dsw-alias-bg-float, var(--dsw-alias-bg-base));
  box-shadow: 0 4px 16px rgb(0 0 0 / 12%);
}
/* Starting below the measured host header strip (#22): a rounded top-left
 * corner and a matching top border read the panel as sitting beside the
 * host's own column chrome instead of over it. */
.dsh-md-preview-overlay[data-below-strip] {
  border-top: 1px solid var(--dsw-alias-border-l3);
  border-top-left-radius: 10px;
  box-shadow: -16px -8px 40px rgba(0, 0, 0, 0.14);
}
.dsh-md-preview-docsbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 111px;
  height: 32px;
  padding: 6px 12px;
  gap: 4px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: 18px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
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
.dsh-md-preview-docsbtn[aria-pressed='true'] {
  background: var(--dsw-alias-interactive-bg-active);
}
.dsh-md-preview-docsbtn span,
.dsh-md-preview-docsbtn svg {
  flex: none;
}


.dsh-md-preview-foot {
  flex: none;
  padding: 2px 12px 4px;
  border-top: 1px solid var(--dsw-alias-border-l2);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
  user-select: none;
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
.dsh-md-preview-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
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
  position: relative;
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
.dsh-md-preview-railhandle:hover { background: var(--dsw-alias-fill-secondary); }
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
/* The continue-reading entry (#28): the browse area's opening seat — one
 * bordered row above the tree filter, carrying the label and the last-read
 * document's name (path on hover), reachable by keyboard like every
 * control. */
.dsh-md-preview-continue {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
  margin: 4px 8px 2px;
  padding: 5px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: var(--dsw-alias-fill-secondary);
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family);
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
  text-align: left;
}
.dsh-md-preview-continue:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-md-preview-continue svg { flex: none; color: var(--dsw-alias-label-secondary); }
.dsh-md-preview-continue > span:first-of-type { flex: none; color: var(--dsw-alias-label-secondary); }
.dsh-md-preview-continuename {
  flex: 1;
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
/* The read measure (#27): the rendered body centers on a comfortable
 * reading measure at normal panel widths instead of stretching edge to
 * edge; long tables and code blocks keep scrolling inside their own
 * regions (the primitive's wrappers) within the measure. */
.dsh-md-preview-read {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
}
/* Maximized widens the measure and breathes more between paragraphs and
 * headings — a different arrangement, not one limit stretched (#27). */
.dsh-md-preview-overlay[data-maximized] .dsh-md-preview-read {
  max-width: 940px;
}
.dsh-md-preview-overlay[data-maximized] .dsh-md-preview-read :where(p, ul, ol) {
  margin-top: 18px;
  margin-bottom: 18px;
}
.dsh-md-preview-overlay[data-maximized] .dsh-md-preview-read :where(h1, h2, h3) {
  margin-top: 36px;
}
.dsh-md-preview-searchinput {
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
/* The clear (✕) seat beside the workspace search box (#30): same quiet
 * 22px hit area language as the refresh button. */
.dsh-md-preview-searchclear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: none;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dsh-md-preview-searchclear:hover { background: var(--dsw-alias-fill-secondary); color: var(--dsw-alias-label-primary); }
/* The workspace search results (#30): one column of option rows under the
 * toolbar, same row rhythm as the tree. The name carries the hit mark; the
 * path rides a quieter second span so same-name documents stay apart. */
.dsh-md-preview-searchresults {
  list-style: none;
  margin: 0;
  padding: 2px 0;
}
.dsh-md-preview-searchitem {
  border-radius: 4px;
  cursor: pointer;
}
.dsh-md-preview-searchitem[aria-selected='true'] { background: var(--dsw-alias-fill-secondary); }
.dsh-md-preview-searchitem:hover { background: var(--dsw-alias-fill-secondary); }
.dsh-md-preview-searchrow {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 24px;
  padding: 2px 8px;
  font-size: 12px;
  color: var(--dsh-alias-label-primary);
}
.dsh-md-preview-searchpath {
  flex: none;
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary));
}
.dsh-md-preview-searchlimit {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 4px;
  padding: 0 4px;
  font-size: 10px;
  color: var(--dsw-alias-label-secondary);
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
/* Hierarchy (#7): directories read one level above files — primary icon,
 * 500-weight names — so the tree stops being a flat gray list. */
.dsh-md-preview-treebranch > .dsh-md-preview-treerow .dsh-md-preview-tree-icon {
  color: var(--dsw-alias-label-primary);
}
.dsh-md-preview-treebranch > .dsh-md-preview-treerow .dsh-md-preview-treename {
  font-weight: 500;
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
/* The in-flight save marker (#23): a small spinner in the save seat. */
.dsh-md-preview-savebusy {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--dsw-alias-border-l3, var(--dsw-alias-border-l2));
  border-top-color: var(--dsw-alias-accent, var(--dsw-alias-label-primary));
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
  font-size: 11px;
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
