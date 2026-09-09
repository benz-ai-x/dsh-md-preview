# Project Contract: dsh-md-preview

The implementation baseline is [dsh-reference.lock.json](../../dsh-reference.lock.json):
Harness `0.1.5-alpha.1`, local patched commit `737e95c657a95fd04b12269313902f9b5ca2f6ca`
over official `5dda764ed3aa172535a7967b06ff95d9cbfe536a`. The public before-close API
is not in the official npm release. Missing capability causes activation rollback.

## User-visible outcome

The plugin contributes a Markdown tab kind to the official right sidebar. Official
file-tree entries, chat mentions, tool paths and produced chips route through native
file resource navigation. The retained per-message Preview Documents action derives
only its owning turn's deliverables and uses the same `fileAddressFor` utility.
Harness owns occurrence identity, tabs, split/floating layout, visibility and native
text fallback. The plugin does not replace the tree, turn-tail chain or frame.

The Markdown body uses platform MarkdownText for GFM, code and mathematics. A lazy
Mermaid pass touches only its rendered subtree, retains source on failure and abandons
DOM writes after cancellation. Edit uses CodeMirror for full source text, history,
find and formatting shortcuts. LF/CRLF and terminal newline shape are preserved.
A save freezes input, writes with the backing read's fingerprint, and re-reads before
returning to Preview. A write conflict retains the draft; force is an explicit action.
A successful write followed by a failed read is an already-saved state with a read retry.
Successful write and read completion shows a Saved status; entering the next edit
session or explicitly reloading clears that confirmation.

A native `line` navigation reveals the enclosing ATX heading in Preview. Source Line
opens the exact source line in Edit; each navigation revision is applied once per face.
Oversized Markdown offers an explicitly read-only native text tab. Its limits remain
owned by the official viewer. Failed reads/writes retain stable codes and recovery.

## State ownership and leave decisions

`markdown-documents.ts` owns an in-memory record for `(owning session, tab id)` and
checks the occurrence's AbortSignal identity. The record outlives its React body.
Draft, selection and undo/redo history survive tab/session switches and body remounts.
No body, draft, fingerprint or editor history is persisted. File identity comes from
the native resource address; file-session identity is explicitly carried to the Host.
Official metadata and changes remain external facts, not a second file-content cache.

The record's `leave-intent.ts` decision handles close, face switch and reload. Dirty
records ask Discard/Keep; the first pending intent wins. A root platform Modal can
serve hidden dirty tabs. Browser `beforeunload` warns for dirty/saving records.
Switching/hiding a live tab does not discard it or ask a destructive leave question.

The Harness patch adds `sidebarRight.beforeClose(sessionId, tabId, guard)` with a
request AbortSignal and disposable registration. Every actual layout mutation that
removes records waits for guards before committing; synchronous clean allows remain
immediate. Repeated removals retain the first request. New navigation while waiting
is not overwritten by an old layout snapshot. Refusal, throw or rejection keeps the
record. Owner/provider release cancels waiting decisions; late permission cannot
remove a successor. A saving Markdown record waits for save completion before deciding.

Record removal cancels its RPCs, guard and prompts and drops snapshots. Plugin dispose
closes admission, aborts owned work and waits for tasks before Remote unmount. Late
results cannot update a removed or successor record. An already committed filesystem
write is not undone by cancellation. Styles/listeners belong to the mount and are
removed on rollback/unload; repeated disposal releases Remote once.

## Host authority and protocol

The named Host function plugin registers `MdPreviewService`, namespace `mdPreview`.
Its explicit session RPCs remain `read/write/list/search`; hand-maintained Remote
codecs/descriptors in `src/typert/remote-client.ts` and `src/protocol.ts` remain aligned.
Plugin entrypoints have no default export. The Remote descriptor keeps its established
`TYPERT_REMOTE` default alias. Every TS Config has its same-name Standard Schema.

Paths resolve against the explicit session cwd and must pass filesystem containment.
Final-component symlinks (inside, outside or dangling) are rejected. Full reads check
pre-read size, UTF-8 byte count and post-read target/version. Writes require an existing
regular file, a configured Markdown extension and byte limit; configured extra extensions
do not grant non-Markdown writes. A detectable target/cwd change before writing is rejected.
The filesystem remains the authority for atomic `replaceIfVersion`, force and sandbox
policy (`workspace-write` rooted at the session cwd). Successful writes emit public
`fs/observed` facts without a forged tool actor; failures/cancellation emit no success.
This is not an OS-wide watcher. External metadata changes only prompt a reload, never
silently replace an open body's draft.
The current tab compares observed metadata versions with its own read fingerprint.
A shared metadata reload clearing `changed` does not acknowledge this tab's old body.

Stable `md-preview/` failures: `bad-request`, `unknown-session`, `no-workspace`,
`unsupported-extension`, `forbidden`, `not-found`, `too-large`, `conflict`, `unavailable`.
Cancellation propagates through Host work rather than becoming a business failure.

Host `list/search` are retained for deferred features. Search traverses directory
names, never bodies, with containment, resolved-target deduplication and bounded
concurrency/results/directories. Partial results carry explicit limit reasons.
`FsTarget` test fakes use `{ targetKey, displayPath }`.

## Registration and build boundary

The Client mounts Remote first, then the official `md-preview` tab type and keyed body
`sidebar.right.pane.tab`, root `shell.overlay` unsaved dialog, and the additive
`conversation.chat.assistant-actions` action. No old panel portal, header toggle,
frame width effect, duplicate tree or global single-target store remains in the
running graph. The client manifest includes the official sidebar dependency.
Feature runtime imports are prohibited; their types and public injected services are
used instead. The frozen `PLATFORM_MODULES` table is unchanged. CodeMirror/Mermaid
and non-platform dependencies are inlined under the repository's lazy-CJS factory.
Full builds remove obsolete generated declarations before producing artifacts.

## Configuration

Schema defaults: `maxBytes: 1048576`, `allowedExtensions: ['.md', '.markdown']`,
`previewExtensions: ['.md', '.markdown', '.txt']`, `searchMaxResults: 200`,
`searchMaxDirectories: 2000`, `searchConcurrency: 8`. Row patches replace the whole
config. Preview/search settings remain Host capabilities, not extra Client UI or type
registrations. Host configuration can restrict writes even when the client offers Edit.

## Deferred scope and evidence

Filename search/current-output aggregation (#57), independent outline/reading (#58),
general text (#39) and other formats are deferred. Existing reading/preference data
are not removed; those helpers and reusable search/outline code remain inactive.
The accepted [HTML isolation](../adr/0005-networked-html-preview-isolated-from-harness.md)
and [text admission](../adr/0006-text-preview-independent-of-language-recognition.md)
designs remain future work under [Spec #38](https://github.com/benz-ai-x/dsh-md-preview/issues/38).
[ADR-0007](../adr/0007-markdown-in-official-sidebar-tabs.md) supersedes the old dock adapter.

[The TDD log](../verification/official-sidebar-markdown/TDD.md) distinguishes new red/green
behavior tests, fixture corrections, automatic checks and external acceptance. #60
requires real browser evidence plus one candidate tarball installed in a clean profile,
normal public-name Host/Remote imports, configuration composition, startup, client
resource serving and removal. Neither source linking nor jsdom proves visual acceptance.
Publishing that same verified archive follows [HANDOVER](../HANDOVER.md#发布流程) separately.
