---
name: easytrim-editor-react-interface
description: Build and review EasyTrim Editor's React, TypeScript, Vite, Tailwind, shadcn, CSS modules, and frontend tests. Use for the single-screen editor UI, import/drop behavior, video preview controls, timeline and trim handles, playhead synchronization, audio waveform rows and levels, preset editing, resolution/frame-rate controls, export states, accessibility, responsive layout, frontend performance, or Tauri IPC client types. Pair with easytrim-editor-tauri-rust for IPC/native changes and easytrim-editor-ffmpeg-pipeline when controls alter media semantics.
---

# EasyTrim Editor React Interface

Build a minimal React + TypeScript + Vite interface that the project owner can review directly.

## Required context

Follow the auto-loaded `AGENTS.md`. Before frontend changes, read:

- [repository structure](../../rules/structure.md);
- [quality gates](../../rules/verification.md);
- [runtime and security](../../rules/security-runtime.md) when IPC, paths, state lifetime, or local assets are involved;
- [UI contract](references/ui-contract.md).

Inspect existing components, state, Tauri adapters, styles, and tests, then identify the user action, state transition, and native command involved.

Use `easytrim-editor-tauri-rust` for IPC/native changes and `easytrim-editor-ffmpeg-pipeline` when controls alter media behavior.

## Keep frontend architecture simple

- Use React, strict TypeScript, Vite, semantic HTML, Tailwind, and the repository's shadcn primitives.
- Reuse `components/ui` for buttons, dialogs, fields, tooltips, popovers, sliders, checkboxes, cards, and alerts. Add a shadcn primitive before hand-building an equivalent control.
- Keep generated primitives generic. Put product-specific composition in the owning feature.
- Name dedicated type-only modules with `.types.ts`: use a semantic kebab-case base for
  module-level contracts and a matching PascalCase component base for component-specific types.
  Keep required ambient declarations as `.d.ts`, and do not extract inline types solely for naming.
- Use Tailwind utilities first. Reserve colocated CSS modules for precise pseudo-elements, keyframes, or browser-native styling that would be obscure as utilities.
- Use Redux Toolkit for approved application/domain state according to
  `easytrim-editor-redux-state`. Keep local component state for ephemeral visual and
  interaction concerns; do not introduce another state library or ad-hoc application
  context.
- Keep app-level Context declarations under `app/contexts/` and their Provider
  implementations under `app/components/providers/`; feature-owned Contexts and the
  theme subsystem remain with their owning feature/subsystem.
- Keep Tauri calls behind the typed adapter defined by the structure rule.
- Keep FFmpeg strings, path validation, and process details out of components.
- Load no analytics, remote assets, fonts, or network resources.
- Let feature orchestration roots own capability state/logic orchestration and feature layout;
  they may select and dispatch Redux state intrinsic to the capability. Move cohesive interaction
  logic and effects to feature `hooks/` when that creates a meaningful responsibility. Keep
  focused nested components presentational by default, and group semantic pure/internal modules
  under `lib/` only when enough related files justify it.

## Model editor state explicitly

Model session-level state with the owning Redux Toolkit slice once that domain is
migrated. Until then, preserve the existing reducer's domain semantics and its single
source of truth. Use a discriminated operation status:

```text
idle
loading-source
ready
preparing-preview
exporting
cancelling
completed
failed
```

- Keep canonical source metadata, trim, audio enablement, optimized settings, and operation status in one predictable flow.
- Route Redux-heavy state ownership, slice, selector, and orchestration decisions to
  `easytrim-editor-redux-state`; this skill owns the React component and interaction
  consequences of that architecture.
- Derive labels, selected duration, scale options, filenames, and button availability.
- Use source/operation/job IDs to ignore stale asynchronous completions.
- On source replacement, reset all source-bound state but retain runtime presets/current preset.
- Enable discovered audio tracks by default.
- Keep a failed replacement as the current failed import; do not resurrect the prior source.

## Preserve the one-screen flow

Keep these regions visible without navigation:

1. import/drop target;
2. video preview;
3. timeline with trim handles and playhead;
4. one waveform/toggle row per audio stream;
5. compact optimized settings and runtime preset editor;
6. required output name;
7. side-by-side `Fast cut` and `Optimized render` buttons;
8. progress and cancellation.

- Replace the current source in one action without confirmation.
- Open the native save dialog after choosing an export route.
- Prefill a route-specific suffix and compatible extension.
- Keep advanced preset configuration compact; add no top menu, context menu, or wizard.
- Explain fast keyframe limitations and hybrid audio merge in plain language.

## Implement timeline interaction

- Put coordinate/trim calculations in pure tested functions.
- Convert pointer position from measured bounds to canonical source time.
- Clamp handles so `start < end`.
- Use Pointer Events and pointer capture.
- Throttle drag/playhead visuals to animation frames.
- Render waveform data as one image, SVG path, or canvas layer per track.
- Keep full-source preview seekable; moving a trim handle seeks to that boundary for feedback.
- Avoid React state updates on every decoded frame.

## Make controls accessible

- Give trim handles slider semantics, accessible names, min/max/current values, and formatted value text.
- Support Arrow keys for fine movement and Shift+Arrow for larger movement.
- Provide visible focus and practical touch targets.
- Do not encode selection/disabled state using color alone.
- Hide decorative waveforms from assistive technology and expose useful audio labels as text.
- Keep every setting, error, and export action keyboard-reachable.

## Integrate native operations

- Keep request/result/error/progress types in the typed Tauri adapter.
- Convert structured native errors into concise messages with optional bounded diagnostics.
- Subscribe once per active operation and clean up on unmount/replacement.
- Reject stale source/operation completions; use a waveform job ID for regeneration races.
- Keep waveform failure local and non-blocking.
- Disable conflicting actions during export while preserving cancellation.

## Frontend test focus

In addition to the shared quality gate, cover:

- picker/drop import and immediate replacement;
- reducer and timeline coordinate boundaries;
- pointer and keyboard trim interaction;
- multiple audio tracks and selections;
- preset preservation with source-bound reset;
- required output name and route payloads;
- progress, cancellation, failure, stale events, and listener cleanup;
- accessible roles/names and absence of persistence calls.

## Finish

- Summarize visible flow and state transitions changed.
- List IPC/media contracts changed and companion skills used.
- Report keyboard/accessibility coverage and exact frontend checks.
