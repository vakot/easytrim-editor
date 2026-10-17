# Workspace History foundation

`apps/desktop/src/domain/workspace-history.ts` is the public, framework-independent API. The app
store integration lives in `apps/desktop/src/app/store/integration/workspace-history.ts`. The
timeline is runtime-only Redux state and is excluded from persistence. There is no Activity Feed,
diagnostic, History UI, storage, or native dependency.

## Editor operations

The editor's existing reducers remain the source of truth. One app listener observes committed
edit actions for trim, crop, rotation, flips, audio track settings, and chapters. It compares
canonical editor projections before and after each action, so analysis results, waveform URLs,
playback, preview, and other runtime state never enter history. Audio entries are scoped to a
stream and chapter entries to a chapter ID, keeping unrelated tracks and chapters out of a change.

Trim drag and chapter-range drag share `useTimelineRangeEditing`; trim and crop drag start and end
explicit operation groups at their existing pointer boundaries. Standalone keyboard trim steps and
rotation commands with the same label coalesce when consecutive dispatches are within 500 ms.
Audio volume already dispatches once on slider release, so it produces one operation at commit.

`undoWorkspaceHistory`, `redoWorkspaceHistory`, and `applyHistoryPosition` preflight all state
changes against the current target snapshots. They replay through the original trim, crop,
transform, audio, and chapter actions. This retains trim-dependent audio analysis invalidation,
filter waveform invalidation, transform resolution updates, and instance snapshot synchronization.
Inactive instances receive snapshot updates directly, while their runtime caches remain unloaded.
A mismatch rejects the requested transition without moving the cursor. These editor operations are
synchronous; external operations remain unavailable until a future integration supplies
transactional apply and rollback.

## Ownership and capture

Create one `WorkspaceHistory` coordinator for the workspace, never one per Editing Instance.
The coordinator owns the committed timeline and cursor; existing editor state remains authoritative.
The existing editor state remains canonical. The app store owns one workspace history timeline;
the editor does not own per-instance history logs.

Operation metadata is caller-supplied: use a stable unique ID, a descriptive label, and a finite
Unix timestamp in milliseconds. Instance targets carry both an instance ID and source ID.
Two instances referencing the same file remain separate targets; file paths are not identities.

Use `identifyHistoryChanges(target, before, after)` on an explicit projection of durable fields.
Field names are opaque keys, not executable property paths. Project nested settings as individual
fields when fine-grained tracking is needed; arrays and object-valued fields are atomic values.
Missing fields use `{ present: false }`, distinct from a present `null`. Undefined, non-finite
numbers, functions, cycles, class instances, buffers, and other non-JSON resources are rejected.
Structural equality ignores object key order. Values are copied on entry and exit.

`record` describes an operation already committed by business logic; it does not execute edits.
`begin` / `capture` / `end` defines an explicit continuous-interaction boundary. Capture consecutive
projected changes, possibly across several targets. Repeated fields retain their first before and
last after values, and net no-ops disappear. Discontinuous repeated changes are rejected.
Finish the boundary even when the interaction returns to its original value; `end` then returns false.
Open groups block navigation and independent recording. There is no timer-based grouping.

## Replay contract

Position zero is the baseline; position N means the first N operations have been applied.
`undo`, `redo`, and `goTo` submit a `HistoryTransition` to the supplied adapter. Steps are ordered
in replay order, descending for undo and ascending for redo. For a state operation, undo expects
`after` and writes `before`; redo expects `before` and writes `after`. Apply all fields in an
operation atomically. Never resolve identities by physical path or the currently active source.

The adapter must validate the entire plan and apply it transactionally. Return true only after
all steps succeed. On false or rejection/throw, leave business state unchanged (or compensate any
partial external effects before settling). The engine cannot roll back filesystem effects.
External operations identify an adapter handler with `type` and serializable `payload`; the handler
must support both directions, preflight availability/permissions, and provide rollback or an
atomic native transaction. Unknown handlers or unavailable sources must reject the transition.
Do not record irreversible side effects as external reversible operations.

While awaiting the adapter, the cursor remains at its original position. Recording/capture from
replay is suppressed; concurrent navigation and operation boundaries are rejected. Success alone
advances the cursor. Errors propagate to the caller, and the lock is released on every outcome.
The adapter must prevent conflicting application edits during replay; this engine is not a store
middleware and cannot intercept unrelated application mutations.

State operations have `edit` or `navigation` roles. Source switching can be represented with a
workspace target and navigation role. Ordinary Undo/Redo seeks the next meaningful edit/external
operation and includes any intervening navigation steps without requiring extra key presses.
Informational operations never invoke a replay handler and cannot reverse external effects.
Direct navigation can select every position, including positions containing only information.
Recording a nonempty operation at a past position replaces the future branch; no-op recording
preserves it. Ordinary Undo/Redo at an endpoint returns false.

## Recovery boundary

`snapshot()` produces an isolated version-1 JSON document containing committed entries and the
selected position, including the redo branch. `new WorkspaceHistory(parsedDocument)` validates
and restores this document; it does not apply it to editor state. Recovery must separately restore
a matching workspace baseline/current durable state and stable identities before enabling replay.
Never persist an open group or in-flight transition as a committed workspace state. There are no
persistence side effects, filesystem operations, or recovery integrations in this stage.
