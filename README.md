[English](README.md) | [中文](README.zh.md)

# @benz-ai-x/dsh-md-preview

**DSH (DeepSeek Harness) Web GUI plugin — markdown preview, editing & workspace file browser beside the chat.** Preview rendered markdown and plain-text files, edit with conflict-guarded saves, and browse the session workspace tree without leaving the conversation.

[![npm](https://img.shields.io/npm/v/@benz-ai-x/dsh-md-preview)](https://www.npmjs.com/package/@benz-ai-x/dsh-md-preview)
[![GitHub](https://img.shields.io/badge/repo-benz--ai--x%2Fdsh--md--preview-24292e?logo=github)](https://github.com/benz-ai-x/dsh-md-preview)

## Features

- Markdown chips in the produced-files row of a turn open a right-docked preview panel rendering GFM, syntax-highlighted code, and TeX.
- A per-message "Preview documents" action lists that turn's markdown documents.
- Non-markdown deliverables keep the shipped open-on-desktop behavior.
- The panel is a self-owned overlay above the frame (the host details column is untouched): it opens at 720 px (viewport-clamped), drags 360–1200 px from its left edge, maximizes to the full frame (⤢ button or edge double-click), and Esc dismisses it (a dirty draft is asked about first). The「工作区文档 / Workspace docs」capsule right of Session-log download in the header is a true toggle with a pressed state — one click parks the tree, another dismisses.
- The panel renders nothing while no preview target is set.
- **Editing** — the panel's Edit action enters a CodeMirror editor (line numbers, GFM highlighting, Cmd/Ctrl-S save); Save writes back to the workspace, flashes a "Saved" toast, and returns to the rendered view; Cancel discards the draft. Only existing files edit. Non-conflict save failures show the failure code with a Retry action.
- **Conflict guard** — saving over a file that changed elsewhere (another session, the agent, an external editor) prompts "the file changed elsewhere": Reload or Overwrite; closing with unsaved edits asks first.
- **Workspace browser** — the panel header's Workspace action enters a directory tree of the session workspace (lazy expansion, loading/empty/failed states); single-click renders `.md` rich, `.txt` and other text monospace, other types a clear unsupported notice; the current document highlights and auto-reveals in the tree; full keyboard traversal (arrows/Enter); the header shows the path breadcrumb. Expanded directories silently revalidate on every re-entry (and from the tree's refresh button) — the agent keeps producing files mid-conversation, and a failed refresh never blanks what's on screen.
- **Outline** — the header's outline popover lists the document's ATX headings (fenced code never counts); clicking scrolls the rendered heading in the view face and jumps the cursor to the source line in the edit face.
- **Side rail (from 640px)** — the file tree and outline live in a collapsible left rail (文件|大纲 tabs, selection remembered); browsing never swaps the document away. Below 640px the face-swap/popover fallback holds; Mod-Shift-O/E jump, Esc dismisses.
- **Segmented mode + edit feedback** — a persistent 预览|编辑 control (dirty drafts raise the guard on switch); a status bar with live Ln/Col, size, and the resident saved-at stamp; undo/redo buttons; Mod-B/I/K markup keys (? lists them); documents with inline HTML warn once per edit session.
- **Workspace search** — the browse area's search box finds documents by name across the *whole* session workspace — unexpanded directories included — through a cancellable host traversal that never reads file bodies. Case-insensitive substring match on names; each result shows name plus workspace-relative path (same-name documents stay apart); opening a result re-runs the full read and guard. States stay honest: searching…, "no results" only from a complete search, "incomplete results" with its reason (unreadable directories / traversal or result cap), failure with retry. A new query cancels the old one's work; clearing restores the exact tree you left. (Distinct from the editor's in-document find.)
- **Quick entries** — two compact rows above the tree: 「Produced this turn」 lists the previewable documents the session's newest turn produced (owning-service facts, closing-seq fenced, live while the turn streams), and 「Recently read」 lists this session's recently read documents recency-first. Both show name plus path and open through the same guarded path with a fresh read; empty sources simply hide; the continue-reading entry keeps its own explicit seat beside them.
- **Reading position** — the outline popover highlights the entry owning your position (scroll in the view face, cursor line in the edit face) and keeps it in view; the header shows a dirty dot for unsaved drafts, folds the version into the crumbs tooltip, and annotates the find/save shortcuts; the find panel is localized and shows a match count (n/m).
- **Editor find** — the edit face carries a CodeMirror search panel (header button and Mod/Ctrl-F).
- **Mermaid diagrams** — fenced ` ```mermaid ` blocks render as diagrams after the document settles; the block banner stays (copy still reads the source), and any failure falls back to the plain code block. Mermaid is inlined into the client bundle but evaluated lazily (first diagram pays the parse cost; bundle ~3.9 MB minified / ~1.1 MB gzip).

## Install

Requires DSH baseline `0.1.2-rc.1` (see peerDependencies) and a web profile.

```sh
dsh plugin --profile <name> add @benz-ai-x/dsh-md-preview
dsh --profile <name> --dump-config   # expect the id: md-preview row
dsh --profile <name>                 # open the Web GUI; click a chip after a turn produces .md
dsh plugin --profile <name> remove @benz-ai-x/dsh-md-preview
```

### Three install forms (per the [DSH publish spec](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/user/develop/basic/publish.md))

| Form | Command | Status |
| --- | --- | --- |
| npm (recommended) | `dsh plugin --profile <name> add @benz-ai-x/dsh-md-preview` | ✅ prebuilt, works out of the box |
| tarball | `dsh plugin --profile <name> add ./benz-ai-x-dsh-md-preview-<ver>.tgz` (from `pnpm pack:publishable`) | ✅ prebuilt, no build approval needed |
| Git | `dsh plugin --profile <name> add github:benz-ai-x/dsh-md-preview#<sha>` | ✅ builds from source via the package's self-contained `prepare` (transpile-only; no type declarations ship on this form) — see below |

Git installs fetch source, and pnpm refuses to run a git dependency's `prepare` until the package is explicitly allowed. After the first `add` fails, copy the package key pnpm printed into the profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  '@benz-ai-x/dsh-md-preview': true
```

then re-run `add`. Allowing a build executes the package's code on your machine at install time — allow only sources you trust, and pin a commit (`#<sha>`) so a later push cannot silently change what runs.

## Configuration

```yaml
- id: md-preview
  name: '@benz-ai-x/dsh-md-preview'
  config:
    maxBytes: 1048576        # per-file read/write cap in bytes
    allowedExtensions: ['.md', '.markdown']
```

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `maxBytes` | number | `1048576` | per-file read/write cap; exceeded returns `too-large` |
| `allowedExtensions` | string[] | `[".md", ".markdown"]` | extensions eligible for editing |
| `previewExtensions` | string[] | `[".md", ".markdown", ".txt"]` | extensions eligible for preview (a superset of the editable set; plain-text members render read-only) |

## Failure codes

The panel shows `md-preview/<reason>` on failure. All codes:

| Code | Meaning |
| --- | --- |
| `md-preview/bad-request` | path empty or unusable; or a save with neither fingerprint nor force |
| `md-preview/unknown-session` | session does not exist |
| `md-preview/no-workspace` | session has no working directory |
| `md-preview/unsupported-extension` | extension outside the allowlist |
| `md-preview/forbidden` | path escapes the session workspace |
| `md-preview/not-found` | file does not exist (editing targets existing files only) |
| `md-preview/too-large` | file (read) or content (write) exceeds `maxBytes` |
| `md-preview/conflict` | file changed since the read backing the save (no force) |
| `md-preview/unavailable` | IO error during read/write |

## Known limits

- Inline prose mentions of `.md` files still open on the desktop (owned by ui-deliverables, not this plugin).
- The panel is a self-owned overlay layer above the frame: it opens at 720px (viewport-clamped), drags 360–1200px from its left edge, maximizes to the full frame (button or edge double-click), and Esc dismisses it — the host details column keeps its shipped tool/approval surface.
- Uploaded document attachments are not previewable (no transcript surface today).
- The outline lists ATX headings only (setext forms render but stay out of the popover).
- Mermaid renders with its default theme; documents mixing indented code blocks with fenced ones skip the diagram pass entirely (order-parity safety check).

## Development (source-linked)

```sh
pnpm install
pnpm verify                 # context:check:strict + typecheck + test + build + built:check
pnpm context:link           # source-linked development: rewrite link: at the harness checkout (registry by default)
pnpm watch:client           # client bundle watch build
```

### Structure

| Part | Location | Notes |
| --- | --- | --- |
| Host Remote | `src/remote.ts` | `mdPreview/read(sessionId, path, signal)`; workspace scoping, extension allowlists, byte caps |
| Remote contribution | `src/typert/remote-client.ts` | hand-maintained browser-side descriptors (generator-equivalent) |
| Browser entry | `src/client/index.ts` | mounts the Remote + registers three Slot contributions |
| Preview panel | `src/client/PreviewOverlay.tsx` | `shell.overlay` (list, additive); rendering + geometry only |
| Session machine | `src/client/preview-session.ts` | pure reducer for read/edit/save/prompts |
| Editor | `src/client/editor.tsx` | CodeMirror 6 (curated extensions incl. the search panel, inlined at build) |
| Workspace tree | `src/client/WorkspaceBrowser.tsx` | lazy tree with highlight/auto-reveal/keyboard and silent revalidation |
| Outline | `src/client/outline.ts` | ATX heading scan + rendered-heading resolution |
| Diagram pass | `src/client/diagrams.ts` | post-render mermaid enhancement, fail-soft to the code block |
| Chip row | `src/client/MdChips.tsx` | `conversation.chat.turnTail` (chain; claims markdown-bearing turns) |
| Message action | `src/client/PreviewAction.tsx` | `conversation.chat.assistant-actions` (list, additive) |

### Real-profile verification (local checkout)

```sh
pnpm build
dsh plugin --profile <name> add ./dsh-md-preview
dsh --profile <name> --dump-config
dsh --profile <name>        # open the Web GUI, produce a README.md and click the chip
dsh plugin --profile <name> remove @benz-ai-x/dsh-md-preview
```

### Pack & publish

```sh
pnpm pack:publishable       # registry-clean tarball + self-check (no devDeps, no link:/workspace:)
pnpm publish:registry       # publish via the same cleaned-manifest flow
```

Source-linked verification proves compatibility with the pinned harness checkout (see `dsh-reference.lock.json`); the publish form is proven by the packed-tarball profile smoke.

## License

MIT
