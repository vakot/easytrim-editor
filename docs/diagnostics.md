# Diagnostics architecture

EasyTrim diagnostics are a lightweight causal trace of application behavior. They exist primarily
for failures where cleanup code may never run: UI hangs, native panics, Task Manager termination,
and OS termination. Important events are therefore written during the session instead of being
assembled only after a failure.

## Architecture decisions

Rust owns the diagnostics session, filesystem layout, JSONL writer, rotation, retention, heartbeat
state, report generation, panic hook, and platform file reveal. This keeps filesystem and process
authority behind narrow Tauri commands. The frontend owns semantic event helpers and operation
objects; it never receives an arbitrary diagnostics path that it can open. `Show Report` sends an
opaque report ID back to Rust, which resolves only the report detected at startup.

The canonical store is JSON Lines. Each event is flushed after it is appended so forced termination
loses at most an event whose IPC call had not reached Rust. A session log rotates at 5 MiB. Eight
recent runtime sessions and ten abnormal-session report directories are retained. Reports contain a
human-readable `report.log`, structured `report.json`, and `session.json`.

The Activity Feed is a curated UI projection of this diagnostic event journal, not a separate log.
User-facing activity is not recorded or persisted independently. It renders the in-memory current
session immediately, then loads metadata and normalized events for every retained session through
narrow diagnostics commands. Live and retained events enter the same `DiagnosticEvent[]` projection
and presentation pipeline, preserving their original session IDs and timestamps. Activity history
is organized by diagnostics session: the current session is visually separated from retained
sessions, and retained sessions produced by a different known application version are identified
using their recorded diagnostics metadata. History follows the diagnostics retention limit of eight
runtime sessions.

Rust discovers exact `session-<id>.<segment>.jsonl` files and owns all path resolution and JSONL
parsing. The active session is excluded natively and again at the frontend boundary. Invalid session
IDs, malformed or partial JSONL lines, mismatched events, missing files, and unreadable retained
sessions cannot grant arbitrary filesystem access or prevent the rest of the feed from loading. The
frontend caches one asynchronous history load per application runtime and does not emit diagnostic
events while reading diagnostics.

The Activity Feed derives each export lifecycle row from the append-only `ffmpeg.export.started`
event and its matching completion, failure, or cancellation event using the diagnostic operation
ID. The row retains its start time and position as its terminal state arrives. A start without a
terminal event is pending only in the current session; retained starts are shown as interrupted.
Historical export entries may retain their `Open` action because it is a normal file-location
request and can fail safely if the output no longer exists. A historical delete never receives a
`Restore` action: restore remains available only when the event belongs to the active session and
the current Redux export queue still contains authoritative restorable state for that target.
Diagnostics history is event history, not reconstructed application state.

`report.log` renders each event as a compact multi-line entry. Origin, snapshot, operation,
parent-operation, result, duration, and bounded data fields are included when present so the file
opened from the recovery dialog retains the same causal relationships as JSONL.

Event writes intentionally flush synchronously on the native side for Phase 1 reliability. Phase 2
must performance-test the diagnostics path under rapid timeline seeking, playhead dragging, media
lifecycle bursts, and snapshot switching before high-frequency instrumentation is accepted.

Session metadata is written before the UI starts. Normal native application exit writes
`app.session.completed`, flushes the log, and atomically marks the session graceful. A stale or
corrupt marker is handled on the next launch and classified truthfully as `abnormal_shutdown`
unless persisted evidence supports `frontend_fatal_error` or `native_panic`.

## Event model

The causal model is:

```text
user intent -> semantic action -> operation -> child operations
            -> state transitions -> completion / cancellation / failure
```

Events use `<domain>.<action>.<state>`, lower-case machine-readable names, for example
`source.open.requested`, `preview.prepare.started`, and `preview.prepare.completed`. Messages for
display belong in the UI, not event names.

Every event has a native timestamp and session ID plus a level, category, and event name. Optional
fields include origin, operation and parent-operation IDs, snapshot ID, result, duration, and a
small whitelisted data object. Production tracing keeps semantic `info` events; `trace` and `debug`
remain available for focused low-level context.

Origins describe the surface that requested one semantic action:

```ts
{ type: "button", id: "preview.playback-toggle" }
{ type: "hotkey", id: "Space" }
{ type: "menu", id: "file.open" }
{ type: "timeline", id: "playhead" }
```

Other canonical origin types are `system`, `restore`, and `internal`. Origin does not replace or
duplicate the domain action.

`diagnostics.action()` records user intent with origin and optional data only. A requested action
does not receive an operation result. `result: "started"` belongs exclusively to the `.started`
event emitted by `diagnostics.startOperation()`.

## Operations and recovery

`diagnostics.startOperation()` creates the ID, records start time, registers the operation, and
emits `.started`. `complete`, `fail`, and `cancel` calculate duration, emit exactly one terminal
event, and remove the operation. `child` automatically attaches the parent ID. Duplicate terminal
calls are ignored and return `false`.

The persisted event stream is the authoritative source for abnormal-session recovery. Frontend
active operations exist only for runtime ergonomics, and the native in-memory registry exists only
for live diagnostics. Neither registry survives termination and neither is persisted as mutable
state. Report generation always reconstructs unfinished operations from persisted start and
terminal events, so it remains valid after all process memory has been lost.

