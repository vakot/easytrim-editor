---
name: easytrim-editor-redux-state
description: Build and review EasyTrim Editor application state with Redux Toolkit, including slice extraction, selectors, typed hooks, async orchestration, and migration from Context/useReducer/useState without moving runtime resources or local UI state into Redux.
---

# EasyTrim Editor Redux State

Use this skill for Redux Toolkit store work, state-ownership decisions, migration from
React Context/useReducer/useState, removal of application-state prop drilling, or
Redux-aware async orchestration in the EasyTrim Editor frontend.

## Required context

Follow `AGENTS.md` and the repository state-management rule. Also load the React
interface skill for React/component work. Load the Tauri and FFmpeg skills when the
workflow crosses native/media boundaries.

Before editing, inspect the current implementation and write down:

1. current source of truth;
2. target source of truth;
3. all writers;
4. all readers;
5. side effects triggered by transitions;
6. reset and lifetime semantics;
7. why the state actually belongs in Redux.

Do not infer ownership from the number of `useState` calls. Explicitly classify local
ephemeral UI state, environment/service Context, and native/runtime resources before
choosing Redux.

## Repository workflow

- Make one application store at the appropriate React composition boundary.
- Use Redux Toolkit with strict serializability checks and typed application hooks.
- Keep the store and slices under `apps/desktop/src/app/` or the owning feature,
  following the repository dependency direction.
- Define domain actions and transitions first; avoid a generic `setFoo` API for a
  workflow with meaningful states.
- Colocate selectors with the slice and test reducers/selectors at the lowest useful
  layer.
- Connect feature/application components where the state is semantically needed.
  Preserve presentational component APIs when they are meaningful and reusable.
- Keep migration phases small. Establish one owner before removing the old provider or
  forwarding layer, then validate and stop for human review.

## Migration method

For Context or `useReducer` migration, map the current public value to domain state,
actions, selectors, and commands before changing consumers. The existing
`sessionReducer` is already a domain-oriented reducer: preserve its source, preview,
trim, audio, capability, and waveform semantics rather than replacing them with
unrelated generic setters.

For `useState` migration, first prove that the value is application-owned and shared.
Keep hover, disclosure, pointer-drag, draft-form, animation, panel-internal, and
media-element synchronization state local. Never perform a blind “move every useState
into Redux” refactor.

When removing prop drilling, connect the nearest application/feature component to
selectors and dispatch. Do not make every leaf UI primitive store-aware.

## Selectors and actions

Prefer narrow selectors such as `selectActiveSource`, `selectTrim`,
`selectAudioTracks`, `selectCanExport`, and `selectHasQueuedExports` when those
represent real domain concepts. Keep derived capability and button-availability logic
in selectors rather than duplicated state.

Prefer actions named after transitions, for example:

```text
sourceSelected
sourceReady
sourceFailed
previewReady
trimChanged
audioTrackToggled
waveformsLoading
waveformResultReceived
queueStarted
exportProgressReceived
exportCompleted
```

Include source IDs, operation IDs, and waveform job IDs in actions whenever the
transition can race with source replacement or another async operation.

## Async orchestration

Choose the smallest mechanism:

- plain dispatch for synchronous interaction;
- thunk for an explicit import, inspect, preview, waveform, or export command;
- listener middleware for a reaction to a domain transition when it avoids coupling
  unrelated UI;
- existing runtime/service modules for browser media, Tauri handles, child processes,
  subscriptions, temporary artifacts, and cancellation.

Typed functions in `apps/desktop/src/lib/tauri/` remain the native boundary. Redux code
must not call generic `invoke`, construct FFmpeg arguments, accept arbitrary paths, or
own native resources. Reducers never perform effects.

For source workflows, preserve this direction:

```text
UI/native event -> domain command -> typed adapter/service -> domain action -> reducer -> selector -> UI
```

Keep operations cancellable and reject stale completions. Clean up drag/drop listeners
and waveform/media work on unmount or source replacement.

## Serialization and resource ownership

Store serializable descriptors and status only. Keep these outside Redux:

- HTML media elements and refs;
- AudioContext, MediaElementAudioSourceNode, GainNode, and animation handles;
- AbortControllers, timers, unlisten callbacks, and functions;
- Tauri updater objects and native process/operation handles;
- module-level queue job records and other mutable runtime controllers.

For export, Redux may eventually own serializable queue entries and status while the
runtime queue keeps source reservations, child operations, callbacks, and cancellation
handles. Avoid putting callback fields such as `onCancel` in canonical Redux state.

Before migrating a domain, decide whether it must survive application restart. Redux
state is runtime-only by default; if the answer is no, leave it unpersisted. If the
answer is yes, configure it through `redux-persist`: use root-level allow-listing when
the complete domain is persisted and a nested/domain-level persisted reducer when
only selected fields should persist. Components must dispatch actions only; reject a
component that dispatches and also writes the same Redux state to storage. Keep
reducers independent from persistence and let the root persistence gate account for
rehydration lifecycle.

## Source replacement checklist

When a source is selected:

- establish the new source identity before starting async work;
- reset source-bound metadata, preview, trim, audio tracks, waveform status, crop, and
  audio-preview descriptors according to the domain contract;
- retain only intentionally cross-source defaults or presets;
- pass the source ID through every async request and completion;
- ignore stale inspect/preview/audio/waveform results;
- cancel or clean source-bound work without cancelling explicitly retained export work.

When migrating native-facing orchestration, verify the Rust `AppState` generation,
source reservation, operation cancellation, temporary artifact, and waveform job
contracts before changing frontend actions.

## Verification

For each migrated domain, add or update reducer/selector tests and relevant component
tests. Cover stale results, source replacement, cancellation, reset behavior, and
listener cleanup where relevant. Run the narrowest checks during iteration and the
repository quality gate before handoff. Report exact commands and stop after the phase
has been prepared for human review.
