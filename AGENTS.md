# Easy Cut agent instructions

This file is the auto-loaded entry point for every repository task. Keep it compact; reusable policy lives in `.agents/rules/`.

## Required context

Before modifying files:

1. Read `plans/ffmpeg-ui-mvp.md`.
2. Read every rule listed under **Always-on rules** once for the task.
3. Inspect the current worktree and preserve unrelated user changes.
4. Load every project skill whose description matches the task.

Shared rules are authoritative for repository-wide conventions. Skills add stack-specific workflow and domain contracts without duplicating shared policy.

## Always-on rules

- [Engineering](.agents/rules/engineering.md) — scope, design, dependencies, errors, documentation, and maintainability.
- [Repository structure](.agents/rules/structure.md) — directory ownership, dependency direction, naming, and growth conventions.
- [Runtime and security](.agents/rules/security-runtime.md) — native authority, process safety, Tauri permissions, temporary files, and in-memory-only state.
- [Quality gates](.agents/rules/quality.md) — tests, static checks, media verification, and completion reporting.
- [Git and pull requests](.agents/rules/git-workflow.md) — topic branches, Conventional Commits, push policy, and PR format.

## Skill routing

- Use `easy-cut-tauri-rust` for Rust, Tauri, IPC, native state, process lifecycle, security configuration, or packaging.
- Use `easy-cut-ffmpeg-pipeline` for FFprobe/FFmpeg behavior, metadata, trim/export semantics, audio processing, presets, or media benchmarks.
- Use `easy-cut-react-interface` for React, TypeScript, Vite, editor state, timeline interaction, accessibility, or frontend tests.
- Use all applicable skills for cross-boundary work. Keep native, media, and UI contract changes synchronized.

## Review expectations

- Treat correctness, cancellation, source replacement, stream selection, path handling, and accidental persistence as high-risk review areas.
- Keep product behavior aligned with the MVP plan; update the plan when an accepted decision changes.
- Explain Rust/Tauri design decisions in plain language in the final handoff because native implementation is AI-owned.

## Code Review Rules

### Media command safety

- Flag any FFmpeg/FFprobe execution through a shell or interpolated command string. Safe path: invoke a validated executable with an argument array in Rust.

### Session-only state

- Flag project, preset, path, or editor-state persistence outside temporary media cache. Safe path: retain state in memory and clean session artifacts.

### Stream correctness

- Flag exports that rely on FFmpeg automatic stream selection or type-relative indexes. Safe path: use validated FFprobe global indexes and explicit maps.

### Boundary integrity

- Flag frontend code that receives arbitrary filesystem/process authority or contains FFmpeg command construction. Safe path: use narrow typed Tauri commands backed by Rust-owned paths and processes.
