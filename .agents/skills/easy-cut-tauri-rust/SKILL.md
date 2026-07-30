---
name: easy-cut-tauri-rust
description: Build and review Easy Cut's Rust and Tauri 2 native core. Use for changes under src-tauri, Cargo manifests, Tauri commands and IPC, application state, file dialogs and drag-drop plumbing, FFmpeg child-process lifecycle, progress/cancellation, temporary files, capabilities/CSP, Windows packaging, native tests, or Rust architecture. Pair with easy-cut-ffmpeg-pipeline when media commands or metadata change and with easy-cut-react-interface when IPC contracts affect the UI.
---

# Easy Cut Tauri and Rust

Own the native implementation so the frontend remains a typed, reviewable client.

## Required context

Follow the auto-loaded `AGENTS.md`. Before native changes, read:

- [repository structure](../../rules/structure.md);
- [runtime and security](../../rules/security-runtime.md);
- [quality gates](../../rules/quality.md);
- [native architecture contract](references/architecture.md).

Read `plans/ffmpeg-ui-mvp.md`, inspect the current manifests/lockfiles and affected TypeScript IPC types, and confirm actual Rust/Tauri versions before using an API.

Use `easy-cut-ffmpeg-pipeline` for media behavior and `easy-cut-react-interface` when an IPC contract changes the UI.

## Keep framework boundaries thin

- Keep Tauri commands as typed serialization/adaptation boundaries.
- Put validation, domain rules, media builders, and process logic in ordinary Rust modules.
- Return serializable DTOs and structured application errors.
- Prefer owned command inputs for asynchronous work.
- Do not hold a mutex guard across `.await`.
- Use newtypes or validated constructors when they prevent invalid source IDs, operation IDs, stream indexes, trim ranges, or output names.
- Use `Result` and `?`; reserve `unwrap`/`expect` for tests or provably fatal bootstrap.

## Model runtime state explicitly

- Represent operation lifecycle with an enum such as queued/running/cancelling/succeeded/failed/cancelled.
- Keep exactly one owner for active child handles and background tasks.
- Store active work by opaque source/operation ID behind the smallest practical synchronized boundary.
- Make cancellation idempotent and reject stale source/operation completions.
- Keep all editor and preset state in Tauri-managed memory; apply the shared ephemeral-state rule without exceptions.

## Implement responsive IPC

- Make probing, proxy generation, waveform generation, and rendering asynchronous.
- Use typed commands for request/response work.
- Use Tauri channels for ordered progress and terminal status; reserve events for low-volume notifications.
- Include operation ID, phase, processed duration, total duration, speed, percentage when known, and terminal result in progress payloads.
- Expose source-task cancellation so replacement can stop probe, preview, and waveform work while stale-ID guards preserve correctness.
- Ensure frontend subscriptions can be cleaned up when a component or operation is replaced.

## Review native configuration

- Keep one main window and one explicit least-privilege capability.
- Review CSP, plugins, protocols, sidecars, and packaging together with the shared runtime/security rule.
- Keep packaged FFmpeg/FFprobe provenance, capability detection, and license notices explicit.
- Explain any new dependency, permission, background task, or packaging impact in the handoff.

## Native test focus

In addition to the shared quality gate, cover changed behavior for:

- request validation and structured error mapping;
- operation transitions and idempotent cancellation;
- stale source replacement and concurrent helper completion;
- child failure and concurrent stdout/stderr handling;
- Unicode, spaces, long Windows paths, and shell metacharacters;
- shutdown and temporary-artifact cleanup.

## Finish

- Summarize native behavior and IPC contracts changed.
- Explain ownership/concurrency and Tauri security choices in plain language.
- Report capability, dependency, packaging, persistence, and validation impact.
