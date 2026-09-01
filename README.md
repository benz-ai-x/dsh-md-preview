[English](README.md) | [中文](README.zh.md)

# @benz-ai-x/dsh-md-preview

**DSH (DeepSeek Harness) Web GUI plugin — markdown preview, editing & workspace file browser beside the chat.** Preview rendered markdown and plain-text files, edit with conflict-guarded saves, and browse the session workspace tree without leaving the conversation.

[![npm](https://img.shields.io/npm/v/@benz-ai-x/dsh-md-preview)](https://www.npmjs.com/package/@benz-ai-x/dsh-md-preview)
[![GitHub](https://img.shields.io/badge/repo-benz--ai--x%2Fdsh--md--preview-24292e?logo=github)](https://github.com/benz-ai-x/dsh-md-preview)

## Features

- Markdown chips in the produced-files row of a turn open a right-docked preview panel rendering GFM, syntax-highlighted code, and TeX.
- A per-message "Preview documents" action lists that turn's markdown documents.
- Non-markdown deliverables keep the shipped open-on-desktop behavior.
- The panel is closable and draggable (320–1280 px, default 500); the dragged width persists for the app session.
- The panel renders nothing while no preview target is set.
- **Editing** — the panel's Edit action enters a CodeMirror editor (line numbers, GFM highlighting, Cmd/Ctrl-S save); Save writes back to the workspace, flashes a "Saved" toast, and returns to the rendered view; Cancel discards the draft. Only existing files edit. Non-conflict save failures show the failure code with a Retry action.
- **Conflict guard** — saving over a file that changed elsewhere (another session, the agent, an external editor) prompts "the file changed elsewhere": Reload or Overwrite; closing with unsaved edits asks first.
- **Workspace browser** — the panel header's Workspace action enters a directory tree of the session workspace (lazy expansion, loading/empty/failed states); single-click renders `.md` rich, `.txt` and other text monospace, other types a clear unsupported notice; the current document highlights and auto-reveals in the tree; full keyboard traversal (arrows/Enter); the header shows the path breadcrumb.

## Install

Requires DSH baseline `0.1.2-alpha.3` (see peerDependencies) and a web profile.

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
- The panel floats above the details column; it does not replace the three-column grid.
- Uploaded document attachments are not previewable (no transcript surface today).

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
| Editor | `src/client/editor.tsx` | CodeMirror 6 (curated extensions, inlined at build; client bundle ~426 kB minified) |
| Workspace tree | `src/client/WorkspaceBrowser.tsx` | lazy tree with highlight/auto-reveal/keyboard |
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
