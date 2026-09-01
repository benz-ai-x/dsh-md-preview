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
and idle (renders nothing) while no target is set.

## Plugin form and topology

One private package `dsh-md-preview`, Cordis plugin name `md-preview`, with
two faces:

- **Host half** (`src/index.ts` → `lib/index.js`): namespace function plugin
  registering `MdPreviewService` (a `TypertRemoteService`, service key
  `mdPreview`, namespace `mdPreview`) exposing `read(sessionId, path, signal)`.
- **Client half** (`src/client/index.ts` → `lib/client.js`): browser bundle
  in the DSH lazy-CJS factory protocol; mounts the hand-maintained Remote
  contribution (`src/typert/remote-client.ts` → `lib/typert/remote-client.js`,
  also exported as `./remote`), then registers three Slot contributions:
  `shell.overlay` (list, id `md-preview`, the docked panel),
  `conversation.chat.turnTail` (chain, order -100, claims markdown-bearing
  turns), and `conversation.chat.assistant-actions` (list, id `md-preview`).

Service dependencies:

- Host: `inject = ['fs', 'typert', 'sessions']` — read authority via
  `ctx.fs`, Gateway publication via `ctx.typert`, workspace root via
  `ctx.sessions.get(id).header.cwd`.
- Client: `inject = ['remote', 'slots', 'locale']`; the UI fiber additionally
  waits for the mounted `remote.mdPreview` namespace.

## Authority and failure codes

The Host owns the read decision. Paths are resolved against the session's
workspace `cwd`, must stay inside it (`ctx.fs.contains`), carry an allowed
extension, and stay under `maxBytes`. Stable failure codes (declared in
`RemoteErrorDetailsMap`, thrown as `RemoteError`): `md-preview/bad-request`,
`md-preview/unknown-session`, `md-preview/no-workspace`,
`md-preview/unsupported-extension`, `md-preview/forbidden`,
`md-preview/not-found`, `md-preview/too-large`, `md-preview/unavailable`.
Caller cancellation propagates
through resolve/stat/read and is never mapped to a business failure.

The client passes the session identity explicitly as the first business
argument (the `goals/*` direct calling convention) rather than relying on the
agent Context scope, because the panel and actions call from root-scoped
contexts.

## Authoritative state

- File content is workspace truth; every panel open re-reads through the
  Remote (no client cache). A manual retry re-runs the read for the same
  target.
- The preview target (`{sessionId, path} | null`) is UI-local viewing state
  in a plugin-owned snapshot store. The panel's dragged width persists across
  opens for the app session (clamped 320–720); the target itself resets per
  open. Session data, turn membership, and deliverables vocabulary stay in
  their owning services.

## Cancellation and disposal

- Panel target changes and unmount abort the in-flight read via the
  transport-carried AbortSignal.
- Client disposal: the mount disposer removes the UI fiber (slot entries,
  locale dictionary) then unmounts the Remote namespace; a failed UI
  registration rolls back the Remote mount. Collapsing a declaring owner
  (e.g. ui-chat's turn-tail node) removes only that slot's contribution.

## Configuration

`maxBytes` (default 1048576), `allowedExtensions` (default `[".md",
".markdown"]`) — validated by the schemastery `Config` twin during load.

## Delivery

Source-linked development closure against the pinned Harness checkout
(`DSH_HARNESS_ROOT`, `link:` dev dependencies). Activation layer:
`cordis.patch.yml` inserting Loader row `md-preview`. The package remains
`private: true` until a packed-artifact/profile smoke proves the install
form; source-linked verification proves pinned-checkout compatibility only.

## External-world acceptance assertions

1. With the plugin composed in a real profile and a session whose turn wrote
   `README.md`, the chip row renders a markdown chip; clicking it opens the
   docked panel and renders the document's heading (asserted through the
   composed Slot registry in tests, and through the real profile boot).
2. Removing the plugin removes the chips, the action, the panel, and the
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
