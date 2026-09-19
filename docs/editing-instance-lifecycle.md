# Editing instance lifecycle

`editingInstances` owns the session's editing drafts and captured export attempts. Each imported
or restored draft receives a generated ID. Multiple drafts may reference the same source path;
the path identifies a shared file for native reservations and availability, not an editing draft.

## State ownership

An editing instance holds its current snapshot, media descriptor, optimized settings and arguments,
source availability, and export attempts. `draftAvailable` controls whether it appears in Imported
Sources; an omitted value means the draft is available. Queuing an export keeps the draft available
and active, with all current transformations intact. Later edits affect only the draft, while queued
work and historical results retain their captured snapshots and stable identities.

Each export attempt captures a cloned request, snapshot, output selection, route, metrics, and
lifecycle state. An instance may own multiple attempts, and queue selectors inspect all attempts.
The runtime indexes jobs by `attemptId`, carries `instanceId` for Redux updates, and executes one
native export at a time. Each queued job holds its own source reservation.

The export slice owns session-only `startedSourceIds`, keyed by editing-instance ID.
Source-list actions and auto-start enable only that instance. The runtime reads this state
when selecting the next eligible job, skipping paused sources without changing their order.
Starting another source enables its queue to run when the current native export releases the
renderer; it does not introduce parallel FFmpeg exports.

Cancel on a source pauses its queue and stops its active export, if any. Once the native
operation settles, the same attempt returns to queued with reset progress, the same captured
snapshot and position, and its source reservation intact. Other started sources continue.
Completing, failing, canceling, or restoring the last processable attempt clears only that
source's started state. Closing a draft does not stop its exports.

## Queue and restore transitions

1. Import a source to create an editable draft with a generated ID.
2. Capture its snapshot and export request, choose an output, and reserve the source.
3. Enqueue the attempt while keeping the draft in Imported Sources and the active editor.
4. Render the captured request independently of other drafts referencing the same file.
5. Retain terminal attempts as session history; completion leaves the editable draft in place.

Clicking a pending export removes that job from the runtime before asynchronous source activation.
Its queued attempt is consumed, and a new editing instance receives the captured snapshot and
optimized settings. Existing drafts remain intact. Failure to activate the source leaves the
restored draft available with its error rather than losing the snapshot.

Rendering attempts cannot be restored. Historical restoration uses the same thunk but retains the
original terminal attempt, allowing repeated restoration into independent drafts. History has no
dedicated UI yet. Re-exporting a restored draft creates a new attempt and repeats the queue flow.
The deprecated compact queue window and standalone export queue panel have been removed.

## Resources and concurrency

Source/operation IDs and load tokens reject stale callbacks. Restoration removes pending jobs
synchronously so a concurrent queue start cannot render the consumed attempt. Pending withdrawal
releases only that job's reservation and does not run a queue-finish action when it empties the queue.
Closing an instance without queued or rendering exports removes the entity. If it owns queued or
rendering exports, closing only hides the draft; the queue owner remains available to the independent
export runtime until those jobs reach a terminal state.

Source deletion and restoration update every instance referencing the same canonical file path.
Manual deletion is blocked while any attempt uses the file. Automatic deletion after a successful
export waits until no queued or running export still needs that source, across all editing instances.
Retained imported drafts do not block automatic deletion and are marked deleted along with history.
Successful outputs are never removed by
snapshot restoration or job cleanup.

The queue runtime owns releasing native source reservations after terminal completion, failure,
cancellation, or pending withdrawal. Native render commands no longer release them on return:
a source-level stop retains the same reservation for retry. Settled progress callbacks are ignored.

Title-bar controls retain their global scope for now: Start enables all current processable source
queues, Skip cancels the active attempt, and Cancel cancels all active and pending attempts after
confirmation. Queue-finish actions still wait until all jobs are gone, including paused jobs.
Possible follow-ups are explicit Start all / Stop all / Clear all controls, a selected-source scope
in the menu, or keeping only global emergency cancellation. Stop all could preserve queued
attempts; Clear all would remain a separate destructive action.

The existing native request DTOs and source reservation counter are unchanged. Editing instances,
attempts, history, and runtime jobs remain session-only and are excluded from persisted preferences.
