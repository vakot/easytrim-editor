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

## Operations and recovery

`diagnostics.startOperation()` creates the ID, records start time, registers the operation, and
emits `.started`. `complete`, `fail`, and `cancel` calculate duration, emit exactly one terminal
event, and remove the operation. `child` automatically attaches the parent ID. Duplicate terminal
calls are ignored and return `false`.

Rust also rebuilds the active-operation registry from persisted start and terminal events. An
abnormal-session report can therefore list operations that never reached a terminal state even
after all frontend memory has been lost.

The frontend sends a heartbeat every five seconds. Rust records the latest timestamp separately
and emits only missed/recovered threshold events, avoiding noisy healthy heartbeat lines. This can
detect a stalled webview while native code still progresses. It cannot guarantee detection when
the entire process or runtime is frozen.

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

## Phase 2 integration guide

Record intent before dispatching existing business logic:

```ts
diagnostics.action("playback.play.requested", {
  type: "hotkey",
  id: "Space",
});
```

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
