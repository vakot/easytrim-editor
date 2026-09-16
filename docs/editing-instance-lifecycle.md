# Editing instance lifecycle

`editingInstances` owns the session's editing drafts and captured export attempts. Each imported
or restored draft receives a generated ID. Multiple drafts may reference the same source path;
the path identifies a shared file for native reservations and availability, not an editing draft.

## State ownership

An editing instance holds its current snapshot, media descriptor, optimized settings and arguments,
source availability, and export attempts. `draftAvailable` controls whether it appears in Imported
Sources; an omitted value means the draft is available. Queuing an export sets it to `false`.
The entity remains in Redux so queued work and historical results retain stable identities.

Each export attempt captures a cloned request, snapshot, output selection, route, metrics, and
lifecycle state. An instance may own multiple attempts, and queue selectors inspect all attempts.
The runtime indexes jobs by `attemptId`, carries `instanceId` for Redux updates, and executes one
native export at a time. Each queued job holds its own source reservation.

## Queue and restore transitions

1. Import a source to create an editable draft with a generated ID.
2. Capture its snapshot and export request, choose an output, and reserve the source.
3. Enqueue the attempt, hide the draft from Imported Sources, and clear the active editor.
4. Render the captured request independently of other drafts referencing the same file.
5. Retain terminal attempts as session history; completion does not reopen the draft.

Clicking a pending export removes that job from the runtime before asynchronous source activation.
Its queued attempt is consumed, and a new editing instance receives the captured snapshot and
optimized settings. Existing drafts remain intact. Failure to activate the source leaves the
restored draft available with its error rather than losing the snapshot.

Rendering attempts cannot be restored. Historical restoration uses the same thunk but retains the
original terminal attempt, allowing repeated restoration into independent drafts. History has no
dedicated UI yet. Re-exporting a restored draft creates a new attempt and repeats the queue flow.
Restoration from the compact queue window returns to the main editor.

## Resources and concurrency

Source/operation IDs and load tokens reject stale callbacks. Restoration removes pending jobs
synchronously so a concurrent queue start cannot render the consumed attempt. Pending withdrawal
releases only that job's reservation and does not run a queue-finish action when it empties the queue.
Closing an instance cancels its jobs and awaits cleanup before removing the entity.

Source deletion and restoration update every instance referencing the same canonical file path.
Manual deletion is blocked while any attempt uses the file. Automatic deletion after export also
respects editable drafts, including newly restored drafts. Successful outputs are never removed by
snapshot restoration or job cleanup.

The existing native request DTOs and source reservation counter are unchanged. Editing instances,
attempts, history, and runtime jobs remain session-only and are excluded from persisted preferences.
