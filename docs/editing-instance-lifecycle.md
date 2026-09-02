# Editing instance lifecycle

EasyTrim has one canonical in-memory collection of editing instances. An instance is created at
import (or by an explicit duplicate operation), receives a stable `instanceId`, and remains the
owner of its current editor snapshot and export-attempt history until it is explicitly closed.
Exporting never promotes, replaces, or creates another instance.

## Migration contract table

| Current contract | New responsibility | Required change |
| --- | --- | --- |
| Imported items and export queue items are separate records | `EditingInstance` owns source, current snapshot, media descriptor, settings, and attempts | Remove the imported/exported union and promotion path |
| Queue item ID is reused as a UI/runtime identity | `instanceId`, `attemptId`, native `operationId`, and `outputId` are distinct tracing keys | Carry all keys through Redux, runtime jobs, diagnostics, and callbacks |
| Export request reads mutable editor state while work runs | `ExportAttempt` captures an immutable request and `EditorSnapshot` at launch | Render only from the captured attempt |
| History restore forks a new imported item | Restore hydrates the selected instance | Do not create a history fork or change the instance ID |
| Source deletion is attached to one queue record | Source availability is keyed by canonical source path | Update every instance sharing that path; keep instances open |
| Close means clearing the currently loaded source | Close is instance lifecycle | Cancel that instance's native jobs, await cleanup, then remove only that instance |
| Imported and export queues are navigation surfaces | SourceTree is the sole instance navigator | Render folders by source path and leaves by `instanceId`; keep actions separate |
| Runtime jobs are Redux queue records | Runtime owns native handles and job cleanup; Redux owns serializable status | Keep runtime maps keyed by `attemptId` and make cancellation idempotent |
| Redux persistence can be confused with session recovery | Editing instances, attempts, media descriptors, and runtime state are session-only | Keep them outside the persistence allow-list |

## Canonical state

`editingInstances.ids/entities` is the only collection of open instances. Each entity contains:

- `id` and `origin` (`source-import` or `duplicate`);
- the current `EditorSnapshot`, which may continue changing while an export runs;
- optional inspected media and optimized settings;
- source availability (`available`, `deleted`, or `missing`);
- append-only export attempts until terminal history is cleared.

An attempt contains its own cloned request, snapshot, output selection, route, metrics, and
discriminated lifecycle state. A single instance may have at most one queued or rendering attempt.
Terminal attempts remain addressable for status, retry, and output history. Clearing history removes
terminal attempts only; it never removes the instance.

## Lifecycle and async guards

The launch flow is:

1. Read the active instance and transient working editor state.
2. Capture the request and snapshot before opening the output picker.
3. Re-check the active instance, source path, and readiness after the picker returns.
4. Reserve the source, create a new `attemptId`, and enqueue the captured attempt.
5. Runtime assigns/observes the native `operationId`, reports progress by `(instanceId, attemptId)`,
   and stores the terminal `ExportResult` with its `outputId`.

The active instance does not change during launch or rendering. A later edit updates only the
instance's current snapshot, never the captured attempt. A retry or re-export creates a new
`attemptId`; stale progress, completion, failure, and `finally` paths cannot mutate that new
attempt. Closing an instance awaits runtime cancellation and source-release cleanup before its
entity is removed.

## Source and navigation rules

Deleting a source moves the file to the native trash/recovery boundary and marks all matching
instances unavailable. Restoring the source marks all matching instances available again. Closing
one instance does not delete its source, close another instance, or erase their histories. SourceTree
uses `instanceId` as the leaf key, so two instances of the same source remain distinct.

The native wire contracts remain unchanged by this frontend migration: FFmpeg/FFprobe adapters
still receive the existing task-specific request DTOs. The new instance and attempt IDs are
frontend/runtime correlation keys passed only through the existing operation-aware adapter calls.
