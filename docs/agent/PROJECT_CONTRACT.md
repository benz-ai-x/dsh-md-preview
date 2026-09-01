# Project Contract: dsh-md-preview

Pinned DSH baseline: `dsh-reference.lock.json` (commit
`dd6322d604e00eec1ba5e0c8541159906a21094a`, version `0.1.2-alpha.3`).

## User-visible outcome

In the DSH web GUI's conversation view, markdown documents that a turn
produced become clickable in two additive places:

1. the produced-files chip row under the closing assistant message — markdown
   chips open a rendered preview, other chips keep the shipped
   open-on-desktop behavior;
2. a per-message "预览文档" action in the assistant action row, listing that
   turn's markdown documents.

Either entry opens a right-docked preview panel beside the conversation that
renders the document (GFM, fenced code with highlighting, TeX) through the
platform `MarkdownText` primitive. The panel is closable, width-draggable,
and idle (renders nothing) while no target is set. A 「编辑」 action enters a
CodeMirror 6 editor (line numbers, GFM highlighting, Cmd/Ctrl-S) whose
「保存」 writes the draft back into the session workspace and returns to the
rendered view; 「取消编辑」 discards the draft. Saving over a file that
changed since the read raises a conflict bar (重新加载 / 强制覆盖), and
closing with unsaved edits asks first (放弃修改 / 继续编辑). Editing targets
existing files only — no creation.

## Plugin form and topology

One published package `@benz-ai-x/dsh-md-preview`, Cordis plugin name
`md-preview`, with two faces:

- **Host half** (`src/index.ts` → `lib/index.js`): namespace function plugin
  registering `MdPreviewService` (a `TypertRemoteService`, service key
  `mdPreview`, namespace `mdPreview`) exposing
  `read(sessionId, path, signal)` and
  `write(sessionId, path, content, fingerprint | force, signal)`.
- **Client half** (`src/client/index.ts` → `lib/client.js`): browser bundle
  in the DSH lazy-CJS factory protocol (minified); mounts the hand-maintained
  Remote contribution (`src/typert/remote-client.ts` →
  `lib/typert/remote-client.js`, also exported as `./remote`), then registers
  three Slot contributions: `shell.overlay` (list, id `md-preview`, the
  docked panel), `conversation.chat.turnTail` (chain, order -100, claims
  markdown-bearing turns), and `conversation.chat.assistant-actions`
  (list, id `md-preview`). CodeMirror 6 (curated extension set; the GFM
  grammar assembled directly from `@lezer/markdown` to avoid
  `lang-markdown`'s static html/css/js chain) is a build-time devDependency
  inlined into the client bundle.

Service dependencies:

- Host: `inject = ['fs', 'typert', 'sessions']` — read/write authority via
  `ctx.fs`, Gateway publication via `ctx.typert`, workspace root via
  `ctx.sessions.get(id).header.cwd`.
- Client: `inject = ['remote', 'slots', 'locale']`; the UI fiber additionally
  waits for the mounted `remote.mdPreview` namespace.

## Authority and failure codes

The Host owns the read and write decisions. Paths are resolved against the
session's workspace `cwd`, must stay inside it (`ctx.fs.contains`), carry an
allowed extension, and stay under `maxBytes` (which caps both the read size
and the written content length). Writes additionally target an existing
regular file and carry either the backing read's fingerprint (the fs
service's opaque `FsVersion` from `stat`, passed back through
`writeText`'s `replaceIfVersion` guard) or an explicit `force`. Stable
failure codes (declared in `RemoteErrorDetailsMap`, thrown as `RemoteError`):
`md-preview/bad-request`, `md-preview/unknown-session`,
`md-preview/no-workspace`, `md-preview/unsupported-extension`,
`md-preview/forbidden`, `md-preview/not-found`, `md-preview/too-large`,
`md-preview/conflict` (stale fingerprint without force; the fs layer's
`FS_STALE_VERSION` mapped verbatim), `md-preview/unavailable`. Caller
cancellation propagates through resolve/stat/read/write and is never mapped
to a business failure.

The client passes the session identity explicitly as the first business
argument (the `goals/*` direct calling convention) rather than relying on the
agent Context scope, because the panel and actions call from root-scoped
contexts.

## Authoritative state

- File content is workspace truth; every panel open re-reads through the
  Remote (no client cache), and every successful save re-reads before
  returning to the rendered view. A manual retry re-runs the read for the
  same target.
- The preview target (`{sessionId, path} | null`), the editor draft, and the
  conflict/unsaved prompts are UI-local viewing state; the draft never
  reaches the workspace except through an explicit guarded `write`. The
  panel's dragged width persists across opens for the app session (clamped
  320–960); the target itself resets per open. Session data, turn membership,
  and deliverables vocabulary stay in their owning services.

## Cancellation and disposal

- Panel target changes and unmount abort the in-flight read via the
  transport-carried AbortSignal; a target change or panel close during a
  save aborts it the same way, so a late save cannot land on a stale file.
- Client disposal: the mount disposer removes the UI fiber (slot entries,
  locale dictionary) then unmounts the Remote namespace; a failed UI
  registration rolls back the Remote mount. Collapsing a declaring owner
  (e.g. ui-chat's turn-tail node) removes only that slot's contribution.

## Configuration

`maxBytes` (default 1048576, caps reads and writes), `allowedExtensions`
(default `[".md", ".markdown"]`) — validated by the schemastery `Config`
twin during load.

## Delivery

Published to npm as `@benz-ai-x/dsh-md-preview` (public; minified client
bundle). Activation layer: `cordis.patch.yml` inserting Loader row
`md-preview`. Source-linked development closure runs against the pinned
Harness checkout (`DSH_HARNESS_ROOT`, `link:` dev dependencies);
`scripts/pack.mjs` packs and publishes with a registry-clean manifest (the
`link:` devDependencies never ship). Every release requires the
packed-artifact profile smoke: install the tarball into a clean profile,
compose, boot, serve the client bundle, remove.

## External-world acceptance assertions

1. With the plugin composed in a real profile and a session whose turn wrote
   `README.md`, the chip row renders a markdown chip; clicking it opens the
   docked panel and renders the document's heading (asserted through the
   composed Slot registry in tests, and through the real profile boot).
2. Editing the document and saving persists the draft to the workspace file
   and returns to the rendered view; saving over an externally changed file
   surfaces `md-preview/conflict`, and force-overwrite wins only on the
   user's explicit choice (asserted in host and jsdom panel tests).
3. Removing the plugin removes the chips, the action, the panel, and the
   `mdPreview` Remote namespace; the shipped ui-deliverables row returns for
   every turn.

## Known limits

- Inline-code prose mentions of markdown files still open on the desktop
  (the `chatFileMentions` service stays owned by ui-deliverables).
- The overlay panel floats above the details column rather than replacing
  the three-column grid (deliberate: replacing the `details` single slot
  would remove tool-call details).
- User-uploaded document attachments are not previewable (they have no
  transcript surface today).
- The editor face highlights markdown structure only: fenced code blocks
  and inline HTML edit as plain text (rendered highlighting stays with the
  preview face), and the panel edits existing files only — no creation.
