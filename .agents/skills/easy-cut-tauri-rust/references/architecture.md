# Native architecture contract

Read this reference before creating or materially changing the Tauri command surface or runtime state.

Repository-wide module ownership and dependency direction live in the [structure rule](../../../rules/structure.md). Path/process authority, capabilities, temporary files, persistence, and binary provenance live in the [runtime and security rule](../../../rules/security-runtime.md). Native checks live in the [quality rule](../../../rules/quality.md).

## Initial command contract

Use typed requests and results. Names may evolve, but responsibilities stay narrow:

```text
choose_source() -> SourceSelection
inspect_media(source_id) -> MediaInfo
prepare_preview(source_id, width) -> PreviewInfo
prepare_waveforms(source_id, stream_indexes, width) -> WaveformInfo[]
cancel_source_tasks(source_id) -> CancelResult
render_fast(request, progress_channel) -> OperationResult
render_optimized(request, progress_channel) -> OperationResult
cancel_operation(operation_id) -> CancelResult
```

Prefer one command invocation that owns an operation through completion while streaming progress through a channel. If a command returns immediately, define exactly one registry owner for background tasks and child handles.

The native picker and native window drag/drop handler canonicalize and register the selected path. Frontend code receives only a source ID and display filename; later commands resolve the path from in-memory native state.

## Core DTO rules

- Serialize timestamps as integer microseconds.
- Serialize frame rates as numerator/denominator plus an optional display value.
- Preserve FFprobe global stream indexes.
- Give every imported source and long-running operation an opaque runtime ID.
- Include source/operation IDs in asynchronous progress and completion payloads.
- Use discriminated error codes with a human message and optional bounded diagnostics.

Use these error categories unless a concrete new category is needed:

```text
invalid_request
source_replaced
unsupported_media
probe_failed
preview_failed
render_failed
cancelled
output_conflict
encoder_unavailable
io_failed
internal
```

## Session invariants

- Exactly zero or one source is active.
- Replacing a source invalidates its trim/audio state and all source-bound helper results.
- Runtime named presets survive source replacement but not application restart.
- At most one final export runs in the MVP.
- Concurrent proxy/waveform work must use cancellation and stale source/job ID guards.
- A failed replacement remains the failed new import; never restore the previous source.
- Successful user-selected output is never temporary and is never deleted by cleanup.

## Progress and completion

- Emit ordered progress with phase, processed duration, total duration, speed, percentage when known, and terminal state.
- Do not infer success from 100% progress.
- Require a successful child exit and the expected verified output.
- Emit exactly one terminal result for success, failure, or cancellation.
