# Runtime and security rule

Apply this rule to Tauri IPC, paths, FFmpeg/FFprobe execution, temporary files, application state, and packaging.

## Keep native authority narrow

- Keep source/output paths, canonicalization, FFprobe parsing, FFmpeg construction, process spawning, cancellation, and temporary-file ownership in Rust.
- Register picker/drop paths natively and expose opaque runtime source IDs to the frontend.
- Expose task-oriented typed commands, never generic filesystem, shell, process, or arbitrary-path APIs.
- Treat every IPC payload and custom argument token as untrusted; validate again in Rust.
- Return serializable DTOs and structured errors. Never require UI code to parse stderr.

## Execute processes safely

- Invoke a validated executable with an argument array. Never build an interpolated command or invoke through a shell.
- Keep input, trim, mandatory stream mapping, and output ownership in the application.
- Parse custom optimized arguments into tokens with a documented grammar; reject alternate inputs, outputs, trims, response files, and conflicting application-owned options.
- Add noninteractive flags, drain stdout/stderr concurrently, bound retained output, and parse machine-readable progress.
- Associate each child with a source or operation ID before publishing progress.
- Make cancellation idempotent; terminate, await exit, emit one terminal state, and clean temporary artifacts.
- Require a successful exit and expected/probed output before reporting success.

## Apply least privilege

- Use one explicit Tauri capability for the main window and grant only required permissions.
- Keep remote API access disabled and configure a restrictive CSP.
- Load no remote scripts, fonts, analytics, or CDN assets.
- Do not grant shell-plugin execution or broad filesystem access to frontend code.
- Review every Tauri plugin, capability, protocol, and bundled binary change as security-sensitive.

## Keep state ephemeral

- Keep editor state and named presets in memory for the current process only.
- Do not use localStorage, sessionStorage, IndexedDB, cookies, Tauri Store, persisted scope, window-state persistence, databases, registry values, or OS configuration files.
- Treat proxies and waveforms as temporary implementation cache, never project state.
- Create one session temporary root with collision-safe source/operation subdirectories.
- Clean stale artifacts on source replacement and attempt cleanup on success, failure, cancellation, and shutdown.
- Never delete successful user-selected output during cleanup.
- Never place temporary artifacts beside the source.

## Protect privacy and packaging integrity

- Avoid full source/output paths in production logs and user-facing diagnostics unless needed to identify a file.
- Do not log custom arguments if they may contain private paths without redaction.
- Bundle pinned FFmpeg/FFprobe binaries for production; never download or update them silently at runtime.
- Verify required encoders/filters and binary version at startup.
- Track exact binary provenance and required license notices before packaging.
