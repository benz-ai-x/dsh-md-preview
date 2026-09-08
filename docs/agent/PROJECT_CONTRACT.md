# Project Contract: dsh-md-preview

Pinned DSH baseline: `dsh-reference.lock.json` (commit
`a66e4702047846cdaa10c66c9d3df3951f5ea70d`, version `0.1.2-rc.1`).

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
and idle (renders nothing) while no target is set. It docks at the frame's
top edge, covering the host session header while open; the panel's own
workspace/back and close actions remain directly reachable. No measured
header-strip geometry is published. A 「编辑」 action enters a
CodeMirror 6 editor (line numbers, GFM highlighting, Cmd/Ctrl-S) whose
「保存」 writes the draft back into the session workspace and returns to the
rendered view; 「取消编辑」 discards the draft. Saving over a file that
changed since the read raises a conflict bar (重新加载 / 强制覆盖) with a
consequence line spelling out what each choice does. Every way out of the
current preview session — the panel close button, Esc, the 「工作区文档」
collapse, the segmented switch back to the view face, tree rows, the
produced-file chips, and the preview-documents action — routes through one
leave-intent seat; with a dirty draft the first intent waits behind the
放弃修改/继续编辑 guard (later requests are dropped, never silently swapped;
继续编辑 restores editor focus with draft, cursor, and selection intact;
放弃修改 writes nothing and executes the held intent exactly once), while a
clean draft executes at once. Re-opening the document already showing is a
no-op that resets nothing — identity is the session plus the path the host
resolved on the opening read, and the client never guesses symlink
equivalences. Esc serves the open popover, then the editor's own find
panel, and only then requests the close; it never confirms a discard.
Editing targets
existing files only — no creation. The edit face carries a CodeMirror search
panel (header button and Mod-F). The header renders one row: the document
identity shrinks (the filename has priority; at 420px and below its parent
crumb and decorative icon hide). A focusable identity keeps the full raw
workspace path and version available through the platform tooltip; the
browse title exposes the version the same way, without a version-only
footer. The 预览/编辑 control and edit tools group
after it, and maximize/close hold the last two seats; below 560px the
low-frequency tools (outline, undo/redo/find, keymap help) fold into a ⋯
menu while save and close stay directly clickable. The breakpoints use the
visible width even while maximized or after browser zoom. The header's outline
popover navigates the
document's ATX headings — scrolling the rendered heading in the view face,
jumping the cursor to the source line in the edit face. The outline tracks
the reading position: the popover marks the entry owning the current scroll
position in the view face and the cursor's source line in the edit face,
keeping that entry scrolled into view. The header carries a dirty dot while
the edit draft differs, folds the plugin version into the crumbs tooltip,
and annotates the find and save shortcuts; the find panel is localized,
shows a match count in the editor status bar, and matches the panel's design language. Wide panels
(from 640px) carry a collapsible left rail — a 文件/大纲 mini-tab column
whose files page hosts the workspace tree beside the document (browsing
never swaps the document away) and whose outline page hosts the heading
list with the reading-position highlight. The navigation starts at 220px
unless a manual width exists, retaining the 120–320px drag range; narrow panels fall back to the
browse-face swap and the outline popover, with Mod-Shift-O/E routing by
width and Esc dismissing popovers. The edit face's status bar walks
保存中… → 未保存 / 保存失败 · code → 已保存 HH:MM while the save button
itself turns busy and refuses a second submission; a write that succeeds
but is then failed by its confirming re-read surfaces both results
distinctly — the saved toast stands, the read failure carries its own
retry, and the stale pre-save body never returns. Undo/redo buttons surface
the editor
history; Mod-B/I/K wrap selections in markup with the ?/Mod-/ popover
listing the keys; a document containing inline HTML warns once per edit
session that the edit face is plain text. The browse area's search box is a
workspace document search (#30) — unlike the editor's in-document find, it
searches document names across the whole session workspace, unexpanded
directories included, through a cancellable host traversal that never reads
file bodies. Typing debounces into one search; while a query is live the
results list replaces the tree (kept mounted and hidden), each result naming
the document and its workspace-relative path so same-name documents stay
apart, and opening one rides the same leave-guarded open path with a fresh
read — a search result is never a read grant. States stay distinguishable:
搜索中… while in flight; 没有结果 only when the search completed whole with
zero hits; an incomplete answer states 结果不完整 with its reasons (部分目录
无法读取 / 已达遍历目录上限 / 已达结果数量上限) and keeps what it found; a
failure names its stable code with a retry. A new query cancels the previous
search's work and a late answer never overwrites the live one; clearing the
query, switching the owning session, or disposing the panel cancels
everything pending, and clearing restores the exact tree expansion state the
reader left (silent revalidation untouched). Reopening a document restores the
reading position (#25): the open always re-reads the workspace's latest
content through the Remote first, and once the rendered document settles,
one restore per open scrolls back to the recorded section — matched by
heading text plus occurrence ordinal among duplicates, with the section's
in-scroll offset; when the section no longer resolves, the stored scroll
fraction applies, and when nothing survives, reading starts at the top
without blocking. The reader who scrolls or navigates before the restore
fires cancels it, and a restore never re-applies after user movement or on
a re-read of the same open. Positions live in a versioned, validated,
bounded reading record keyed by (session, workspace path) — never a
document body, draft, or fingerprint — persisted in browser localStorage
when reachable and degraded to in-memory otherwise; a damaged envelope or
unavailable storage never blocks opening. A document that moved, was
deleted, or cannot be read states the failure and offers an explicit way
back to workspace browsing. The reader's manually chosen reading space
survives closes and same-browser revisits (#26): the dragged panel width
and rail width, the rail collapse choice, and the per-session files/outline
choice persist through a versioned, validated preference record (bounded
remembered sessions; degraded to memory when storage fails). Restored
widths clamp into the support range and the live viewport; an absent
preference derives from the viewport instead of falling to the minimum,
and threshold crossings or maximize round-trips never overwrite a manual
width. Until any manual choice exists, the panel arranges space by the
open's intent (#27): a direct document entry opens body-first (the rail
stays out of the way, expandable at any time), while an explicit
workspace-browse entry expands the navigation; a manual choice — this
session's or the remembered one — always outranks the automatic
arrangement across renders and document switches. The browse area carries
two quick-entry sections below its fixed search toolbar (#31): 「当前回合产出」 lists
the previewable documents the session's newest turn produced — derived
from the owning chat facts (deliverables turn data fenced by the turn and
its closing seq, exactly the boundary the chip row applies; an open turn
shows its produced-so-far live) and published session-scoped by the
「工作区文档」 capsule, never parsing conversation prose and never
dressing an earlier turn's outputs up as current — and 「最近阅读」 lists
this session's recently read documents from the reading record, recency
first, a few recognizable rows (capped) with name and necessary path so
same-name documents stay apart. Opening either rides the same
leave-guarded open path with a fresh read; a moved or deleted document
lands on the normal failure state with the way back to browsing; empty
sources hide their section; and the 「继续阅读」 entry keeps its own
explicit seat and meaning beside them. Quick entries, continue-reading,
tree and results share the scroll region; searching hides the quick sections
and continue-reading entry, and clearing restores them with the tree. The
filename and parent path have independent lines (parent context at most two
lines); full raw paths remain available on hover and keyboard focus. Only
the owning session selector's known cwd may shorten a path for display;
opening, saving and reading-record keys keep their original identities.
The rendered body centers on a 760px reading measure (940px when maximized),
with more outer space when maximized. The shared MarkdownText primitive
owns font size, line height, paragraph and heading margins at every width;
there are no maximum-mode paragraph overrides. Long tables and code blocks
scroll inside their own regions, and the header's necessary actions stay
reachable at every width. The browse area opens with a continue-reading
entry (#28): when the session's reading record names a document, one
explicit button — keyboard-focusable, bilingual, outside the header —
offers it by name and path; a click opens that target through the same
leave-intent entry (unsaved guard included) and lands on the restored
position, while the 「工作区文档」 capsule keeps its own meaning of
entering workspace browsing. No record, no entry; an unreadable target
states the failure with the way back to browsing, and nothing ever
auto-opens. The browse face
silently revalidates every expanded directory on re-entry (and from its
refresh button): fresh listings replace current ones, a failed refresh
changes nothing. After the platform renderer settles the document, a diagram
pass enhances mermaid code blocks inside the panel's own rendered subtree —
the block banner stays (copy keeps the source), the code hides, mermaid's
SVG shows; every failure falls back to the plain code block with a one-line
note, and the pass is refused wholesale when rendered blocks and source
fences disagree in count.

## Plugin form and topology

One published package `@benz-ai-x/dsh-md-preview`, Cordis plugin name
`md-preview`, with two faces:

- **Host half** (`src/index.ts` → `lib/index.js`): namespace function plugin
  registering `MdPreviewService` (a `TypertRemoteService`, service key
  `mdPreview`, namespace `mdPreview`) exposing
  `read(sessionId, path, signal)`,
  `write(sessionId, path, content, fingerprint | force, signal)`,
  `list(sessionId, path, signal)`, and
  `search(sessionId, query, signal)`.
- **Client half** (`src/client/index.ts` → `lib/client.js`): browser bundle
  in the DSH lazy-CJS factory protocol (minified); mounts the hand-maintained
  Remote contribution (`src/typert/remote-client.ts` →
  `lib/typert/remote-client.js`, also exported as `./remote`), then registers
  three Slot contributions: `shell.overlay` (list, id `md-preview`, the
  docked panel), `conversation.chat.turnTail` (chain, order -100, claims
  markdown-bearing turns), and `conversation.chat.assistant-actions`
  (list, id `md-preview`). CodeMirror 6 (curated extension set — line
  numbers, history, the search panel, and the GFM grammar assembled directly
  from `@lezer/markdown` to avoid `lang-markdown`'s static html/css/js
  chain) is a build-time devDependency inlined into the client bundle, as is
  mermaid (dynamic-import inlined but lazily evaluated: the diagram pass
  only pays mermaid's parse cost when a document actually carries a mermaid
  block; the client bundle grows to ~3.9 MB minified / ~1.1 MB gzip for it).
  The panel's whole state — read lifecycle,
  edit session, guarded save — is one pure machine
  (`src/client/preview-session.ts`, `READ_STARTED` on a new target being the
  single full reset) behind the effectful adapter
  `src/client/use-preview-session.ts`; the unsaved guard itself is a
  leave-intent seat (`src/client/leave-intent.ts`) shared by every plugin
  outlet and executed only by the panel. The 「工作区文档」 capsule is the
  plugin's always-mounted session-scoped seat
  that derives the newest turn's previewable produced documents from the
  binding's chat facts and publishes them (a deduped snapshot store) for
  the root-scoped panel's quick entries. The
  component renders and owns only
  geometry and locale. The outline (`src/client/outline.ts`) and the diagram
  pass (`src/client/diagrams.ts`) are UI-local modules over the settled
  document — no service state involved.

Service dependencies:

- Host: `inject = ['fs', 'typert', 'sessions']` — read/write authority via
  `ctx.fs`, Gateway publication via `ctx.typert`, workspace root via
  `ctx.sessions.get(id).header.cwd`. Runtime peer: only
  `@deepseek-ai/dsh-typert-protocol` (the sole external import of the host
  bundle; cordis arrives type-only through the Loader, and the browser-side
  platform modules come from the shell's frozen module table, so neither
  belongs in peerDependencies).
- Client: `inject = ['remote', 'slots', 'locale']`; the UI fiber additionally
  waits for the mounted `remote.mdPreview` namespace.

## Authority and failure codes

The Host owns the read and write decisions. Paths are resolved against the
session's workspace `cwd`, must stay inside it (`ctx.fs.contains`), carry an
allowed extension, and stay under `maxBytes` (which caps both the read size
and the written content length). Writes additionally target an existing
regular file and carry either the backing read's fingerprint (the fs
service's opaque `FsVersion` from `stat`, passed back through
`writeText`'s `replaceIfVersion` guard) or an explicit `force`. The write
passes an explicit per-call sandbox policy (`workspace-write` rooted at the
session cwd, mirroring the tool layer's mutating-tool convention); a
confined backend otherwise fences against its global standing root, which is
not the session workspace, and `FS_SANDBOX_DENIED` maps to
`md-preview/forbidden`. Stable
failure codes (declared in `RemoteErrorDetailsMap`, thrown as `RemoteError`):
`md-preview/bad-request`, `md-preview/unknown-session`,
`md-preview/no-workspace`, `md-preview/unsupported-extension`,
`md-preview/forbidden`, `md-preview/not-found`, `md-preview/too-large`,
`md-preview/conflict` (stale fingerprint without force; the fs layer's
`FS_STALE_VERSION` mapped verbatim), `md-preview/unavailable`. Caller
cancellation propagates through resolve/stat/read/write and is never mapped
to a business failure.

`search` traverses the session workspace through the same authority chain
(session → cwd → root resolve → containment) as a breadth-first walk over
directory listings: entries stay inside the workspace (`ctx.fs.contains`),
revisiting link targets is deduped by resolved path so links cannot loop or
widen the walk, no file body is ever read, and the walk carries bounds —
`searchConcurrency` parallel listings at a time (default 8), at most
`searchMaxDirectories` directories admitted (default 2000), at most
`searchMaxResults` matches returned (default 200; measured basis: real DSH
agent workspaces hold tens to low hundreds of documents and shallow trees, so
the defaults only bind pathological workspaces). First-version matching is a
case-insensitive substring test on entry names, restricted to the previewable
extension union. The answer carries `complete` plus `limits` —
`directory-failure` when a listing failed, `traversal-limit` /
`result-limit` when a bound stopped the walk — and the client renders
"no results" only from a complete answer.

The client passes the session identity explicitly as the first business
argument (the `goals/*` direct calling convention) rather than relying on the
agent Context scope, because the panel and actions call from root-scoped
contexts.

## Authoritative state

- File content is workspace truth; every panel open re-reads through the
  Remote (no client cache), and every successful save re-reads before
  returning to the rendered view. A manual retry re-runs the read for the
  same target. Re-setting the preview target to the document already
  showing (same session, same resolved path) resets nothing — no re-read, no
  new edit session, no reading-position loss.
- The preview target (`{sessionId, path} | null`), the editor draft, the
  pending leave intent, and the
  conflict prompts are UI-local viewing state; the draft never
  reaches the workspace except through an explicit guarded `write`. The
  panel's dragged width persists across opens (360–1200px, further clamped
  to the live viewport); without a manual width it derives from half the
  viewport up to 720px. The target itself resets per open. The reading
  record (positions only, keyed by session and workspace path) is likewise
  UI-local viewing state persisted through browser storage with version,
  validity checks, and bounded cleanup. Session data, turn membership,
  and deliverables vocabulary stay in their owning services.

## Cancellation and disposal

- Panel target changes and unmount abort the in-flight read via the
  transport-carried AbortSignal; a target change or panel close during a
  save aborts it the same way. Every read-effect run opens a new epoch, and
  a read or save outcome may only land while its issuing epoch still owns
  the session — an approved close, a switch, or dispose therefore drops
  late responses before they can touch the successor document, its prompts,
  errors, or save state. Cancellation is never surfaced as a business
  failure; a transport rejection maps to `md-preview/unavailable`. Nothing
  promises to undo a write that already landed atomically.
- Client disposal: the mount disposer removes the UI fiber (slot entries,
  locale dictionary) then unmounts the Remote namespace; a failed UI
  registration rolls back the Remote mount. Collapsing a declaring owner
  (e.g. ui-chat's turn-tail node) removes only that slot's contribution.

## Configuration

`maxBytes` (default 1048576, caps reads and writes), `allowedExtensions`
(default `[".md", ".markdown"]`), `previewExtensions` (default
`[".md", ".markdown", ".txt"]`), and the workspace search bounds
`searchMaxResults` (default 200), `searchMaxDirectories` (default 2000),
`searchConcurrency` (default 8) — validated by the schemastery `Config`
twin during load; defaults live in the schema.

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
- The outline lists ATX headings only: setext (underlined) headings appear
  in the rendered document but not in the popover, and heading text is
  matched against the rendered DOM by normalized text with occurrence
  ordering (inlines that alter text can miss their target).
- The diagram pass keys on order parity between source fences and rendered
  `.md-code-block`s: any document mixing indented code blocks with fenced
  ones refuses the pass wholesale, mermaid renders with its default theme,
  and only fenced ` ```mermaid ` blocks qualify.
- Workspace search matches document **names** (case-insensitive substring,
  first-version semantics): directory names never match, and same-name
  results are told apart only by the rendered workspace-relative path.
- Documents read without ever scrolling leave no reading record (the record
  is position facts, not an access log), so they never appear in 「最近阅读」;
  a dead record holds the 「继续阅读」 seat until a later read replaces it
  (opening it then lands on the normal failure state with the way back).