The frontend sends a heartbeat every five seconds. Rust atomically replaces a small heartbeat state
file containing `lastUiHeartbeatAt` and emits only missed/recovered threshold events, avoiding noisy
healthy heartbeat lines. Reports keep that actual timestamp distinct from `lastHeartbeatEvent`,
which is only the latest `ui.heartbeat.missed` or `ui.heartbeat.recovered` event. This can detect a
stalled webview while native code still progresses. It cannot guarantee detection when the entire
process or runtime is frozen.

On Windows, heartbeat/session JSON replacement uses `MoveFileExW` with replace-existing and
write-through flags after the temporary file is fully written and synchronized. A heartbeat write
failure never fails the heartbeat command or the application; Rust emits one fallback error per
degraded period and clears the degraded state after a successful write.

## What to log

Phase 2 instrumentation should cover:

- user intent and its origin;
- semantic domain actions and state transitions;
- async start/completion/failure/cancellation with duration;
- meaningful Tauri, filesystem, FFmpeg, and FFprobe boundaries;
- media and native-audio lifecycle events;
- ignored or rejected actions with a bounded reason;
- warnings, errors, and fatal events.

An intentionally ignored action must remain visible, such as `playback.play.ignored` with
`reason: "preview_not_ready"`. Do not log routine renders, hook execution, selector recalculation,
frame-by-frame progress, local variable changes, every Redux action, or complete Redux state.

## Privacy and sanitization

Diagnostic context is opt-in and bounded: at most 32 keys/items, three nested levels, 2,048
characters per string, and a bounded error stack. Keys resembling tokens, passwords, secrets,
credentials, or authorization are removed natively. Never pass arbitrary application objects,
environment data, process output, binary media, or Redux state to diagnostics.

Source paths can be valuable but are private. Prefer opaque source IDs and display names. Include
an absolute path only when it is necessary to identify a failed application-level filesystem
operation; never include it in broad tracing or custom FFmpeg arguments.

Frontend persistence failures are detached from application control flow. The first failure in a
degraded period emits `[diagnostics] Persistent diagnostics unavailable` through `console.error`
without attempting to log that failure recursively. Further failures are suppressed until a
successful persistence call resets the degraded state.

## Phase 2 integration guide

Record intent before dispatching existing business logic:

```ts
diagnostics.action("playback.play.requested", {
  type: "hotkey",
  id: "Space",
});
```

The emitted intent contains no `result`; start/terminal results are added only by operation helpers.

Record guards rather than silently returning:

```ts
diagnostics.event("playback.play.ignored", {
  origin,
  result: "ignored",
  data: { reason: "preview_not_ready" },
});
```

Trace async work without manually creating IDs or timestamps:

```ts
const operation = diagnostics.startOperation("preview.prepare", {
  origin,
  snapshotId,
  data: { sourceId },
});

try {
  const mediaLoad = operation.child("preview.media-load");
  await loadPreview();
  mediaLoad.complete();
  operation.complete({ previewKind: "direct" });
} catch (error) {
  operation.fail(error);
}
```

Use `operation.event()` for meaningful intermediate state and `diagnostics.error()` for a
recoverable error outside an operation. Use `diagnostics.fatal()` only for errors that terminate a
frontend execution boundary. Global `error`, `unhandledrejection`, React Error Boundary, and Rust
panic capture are already installed.

Keep instrumentation at the semantic boundary: reuse the same domain action from button, hotkey,
menu, and timeline surfaces, changing only `origin`. Do not duplicate product behavior to make a
trace.

## Phase 2 event catalogue

The current application integration records these high-value boundaries:

| Area                 | Representative events                                                                                    | Context                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Source and snapshots | `source.import.requested`, `source.open.started`, `source.prepare.started`, `snapshot.active.changed`    | source display name, opaque queue/snapshot ID, load status |
| Preview and media    | `preview.state.changed`, `preview.proxy.started`, `media.source.changed`, `media.playback.failed`        | preview kind and bounded failure code                      |
| Timeline and crop    | `timeline.seek.started`, `timeline.seek.completed`, `timeline.trim-boundary.changed`, `crop.tool.opened` | micros, boundary, and crop state                           |
| Audio and waveform   | `audio.track.changed`, `audio.master.changed`, `audio.preview.state.changed`, `waveform.state.changed`   | stream index, volume, job ID, width                        |
| Export               | `export.request.start`, `export.prepare.started`, `ffmpeg.export.started`, `ffmpeg.progress.reported`    | route, queue item, snapshot, sampled percent               |
| Guards and cleanup   | `*.ignored`, `*.cancelled`, `source.file.delete.failed`, `export.launch.failed`                          | bounded reason and normalized error                        |

Export progress is sampled at the first report, every ten percentage points, and completion. Time
update, selector, Redux-action, and other high-frequency UI activity is intentionally not traced.
All async operations use the operation helper and terminate as success, failure, or cancellation.
Source replacement and user cancellation paths are represented. Native FFmpeg events retain their
runtime operation ID and link to the frontend export operation through `parentOperationId`.
