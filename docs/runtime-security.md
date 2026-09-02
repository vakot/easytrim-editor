# EasyTrim runtime and security

The native Tauri layer is the authority boundary for files, processes, media tooling, and packaged
runtime resources. The frontend receives typed, task-oriented data and never receives general
filesystem or shell authority.

## Native authority and IPC

Rust owns source/output paths, canonicalization, FFprobe parsing, FFmpeg construction, process
spawning, cancellation, and temporary-file ownership. Picker and drop paths are registered natively
and the frontend works with opaque runtime source IDs. Tauri commands validate every payload and
custom argument again in Rust, then return serializable DTOs and structured errors.

Frontend code calls typed adapters under `apps/desktop/src/lib/tauri`; it does not call generic
`invoke`, parse stderr, construct FFmpeg commands, or acquire arbitrary paths.

## FFmpeg and process lifecycle

Invoke validated executables with argument arrays, never an interpolated shell command. Keep
application-owned input, trim, stream mapping, and output options separate from user-supplied
optimized arguments; parse and reject alternate inputs/outputs, trims, response files, and
conflicting options. Use noninteractive flags, drain stdout and stderr concurrently, bound retained
output, and parse machine-readable progress.

Associate each child with a source or operation ID before publishing progress. Cancellation is
idempotent: terminate, await exit, emit one terminal state, and clean temporary artifacts. Report
success only after a successful exit and an expected/probed output.

At the frontend/runtime boundary, an export job is keyed by `attemptId` and carries its owning
`instanceId`; the captured request is immutable for the job lifetime. `operationId` identifies the
native process and `outputId` identifies the user-selected destination. Close-instance flows await
job cancellation and source-release cleanup before removing the Redux instance. See [Editing
instance lifecycle](editing-instance-lifecycle.md) for the complete correlation and lifecycle
contract.

## Paths and temporary artifacts

Create one collision-safe session temporary root with source/operation subdirectories. Proxies and
waveforms are implementation cache, never project state, and must not be placed beside the source.
Clean stale artifacts on source replacement and attempt cleanup on success, failure, cancellation,
and shutdown. Never delete a successful user-selected output during cleanup.

## Least privilege and packaging

The main window uses one explicit Tauri capability with only required permissions. Remote API access
is disabled except for the narrowly configured updater connection; CSP, scripts, fonts, analytics,
and CDN assets remain restrictive/local. Frontend code receives no shell-plugin or broad filesystem
permission.

Current releases discover FFmpeg/FFprobe on the host `PATH` rather than downloading binaries at
runtime. Verify binary version and required encoders/filters at startup. If sidecars are introduced,
they must be pinned, provenance-tracked, integrity-checked, and accompanied by required license
notices; never update them silently. Review every capability, protocol, plugin, and bundled-binary
change as security-sensitive.

## Privacy

Avoid full source/output paths in production logs and user-facing diagnostics unless needed to
identify a failure. Redact private paths from custom arguments and never log secrets or sensitive
environment data. Active editing/session state, queue entries, and media caches remain in memory;
the explicit Redux Persist allow-list currently covers panel layout and preferences only.
