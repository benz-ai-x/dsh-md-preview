English | [中文](README.zh.md)

# @benz-ai-x/dsh-md-preview

Preview and edit Markdown in the **official DeepSeek Harness right-sidebar tabs**.

This branch is the **0.11.0-alpha.2 development candidate**. It requires Harness
`0.1.5-alpha.1` plus the public close-guard patch pinned by
[dsh-reference.lock.json](dsh-reference.lock.json). Stock npm Harness of that version
lacks the guard and this candidate refuses activation. The published
[v0.10.0](https://github.com/benz-ai-x/dsh-md-preview/releases/tag/v0.10.0)
uses the old sidebar and does not include this migration. No new release is implied.

## Install the candidate

Build the pinned Harness checkout with [the patch](patches/harness-sidebar-close-guard.patch),
then use that checkout's normal CLI and an isolated web profile. With its `dsh` command:

```sh
dsh --profile markdown-accept --from-default-profile web --dump-config
dsh plugin --profile markdown-accept add ./benz-ai-x-dsh-md-preview-0.11.0-alpha.2.tgz --save-exact
dsh --profile markdown-accept --dump-config
dsh --profile markdown-accept --no-open
```

For a new custom profile, initialize it first with
`dsh --profile markdown-accept --from-default-profile web --dump-config`.
The composed configuration must contain `md-preview`. Restart that same profile
and reload its page after installing into a running instance. To remove:

```sh
dsh plugin --profile markdown-accept remove @benz-ai-x/dsh-md-preview
```

A local archive is an unpublished candidate, not an npm installation recommendation.
Source setup and actual acceptance results are in the
[TDD record](docs/verification/official-sidebar-markdown/TDD.md).

## Markdown workflow

- Open `.md` or `.markdown` from the official file tree, chat file mentions, tool paths,
  or produced-file chips. The optional per-message **Preview documents** action uses
  the same native resource path. Harness owns tabs, splits, floating panes and sidebar visibility.
- Read GFM tables, highlighted code, mathematics and Mermaid through the shared Markdown
  renderer. A diagram failure keeps the original code and a visible explanation.
- Choose **Edit** for CodeMirror, then **Save** or Mod-S. Undo, redo and in-document
  find are retained. Saving writes the complete original-format text and re-reads the committed file.
- A live tab retains its draft and undo history while switching tabs or sessions, hiding
  the right sidebar, or remounting its body. Closing its record releases that state.
- Native close/replacement, Reload and returning to Preview share an unsaved-change
  guard. **Keep editing** preserves the draft; **Discard changes** authorizes the held
  action. Repeated destructive requests retain the first decision. Closing waits for
  an in-progress save. Refreshing the browser asks its native leave warning when possible.
- Conflicts retain the draft and offer Reload or explicit **Overwrite**. A successful
  write followed by a failed read is reported as already saved with a read retry.
  Observed external changes show a hint and never silently replace a draft.

`line` navigation reveals the enclosing ATX section in Preview. **Source line N**
opens the editor at the exact source line; a fresh native navigation updates the target.

## Keyboard

`Mod` means Cmd on macOS and Ctrl on Windows/Linux; editor keys require editor focus.

| Shortcut | Action |
| --- | --- |
| Mod-S | Save |
| Mod-F | In-document find |
| Mod-Z / Mod-Shift-Z | Undo / redo |
| Mod-B / Mod-I / Mod-K | Wrap selection as bold, italic or link |
| Esc | Close the editor search panel or cancel an open unsaved dialog |

There is no plugin-wide Esc-to-close shortcut, standalone sidebar toggle, duplicate
file tree, maximize control, or workspace navigation shortcut in this candidate.

## Configuration and limits

Override the existing row in the profile's `cordis.patch.yml`:

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

These are schema defaults. A later patch replaces the whole config; preserve your custom values.
`maxBytes` caps UTF-8 bytes for both full reads and writes. `allowedExtensions` may
restrict editing; it cannot grant write access beyond `.md` and `.markdown`.
`previewExtensions` and the three search bounds remain Host RPC settings for future
work. They do not register extra native tab types or expose a search UI in this phase.

The Host verifies explicit session identity, workspace containment, final-component
symlinks (rejected), file type, bytes and version. Editing targets existing files only.
Reads verify the version again after reading. Writes use the filesystem's version
comparison unless the user explicitly overwrites, and publish a native file observation
only after success. This is not an OS-wide file watcher.

Failures keep stable `md-preview/` codes: `bad-request`, `unknown-session`,
`no-workspace`, `unsupported-extension`, `forbidden`, `not-found`, `too-large`,
`conflict`, `unavailable`. Over-limit files offer the official read-only text viewer;
its own reading limits still apply. Upload attachments and other formats are deferred.

Workspace filename search/current outputs (#57), independent outline/persistent reading
(#58), general text (#39) and other formats are deferred. Existing reading records and
preferences are preserved but are not restored or applied to the native layout.
Drafts, bodies, fingerprints and undo history stay in memory, not browser storage.
Mermaid retains its default theme; mixed indented/fenced blocks skip enhancement when
source and rendered block counts disagree.

## Development

Read [AGENTS.md](AGENTS.md), [the contract](docs/agent/PROJECT_CONTRACT.md) and
[ADR-0007](docs/adr/0007-markdown-in-official-sidebar-tabs.md). Use the exact patched
checkout in the lock; the source-link workflow is explicit:

```sh
export DSH_HARNESS_ROOT=/absolute/path/to/deepseek-harness-md-guard
pnpm context:link
pnpm context:check:strict
pnpm verify
pnpm pack:publishable
```

The original Harness checkout is not changed by this repository. To reproduce the
patch in a new worktree, start from upstream commit `5dda764ed3aa172535a7967b06ff95d9cbfe536a`,
apply the supplied format-patch with `git am`, and build Harness. The audited worktree
commit is `737e95c657a95fd04b12269313902f9b5ca2f6ca`; preserve its commit identity or
re-audit an independently applied commit before changing the lock.

Node/pnpm requirements are in [package.json](package.json). The client keeps the
repository's lazy-CJS factory protocol and frozen platform-module list; CodeMirror
and Mermaid are bundled. Full builds remove obsolete generated declarations.
Use one verified archive for clean-profile installation, ordinary package imports,
resource serving and removal. Publishing follows [HANDOVER](docs/HANDOVER.md#发布流程)
and is a separate action from development acceptance.

MIT
