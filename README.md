English | [中文](README.zh.md)

# @benz-ai-x/dsh-md-preview

Read and edit workspace documents beside a DeepSeek Harness conversation. Open a Markdown document produced by an assistant, browse the session workspace, or pick up where you last read.

[![npm](https://img.shields.io/npm/v/@benz-ai-x/dsh-md-preview)](https://www.npmjs.com/package/@benz-ai-x/dsh-md-preview)
[![GitHub](https://img.shields.io/badge/repo-benz--ai--x%2Fdsh--md--preview-24292e?logo=github)](https://github.com/benz-ai-x/dsh-md-preview)

Current release: **[v0.10.0](https://github.com/benz-ai-x/dsh-md-preview/releases/tag/v0.10.0)**, published on 2026-09-08. Requires the pinned Harness **0.1.2-rc.1** baseline and a web profile.

## Install or upgrade

```sh
dsh plugin --profile web add @benz-ai-x/dsh-md-preview@0.10.0 --save-exact
dsh --profile web --dump-config
```

The effective configuration should contain the `md-preview` row. Start the profile with `dsh --profile web`; if it is already running, restart that same instance and reload its page. Replace `web` with your existing web-profile name when needed.

To remove the plugin:

```sh
dsh plugin --profile web remove @benz-ai-x/dsh-md-preview
```

## What it does

- **Preview and edit** — render Markdown, GFM tables, highlighted code, TeX and Mermaid; edit existing Markdown documents with CodeMirror and save back to the workspace.
- **Read beside the conversation** — a document sidebar reserves space on wide screens, remembers your width preference and uses an overlay on narrow screens or when maximized. Native navigation and tool details keep their own controls.
- **Find documents** — browse the workspace tree, search document names across unexpanded directories, and use current-turn outputs, recently read documents and the continue-reading entry.
- **Keep your place** — reopening restores the recorded reading position after fetching the latest content. Panel width, navigation width and navigation choices persist when browser storage is available.
- **Guard edits** — closing, opening another document or switching back to Preview checks for an unsaved draft. Concurrent file changes offer Reload or Force overwrite; failures retain a retry path.
- **Follow Harness styling** — shared typography, theme colors, native icons and visible keyboard focus; document paragraphs and headings use the platform Markdown renderer.

## Open, navigate and close

| Entry or control | Action |
| --- | --- |
| Paperclip beside Session-log download | Opens workspace browsing while the panel is closed; closes the current panel while it is open |
| Markdown chip under a turn | Opens that produced document |
| Per-message “Preview documents” action | Lists Markdown documents produced by that message's turn |
| Folder icon inside the panel | Toggles the workspace navigation on wide panels; opens the Browse Face on narrow panels |
| Outline | Navigates headings and highlights the current reading position |
| Preview / Edit | Switches between the View Face and Edit Face for editable documents |
| Maximize / Restore | Fills the application content area, then returns to the remembered width |
| × | Closes the panel through the Unsaved Guard and returns focus to the paperclip entry |

The paperclip opens **workspace documents**; uploaded attachments are not supported. Non-Markdown produced-file chips keep Harness's desktop-open behavior. The workspace browser can also preview `.txt` as plain text by default.

The sidebar docks when the available application width is at least 1056px; narrower layouts and maximized reading use an overlay. Width starts at half the viewport, capped at 720px, and remembers a 360–1200px drag preference subject to available space. Drag the left edge to resize; double-click it to toggle maximization. Panels at least 640px wide can show the Files/Outline navigation beside the document; narrower panels use the Browse Face or outline popover. Direct document entries open body-first unless you have chosen a navigation preference.

In Edit, save with the toolbar button or Cmd/Ctrl-S. To leave without saving, request Preview, another document or close, then choose **Discard changes** in the guard; **Keep editing** preserves the draft. There is no separate Cancel-edit button. Save writes only an existing file and returns to Preview after confirmation.

Workspace search matches document **names**, case-insensitively, without reading file contents. Partial traversal reports an incomplete result with its reasons. Clearing a query restores the tree expansion state. Recently read documents are derived from recorded reading positions, so opening a file without scrolling may not add a recent entry.

## Keyboard

`Mod` means Cmd on macOS and Ctrl on Windows/Linux. Panel shortcuts require focus inside the panel; editor shortcuts require focus in the editor.

| Shortcut | Action |
| --- | --- |
| Mod-S | Save |
| Mod-F | Find within the editor |
| Mod-Z / Mod-Shift-Z | Undo / redo |
| Mod-B / Mod-I / Mod-K | Wrap the selection as bold, italic or a link |
| Mod-Shift-O / Mod-Shift-E | Open Outline / workspace navigation |
| Mod-/ | Show editor shortcut help |
| Esc | Dismiss an open popover or editor find panel first, then request panel close; never silently discard a draft |
| Arrow keys / Enter | Navigate and open workspace tree entries |

## Configuration

After installation, override the existing row in the profile's `cordis.patch.yml`:

```yaml
- id: md-preview
  config:
    maxBytes: 1048576
    allowedExtensions: ['.md', '.markdown']
    previewExtensions: ['.md', '.markdown', '.txt']
    searchMaxResults: 200
    searchMaxDirectories: 2000
    searchConcurrency: 8
```

A later patch replaces the row's **whole config**; preserve all custom values you intend to keep. Omitted fields use schema defaults.

| Field | Default | Meaning |
| --- | --- | --- |
| `maxBytes` | `1048576` | Per-file read/write cap in bytes |
| `allowedExtensions` | `[".md", ".markdown"]` | Extensions allowed for editing |
| `previewExtensions` | `[".md", ".markdown", ".txt"]` | Preview extensions; members outside the editable set are read-only |
| `searchMaxResults` | `200` | Maximum matches returned by a workspace search |
| `searchMaxDirectories` | `2000` | Maximum directories visited by a workspace search |
| `searchConcurrency` | `8` | Parallel directory listings per traversal step |

Paths are scoped to the session workspace. Saves require the backing read's fingerprint or an explicit force-overwrite choice. The schema is the authority for configuration defaults; the editable extensions are included in the preview union.

## Failure codes

| Code | Meaning |
| --- | --- |
| `md-preview/bad-request` | Invalid input; for example, a save with neither fingerprint nor force |
| `md-preview/unknown-session` | Session does not exist |
| `md-preview/no-workspace` | Session has no working directory |
| `md-preview/unsupported-extension` | Unsupported document extension |
| `md-preview/forbidden` | Workspace containment or filesystem access was denied |
| `md-preview/not-found` | Target does not exist |
| `md-preview/too-large` | Read or write exceeds `maxBytes` |
| `md-preview/conflict` | File changed since the read backing the save |
| `md-preview/unavailable` | Filesystem or transport operation failed |

## Installation forms

| Form | Command | Delivery |
| --- | --- | --- |
| npm | `dsh plugin --profile web add @benz-ai-x/dsh-md-preview@0.10.0 --save-exact` | Prebuilt JavaScript and declarations |
| Release archive | `dsh plugin --profile web add ./benz-ai-x-dsh-md-preview-0.10.0.tgz` | The same archive verified for publication; available with SHA256SUMS in the GitHub Release |
| Git source | `dsh plugin --profile web add github:benz-ai-x/dsh-md-preview#<commit>` | Self-contained `prepare` builds JavaScript; this form does not generate declarations |

For Git installs, pnpm may require explicit build permission. Use the exact package key it reports in that profile's `pnpm-workspace.yaml`, then rerun `add`:

```yaml
allowBuilds:
  '@benz-ai-x/dsh-md-preview': true
```

Build permission runs the package's source on your machine. Use a trusted source and a fixed commit. npm and release archives already contain their build output.

## Development and verification

Node must satisfy `^22.19.0 || >=24.0.0`; the repository declares pnpm 11.17.0. The pinned Harness checkout is resolved from `DSH_HARNESS_ROOT`, falling back to `../deepseek-harness`.

```sh
pnpm install
pnpm context:check:strict
pnpm verify
pnpm watch:client
```

Dependencies use published versions by default. `pnpm context:link` explicitly switches development dependencies to the pinned source checkout and refreshes the lockfile; it is also the available command for resynchronizing moved source links.

| Area | Source | Responsibility |
| --- | --- | --- |
| Host service | `src/remote.ts` | `mdPreview.read/write/list/search`, workspace authority and cancellation |
| Remote descriptors | `src/typert/remote-client.ts` | Browser-safe codecs and the four RPC methods |
| Client registration | `src/client/mount.ts` | Remote mounting and four Slot contributions |
| Preview Panel | `src/client/PreviewOverlay.tsx` | Rendering, navigation and local geometry |
| Dock adapter | `src/client/panel-dock.ts`, `use-panel-dock.ts` | Reversible space reservation beside the pinned Harness frame |
| Header entry | `src/client/WorkspaceDocsAction.tsx`, `PanelToggle.tsx` | Paperclip entry, × close and current-turn output projection |
| Preview Session | `src/client/preview-session.ts`, `use-preview-session.ts` | Read/edit/save lifecycle and guarded transitions |
| Reading and preferences | `src/client/reading.ts`, `preferences.ts` | Position restoration and bounded browser preferences |
| Workspace Browser | `src/client/WorkspaceBrowser.tsx` | Tree, search results, quick entries and navigation |
| Editor / diagrams | `src/client/editor.tsx`, `diagrams.ts` | CodeMirror editing and lazy Mermaid enhancement |

The v0.10.0 release passed **290 tests**, strict baseline checks, typechecking and build checks. Its exact archive passed a clean-profile install, public-name imports, configuration composition, startup, client-resource serving and removal; see the [release verification](https://github.com/benz-ai-x/dsh-md-preview/blob/main/docs/verification/releases/v0.10.0/WALKTHROUGH.md).

For publication, run `pnpm pack:publishable`, complete the clean-profile smoke with that archive, then publish **the same `.tgz`** with `npm publish <archive.tgz> --ignore-scripts --access public --registry=https://registry.npmjs.org/`. The full procedure, browser 2FA and runtime verification are in the [maintainer handover](https://github.com/benz-ai-x/dsh-md-preview/blob/main/docs/HANDOVER.md).

## Known limits and documentation

- The layout adapter depends on the pinned Harness frame structure; revalidate it when upgrading Harness. See [ADR-0004](https://github.com/benz-ai-x/dsh-md-preview/blob/main/docs/adr/0004-dock-preview-beside-the-harness-frame.md).
- Uploaded document attachments are not previewable. Inline prose mentions of `.md` files keep Harness's desktop-open behavior.
- Editing targets existing supported documents; it does not create files. Fenced code and inline HTML are edited as plain text.
- The outline collects ATX headings; setext headings render but are not listed.
- Mermaid uses its default theme. Mixed indented and fenced code blocks skip enhancement; rendering failures retain the original code block.
- Browser theme/zoom acceptance and further header refinements remain tracked in [TODO](https://github.com/benz-ai-x/dsh-md-preview/blob/main/TODO.md).

Development starts with the [project contract](https://github.com/benz-ai-x/dsh-md-preview/blob/main/docs/agent/PROJECT_CONTRACT.md) and [domain glossary](https://github.com/benz-ai-x/dsh-md-preview/blob/main/CONTEXT.md). Release notes are under [GitHub Releases](https://github.com/benz-ai-x/dsh-md-preview/releases).

## License

MIT
