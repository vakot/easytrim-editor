# EasyTrim Editor Redux migration plan

Status: Phase 4.5 — Source domain decomposition complete; stopped for human review

This is the maintained plan for the controlled Redux Toolkit migration. It is based
on the frontend and native architecture at the `master` baseline used to create the
`redux-migration` integration branch. Phase 1 introduced the Redux foundation and
migrated Preferences as the first permanent Redux-owned domain. Phase 1.5 establishes
the application infrastructure structure before the next functional migration.

Phase 5 is implemented on this topic branch and is complete pending human review.
The Phase 5 architecture section below supersedes the earlier deferred-export
inventory entries.

## Migration contract

- `redux-migration` is the long-lived integration base. Each phase is implemented on
  its own topic branch and reviewed in a PR targeting `redux-migration`.
- Phase PRs are independently understandable and stop for human review after their
  validation. No later phase begins until the preceding phase is approved and
  squash-merged into `redux-migration`.
- `master` remains untouched by migration work. The owner performs the eventual merge
  from `redux-migration` into `master`.
- Every state value has one canonical owner. Redux is for serializable application or
  feature state; Context and local/runtime owners remain valid where they are the
  cleaner boundary.
- Redux migration removes Context and Redux-backed prop transport, not only the state
  owner. Prefer direct focused selector/dispatch access at the actual application
  consumer; do not recreate large Redux-shaped prop contracts. Reusable presentational
  components may retain meaningful props.
- Existing source replacement, operation cancellation, waveform job, export-source
  reservation, temporary artifact, and listener cleanup guarantees are preserved.
- Active editing state remains runtime-only. Redux persistence is opt-in per domain at
  the store boundary through `redux-persist`; Preferences is the first explicitly
  configured persisted Redux domain. Theme and export presets retain their existing
  reviewed adapters until their own migration decisions.

## Current composition and ownership

The current composition in `apps/desktop/src/App.tsx` is:

```text
AppUpdatesProvider                 updater service Context
  ThemeProvider                     theme/environment Context
    ReduxProvider                   typed application store
      PersistGate                    redux-persist rehydration boundary
    EditorContractsProvider      playback/controller Context
      EasyTrimEditorApp          root composition and Redux consumers
        OptimizedExportDialog    mounted feature dialog
```

Source and media orchestration lives in focused application thunks, while the one-time
application runtime initializer owns capability startup and the native source-drop
subscription. There is no `EditorSessionContext` or `useEasyTrimEditorApp` remaining.
Source, trim,
crop, audio, and preview readers and commands use focused Redux selectors and dispatch at their
actual consumers. `useEditorContracts` remains the playback/runtime boundary and no
longer reshapes session state.

The native side remains authoritative for source paths, source generations, media
inspection, preview/audio-preview/waveform artifacts, export-source reservations,
operation cancellation, and FFmpeg process execution. Rust `AppState` stores those
runtime resources in memory; Redux must never replace that authority.

Redux owns Preferences, active Editor tools, Editor layout, Export, and Export presets.
The store registers only Preferences for persistence and hydrates it before downstream
editor initialization; Editor tools, Editor layout, Export, and Export presets are
runtime-only in Redux (presets retain an explicit feature adapter). The remaining
application domains listed as `Redux later` stay on
their current owners until a reviewed implementation phase establishes a new source
of truth.

## Ownership classification

| Domain                             | Classification            | Current owner                                                                                      | Target / phase                                                                                                    |
| ---------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Source/session/media lifecycle     | Redux now                 | `source`, `trim`, `crop`, `audio`, and `preview` slices plus `store/thunks/source-media-thunks.ts` | Completed Phase 4.5; runtime-only source-bound state                                                              |
| Preferences                        | Redux now                 | Redux `preferences` slice; root `redux-persist` allow-list                                         | Completed Phase 1 pilot; persisted by explicit Redux Persist configuration                                        |
| Editor tools                       | Redux now                 | `editorTools` Redux slice; initialized and reset from Preferences defaults                         | Completed Phase 2B; runtime-only active state                                                                     |
| Editor layout                      | Redux now                 | `editorLayout` Redux slice; resizable-panel callbacks and local panel refs                         | Completed Phase 2C; runtime-only canonical layout state                                                           |
| Crop selection and crop resolution | Redux now                 | `crop` slice; `useCropSelection` retains pointer/viewport internals                                | Completed Phase 4.5; resolution derived from source media; pointer internals stay local                           |
| Playback transport and media graph | Keep runtime/native-owned | `useEditorInteractionController`, `EditorContractsProvider`, DOM/media refs, Web Audio nodes       | Keep local/runtime; audit in Phase 6                                                                              |
| Export queue and workflow          | Redux now                 | `export` slice; runtime queue retains pending jobs, operation IDs, cancellation, and native calls  | Completed Phase 5; queue entries are serializable snapshots and remain runtime-only                               |
| Export presets and settings        | Redux now                 | `exportPresets` slice; explicit `export-presets.ts` storage adapter                                | Completed Phase 5; reusable presets retain reviewed feature persistence, active export settings stay runtime-only |
| Import/drop workflow status        | Redux now                 | `import-workflow` slice; application-lifetime source-media runtime                                 | Completed Phase 4; runtime-only workflow state                                                                    |
| Updater status                     | Keep Context              | `AppUpdatesProvider`; native `AvailableUpdate` object in a ref                                     | Keep service Context; audit serializable status in Phase 7                                                        |
| Theme and style environment        | Keep Context              | `ThemeProvider`, `ThemeContext`, `localStorage` adapter                                            | Keep environment Context; no Redux persistence                                                                    |
| Imperative export-panel controller | Removed                   | `ExportPanel`, controller Context/provider, refs, and `useExportController`                        | Completed Phase 5; direct Redux actions and a mounted dialog replace the legacy chain                             |
| Editor interaction contracts       | Keep runtime/native-owned | `EditorInteractionContext` and `useEditorInteractionController`                                    | Keep Context for refs/callbacks/media lifecycle; reduce only if a later boundary makes that safe                  |
| Component and pointer UI state     | Keep local                | Feature/component hooks and local state                                                            | Remains local throughout the migration                                                                            |

## Detailed domain inventory

### 1. Source/session/media lifecycle — Redux now, completed Phase 4.5

The old `session` reducer was removed. The runtime-only store now registers focused
`source`, `trim`, `crop`, `audio`, and `preview` reducers. Phase 4 orchestration remains
in the existing source-media thunks and application-lifetime runtime.

Current state includes:

- capability status (`checking`, `ready`, `failed`);
- session status (`idle`, `loading-source`, `ready`, `failed`);
- source selection identity/display name;
- inspected `MediaInfo`, source capabilities, source identity, and source error;
- canonical trim range and normalized crop rectangle;
- audio-track enablement, per-track volume, master volume/enablement, and merge flag;
- waveform status by stream, width, job ID, URL, and error in Audio;
- source-bound audio-preview descriptors and preparation status in Audio;
- source/proxy preview lifecycle and preview error.

Readers include `App.tsx`, `SourceWorkspace`, `SourceSidebar`, capability/source
components, `EditorStage`, preview/audio/timeline features, export composition, File and
Settings menus, and the editor interaction controller. Writers are the source picker
and Tauri drop listener, inspection/preview/proxy/audio-preview/waveform completions,
trim and audio controls, and image-error callbacks. The current propagation problem is
that source state previously crossed the aggregate Context and `useSourceDetails`; Phase 3
replaced that path with direct focused selectors and kept only meaningful reusable props
at the Export feature boundary.

Focused selectors are colocated with their domains for source status/selection/media/
capabilities, trim, crop and derived crop resolution, audio tracks/master/merge/
previews/waveforms, and preview status/value. Shared source lifecycle events live in
`app/store/actions/source-actions.ts`; source, trim, crop, audio, and preview reducers
handle `sourceSelected` and `sourceCleared` through `extraReducers`.

Side-effect owner: `app/store/thunks/source-media-thunks.ts` owns explicit commands for
capability checks, source import/inspection, source close, preview/proxy fallback, and
waveform preparation. `app/store/source-media-runtime.ts` starts capability probing and
registers the native drop listener once from `main.tsx`; its unlisten function remains
runtime-only. Both chooser and drop-selected sources converge on `importSource`.
Typed functions in `apps/desktop/src/lib/tauri/media.ts` remain the native boundary.

Reset/lifetime: selecting a source establishes a new source ID and resets media,
preview, trim, crop, audio tracks, waveform records, and audio-preview descriptors in
one Redux transition. Audio-preview descriptors and waveform data are serializable
Audio state, while HTML audio elements and Web Audio resources remain in the playback runtime.
A module-local waveform job counter is runtime-only and is never persisted.
Stale source IDs and waveform job IDs reject old completions. Failed replacement stays
the current failed import rather than restoring the previous source. Accepted tool
defaults and presets survive source replacement. Native Rust `AppState` continues to
cancel source-bound helpers and retain explicitly reserved export sources.

Phase 4.5 removed the aggregate session transport and all obsolete Session selectors,
actions, reducer files, and Crop Context transport. Phase 5 removed the remaining
Export-only session transport; reusable presentational contracts may retain meaningful
props.
The low-level `AudioTracks`, preview, timeline, and export presentational contracts may
remain props where they are useful reusable APIs.

### 2. Preferences — Redux now, completed Phase 1 pilot

Canonical owner: the Redux `preferences` slice in
`apps/desktop/src/app/store/slices/preferences-slice.ts`. It owns the four tool defaults for safe
trim following, loop playback, segment playback, and merge audio. The slice starts
from deterministic product defaults; it does not read storage while the module is
initialized.

Readers include `SettingsMenu` through focused selectors. Writers are the Settings actions
`toolDefaultChanged` and `toolDefaultsReset`; future preference writers must use
domain actions as well. Active editor tools remain separate runtime state and must not
mutate Preferences.

Persistence is opt-in through `redux-persist` at the application store boundary.
Preferences is currently the only configured persisted Redux domain, selected by the
root allow-list and rehydrated through the root `PersistGate`. Its complete current
state is persisted under the new Redux Persist key. The old `easytrim.preferences.v1`
schema is intentionally not read or migrated. Reducers remain pure, and Settings has
no storage responsibility. Unconfigured runtime-only domains are neither hydrated nor
persisted; nested `persistReducer` configuration remains available for future
partial-field persistence.

Lifetime: defaults survive source replacement and application restart through Redux
Persist. Reset restores the declared product defaults.
Changing a preference does not retroactively rewrite active tools, except for the
existing explicit merge-audio bridge that applies the Settings action to the active
session source; that value remains session-owned until the session migration.

Completed Phase 2A work: preference fields were removed from the combined
`toolViewState`, the preference portion of `EditorViewStateContext` was removed, and
the old `toolDefaults` transport from `EditorSessionProvider` was replaced by Redux
selectors. The explicit merge-audio Settings bridge remains; the old Preferences
storage helpers were removed because Redux Persist now owns this domain.

### 3. Editor tools — Redux now, completed Phase 2B

Canonical owner: `app/store/slices/editor-tools-slice.ts`, registered as the
`editorTools` reducer in `app/store/store.ts`. The runtime-only state contains only
snap playback, loop playback, segment playback, and the allowed `PlaybackSpeed`
value. It is excluded from the Redux Persist allow-list.

`EditorStage` connects the presentational `TimelineTools` component to focused Redux
selectors and domain actions. `useEditorInteractionController` reads the active tools
from Redux and dispatches explicit loop/segment transitions when the runtime playback
boundary controller requests them. The playback controller continues to own media
elements, refs, AudioContext nodes, animation frames, playhead synchronization, and
readiness events.

The store-boundary PersistGate callback initializes active tools from the rehydrated
Preferences defaults and the default playback speed. This is a one-time initialization;
ordinary Preference changes do not rewrite active tools. The toolbar reset action is
constructed from the current Preferences selector, so reset does not use stale startup
values. Active tools survive source replacement for the lifetime of the application,
but do not survive restart through persistence.

Actions are `editorToolsInitialized`, `editorToolsReset`,
`snapPlaybackToggled`, `snapPlaybackChanged`, `loopPlaybackToggled`,
`loopPlaybackChanged`,
`segmentPlaybackToggled`, `segmentPlaybackChanged`, and `playbackSpeedChanged`.
Focused selectors are `selectEditorTools`, `selectSnapPlaybackEnabled`,
`selectLoopPlaybackEnabled`, `selectSegmentPlaybackEnabled`, and `selectPlaybackSpeed`.

The active-tool fields were removed from the former `EditorViewState` infrastructure;
`useTimelineTools` was removed because it only reshaped that Context state. The
presentational `TimelineTools` props remain a useful feature boundary.

### 4. Editor layout — Redux now, completed Phase 2C

Canonical owner: `app/store/slices/editor-layout-slice.ts`, registered as the
`editorLayout` reducer in `app/store/store.ts`. It stores generic `panelVisibility`
values keyed by stable panel IDs (`left` and `bottom`), alongside `workspaceLayout`
and `editorStageLayout` as serializable runtime state. Layout maps remain optional
until `react-resizable-panels` has initialized the corresponding group.

Readers include `PanelVisibilityControls`, `SourceWorkspace`, `EditorStage`, panel
separators, and the panel-sizing hook. Writers are the top-bar visibility controls,
workspace/editor-stage resize callbacks, panel collapse/expand effects, and future
restore/reset commands. The wiring problem is that non-trivial visibility, dimensions,
valid panel combinations, and resize-derived behavior are modeled as unrelated generic
setters beside tool state.

The actual consumers are `SourceWorkspace`, `EditorStage`, and
`PanelVisibilityControls`, each using focused selectors and dispatching domain actions
directly. `react-resizable-panels` remains the runtime boundary: group layouts are
captured by `onLayoutChanged`, panel refs perform collapse/expand and reset sizing, and
refs, DOM measurements, pointer/drag state, and panel APIs never enter Redux.

Actions are `panelVisibilityChanged`, `panelToggled`, `workspaceLayoutChanged`,
`editorStageLayoutChanged`, and `editorLayoutReset`. Selectors are
`selectEditorLayout`, `selectPanelVisibility`, `selectWorkspaceLayout`, and
`selectEditorStageLayout`.

The invariant inventory found no separate layout normalization helper beyond the
panel library's validated layout output. Timeline constraints remain in the pure
`timeline-pane-sizing.ts` helper and its existing tests; `useTimelinePanelSizing`
clamps runtime resize targets to those constraints. Visibility transitions continue
to call the panel imperative API, and panel resize callbacks keep logical visibility
in sync with collapse state. Workspace and editor-stage layouts are independent.

Reset dispatches one domain action, restores both panels visible, clears stored group
layouts, and lets each actual group consumer restore its runtime default through its
local panel ref. The layout domain is not in the Redux Persist allow-list, so it
resets on application restart and survives source replacement only for the current
process. No old layout prop/callback transport remains.

The former `EditorViewStateContext`, `EditorViewStateProvider`, and
`useEditorViewState` compatibility infrastructure were removed. Context remains for
runtime/controller boundaries that are not application layout state.

### 5. Crop and preview editing values — Redux now, completed Phase 4.5

Canonical owner: the runtime-only `crop` Redux slice owns the normalized crop rectangle.
`useCropSelection` retains only the crop dialog, pointer drag, viewport frame, and
animation internals. Readers include `VideoPreview`/`CropViewport`, FileMenu, and the
export composition; the crop hook dispatches source-bound updates directly.

`selectCropResolution` derives source dimensions from `source.media`; no independent
crop resolution state remains. Selectors/actions are `selectCrop`,
`selectCropApplied`, `selectCropResolution`, and `cropChanged`.

Side-effect owner: none for the pure values; export request construction continues in
the export feature and native adapter. Reset to `FULL_CROP` on source replacement and
source clear. The crop portion of the former session state transport was removed.

### 6. Playback and transport — keep local/runtime-owned, Phase 6 audit

Current owner: `useEditorInteractionController` and `usePlaybackModes` manage
playhead, playing/ready flags, transport errors, preview readiness, audio readiness,
media-element refs, audio elements, Web Audio nodes, playback frames, scrubbing,
keyboard shortcuts, and trim/playhead coordination. `EditorInteractionContext` exposes
callbacks and refs to `EditorStage` and its child features.

Playback is high-frequency and tightly coupled to DOM/media resources. Keep refs,
audio graphs, animation handles, and per-frame playhead updates outside Redux. A later
review may expose a small serializable playback status if another disconnected region
needs it, but Redux must not become a frame synchronization bus. Source replacement
continues to pause/cleanup transport and reset the playhead in the controller.

The interaction Context is therefore a genuine runtime/controller boundary. Do not
remove it merely to reach zero Contexts. Any future migration must preserve media
listener cleanup and source-keyed readiness behavior.

### 7. Export queue and execution — Redux later, Phase 5

Canonical owner: the runtime-only `export` Redux slice owns queue entries,
queue-start state, finish policy, optimized dialog state, settings, command-preview
status, progress, and terminal lifecycle values. The feature runtime queue in
`features/export/utils/export-queue.ts` owns pending jobs, source reservations,
operation IDs, cancellation calls, progress channels, and native execution.

Readers include `StatusBar`, `SourceSidebar`/`ExportQueue`, QueueMenu, App-level start
and dialog wiring, and export controls. Writers are export thunks, queue runtime
transitions, and native progress, cancellation, and terminal results. The former
propagation problem was `setQueue` and queue callbacks crossing `App.tsx` and feature
props while execution lived in a module-level controller.

Target source of truth: completed in Phase 5. Focused selectors are `selectExportQueue`,
`selectHasQueuedExports`, `selectHasActiveExport`, `selectCanStartQueue`, and
`selectQueueFinishAction`. Candidate actions include `queueEntryAdded`,
`queueStarted`, `queuePaused`, `exportProgressReceived`, `exportCompleted`,
`exportFailed`, `exportCancelled`, and `queueFinishActionChanged`.

Side-effect owner: the existing runtime queue or a later extracted service retains
pending jobs, source reservations, operation IDs, cancellation handles, progress
channels, and native calls. Redux thunks/listeners may initiate commands and publish
serializable transitions but must not store `onCancel` callbacks or process handles.

Reset/lifetime: the queue is application-session state and must not be cleared merely
because the active editor source changes. Explicit `reserveExportSource` semantics
allow queued work to outlive source replacement; cancellation and release remain
idempotent. Queue completion still triggers the selected native finish action only
after actual queued work has completed.

Queue items capture the source ID, trim, audio selections, crop, output settings,
route, and output selection at queue time. Queued work therefore remains stable after
source replacement; Rust retains the reserved source until the native operation ends
or queued work is cancelled. There is no `setQueue` prop transport or React queue hook.

### 8. Export presets — Redux later, Phase 5

Canonical owner: the `exportPresets` Redux slice owns reusable preset records,
selection, and arguments. `PresetManager` is a direct Redux consumer with only local
draft-dialog state. The existing explicit feature storage adapter is invoked by Redux
middleware after preset actions, preserving the accepted preset persistence behavior.

The export-preset slice uses domain actions with the existing meanings:
(`argumentsChanged`, `presetSelected`, `presetNewStarted`, `presetCreated`,
`presetUpdated`, `presetDeleted`) and selectors for the selected preset, arguments,
and available presets. Preserve validation and stable preset IDs; do not replace this
with generic setters.

Side-effect owner: the existing load/persist adapter remains outside reducers. The
current accepted persistence behavior is preserved until a later reviewed decision.
Presets outlive source replacement and are runtime preferences, not project/session
state.

There is no root reducer instance, `onPresetAction` forwarding, or ExportPanel preset
prop contract. Active dialog settings are in the `export` slice and are not persisted.

### 9. Import/drop workflow and native dialog status — Redux now, completed Phase 4

Current owner: the runtime-only `importWorkflow` slice for `isChoosingSource`,
`isNativeDialogOpen`, `isSourceDragActive`, and `dropListenerError`. Readers are App
overlays, FileMenu, SourceWorkspace/DropOverlay, and keyboard shortcut paths. Native
dialog callbacks remain explicit application actions because Export still owns its
separate Phase 5 runtime workflow.

The focused `app/store/slices/import-workflow-slice.ts` is deliberately separate from
the media session slice. It exposes `selectIsChoosingSource`,
`selectIsNativeDialogOpen`, `selectIsSourceDragActive`, and `selectDropListenerError`.
The source/media thunks own chooser/close commands, and the application runtime owns
drop subscription setup and cleanup.

Side-effect owner: `source-media-runtime.ts` calls the typed media adapter once at
startup and converges selected drops on `importSource`. The native dialog itself
remains native-owned. Drag/error status is serializable and runtime-only; source import
failure remains an observable failed transition.

### 10. Updater — keep Context, Phase 7 audit

Current owner: `AppUpdatesProvider` and `AppUpdatesContext`. Serializable values are
status, available version, and installing state. The actual `AvailableUpdate` object,
checking/installing guards, and install callback are kept in refs. Readers are
`StatusBar` and `HelpMenu`.

Keep the service Context unless a later inventory finds enough disconnected consumers
to justify a small updater-status slice. Even then, only serializable status belongs in
Redux; the native updater object and install operation remain in the provider/service.

### 11. Theme and style environment — keep Context

Current owner: `ThemeProvider` and `ThemeContext`. It manages theme resolution against
the system preference, primary-color scrubbing, DOM CSS variables, and accepted
preference persistence through `lib/storage.ts`. Keep it as an environment/style
boundary. Color wheel drafts and pointer state remain local. Redux is not a reason to
replace this Context or add a persistence layer.

### 12. Imperative controller and local UI state — keep

The former `ExportPanelControllerContext` and `ExportPanelHandle` were deleted in Phase 5. `EditorInteractionContext` remains a valid runtime boundary for playback refs,
callbacks, and media lifecycle.

Keep component-local state for context-menu navigation/confirmation, custom-color
drafts, title-bar maximize/error state, status-bar remembered export, audio-row control
visibility, export dialog open/settings/command preview, preset dialog drafts, crop
viewport measurements, crop pointer internals, timeline drag/snap state, and copy
feedback. These values have local ownership and no application-level reason to move.

## Planned phases

### Phase 0 — rules and inventory

Completed by this document: add the always-on state-management rule, add the Redux
skill, reconcile React routing, update `AGENTS.md`, and document this inventory. Do
not install Redux or change product code.

### Phase 1 — Redux foundation

After Phase 0 review/merge, add Redux Toolkit and `react-redux`, configure one typed
store/provider, and migrate one deliberately small low-risk domain selected from this
inventory. The pilot must prove provider wiring, typed hooks, selectors, dispatch,
focused tests, and one source of truth without beginning session migration. The store
also provides `redux-persist` opt-in persistence with a root allow-list, standard
serializability exceptions for Redux Persist actions, and a root `PersistGate` for
rehydration. Redux remains runtime-only by default, reducers remain pure, and UI
components only dispatch. Nested persisted reducers may be introduced later when a
domain needs field-level persistence.
Preferences was originally planned as Phase 2A and is complete early as Phase 1's
permanent Redux pilot; it is the first and currently only explicitly configured
persisted domain. Legacy Preferences storage migration is intentionally unsupported.
The remaining Phase 2 domains are editor tools and editor layout.

### Phase 1.5 — Application state infrastructure structure

Completed as a behavior-neutral structural refactor after Phase 1. This phase
establishes the canonical application infrastructure locations:

```text
app/store/*
app/store/slices/*
app/store/persistence.ts
app/contexts/*
app/components/Providers/*
```

Redux store assembly, typed hooks, Preferences slice ownership, and Redux Persist
storage normalization are separated by responsibility. App-level Context declarations
are separated from Provider implementations. The existing theme subsystem remains in
place intentionally. This phase changes no state ownership or runtime behavior.

Preferences → Redux, completed in Phase 1. Editor tools → Redux, completed in Phase
2B. Editor layout → Redux, completed in Phase 2C.

### Phase 2 — editor tools and editor layout

Do not implement one broad editor/view/tools slice. Treat editor tools and editor layout
as independent migration targets because they have different responsibilities, lifetimes,
and transition rules. Preferences is already migrated as the Phase 1 pilot and remains
the source used to initialize active tools or command policy without owning active state.

#### Phase 2B — editor tools

Completed. Current active tool behavior—snap playback, loop playback, segment
playback, and playback speed—now lives in the runtime-only `editorTools` Redux domain.
Preferences supplies one-time initialization and explicit reset defaults without
becoming active state. Consumers and writers use Redux at their semantic boundaries;
the presentational toolbar and runtime playback/controller boundaries remain intact.
Reducer, selector, persistence-exclusion, Preference-independence, reset, and UI
integration coverage was added. Stop for human review before beginning Phase 2C.

#### Phase 2C — editor layout, completed

Migrated panel visibility, workspace layout, editor-stage layout, resize-derived state,
constraints, and reset into the `editorLayout` Redux domain. Preserved the resizable-
panel integration boundary and kept pointer/drag internals local. Consumers now use
focused selectors/actions directly; layout-specific Context/setter wiring and the
transitional `EditorViewState` files were removed. Layout is runtime-only and is not
added to the Redux Persist allow-list.

This migration must remove Context/prop state transport as well as change the canonical
owner: layout consumers should use focused selectors and dispatch at their actual
application boundaries instead of a parent selecting the layout domain and rebuilding
the existing large prop/callback contract. Reusable layout primitives may retain
meaningful presentational props.

The exact ordering may be refined when Phase 2 starts if dependencies suggest a better
sequence, but the domains must remain separate even while the current provider still
exists as an implementation artifact. Each sub-phase follows the normal sequence:
identify owner/readers/writers, establish one Redux owner, migrate consumers, remove
obsolete wiring, validate, and stop for human review before the next boundary.

### Phase 3 — session/source reducer, completed and decomposed in Phase 4.5

Established the session semantics that Phase 4.5 later decomposed into focused
`source`, `trim`, `crop`, `audio`, and `preview` domains. Source/job ID guards,
replacement behavior, and consumer integration coverage were preserved.

### Phase 4 — source/media orchestration

Completed. The Phase 4 workflow inventory covered capability checking, native chooser,
inspection, source replacement/close, drag/drop subscription and import, preview and
proxy fallback, audio-preview preparation, waveform preparation, stale source guards,
waveform job identity, listener lifetime, and native cancellation ownership.

Final ownership is:

- `source-media-thunks.ts` contains explicit typed commands for capability checks,
  chooser/import inspection, source close, preview fallback, and waveforms. No listener
  middleware was needed because these are deliberate workflows rather than reactions to
  unrelated state changes.
- `source-media-runtime.ts`, started once from `main.tsx`, probes capabilities and owns
  the native drop listener. The unlisten callback remains outside Redux and cleanup is
  idempotent. Strict Mode cannot duplicate this application-lifetime setup.
- Chosen and dropped `SourceSelection` values converge on `importSource`; Redux source
  IDs reject stale completions before dependent preview/audio work starts. Native Rust
  remains authoritative for source generations, temporary artifacts, and cancellation.
- Serializable audio-preview descriptors/status now live in `audio`; audio elements
  and Web Audio resources remain in the playback runtime. Waveform job IDs use a
  runtime-only module counter and retain the Session job guards.
- FileMenu, App, SourceWorkspace, EditorStage, and the playback controller dispatch
  focused commands/selectors directly. Export runtime state no longer crosses a Context.

Validation includes focused thunk/runtime tests for success and failure paths, source
replacement races, preview fallback, audio previews, waveform supersession, source
close, drag/drop events, and listener cleanup, plus updated App and menu integration
tests. Phase 5 then completed the Export state, queue, presets, and dialog migration.

### Phase 4.5 — Source domain decomposition, completed

The old `session` Redux domain was decomposed into this runtime-only architecture:

```text
preferences
editorTools
editorLayout
importWorkflow
source
trim
crop
audio
preview
```

`source` owns source identity, lifecycle, selection, inspected media, capabilities,
and source error. `trim` owns the canonical timestamp range. `crop` owns normalized
coordinates and derives resolution from source video dimensions. `audio` owns track
configuration, master/merge settings, audio-preview descriptors, and waveform
presentation data. `preview` owns source/proxy preview lifecycle and errors.

`sourceSelected`, `sourceCleared`, `sourceReady`, and `sourceFailed` are shared semantic
events. Source-bound slices handle the relevant events through `extraReducers`, so one
source replacement atomically resets trim, crop, audio, and preview without sequential
UI reset dispatches. Each domain keeps its own source ID where needed for stale-result
rejection; Audio additionally keeps waveform job IDs. Waveform orchestration remains
in Phase 4 source/media thunks, and runtime audio resources remain outside Redux.

Phase 4 orchestration was adapted only at its action and selector imports; its
responsibility and sequencing are unchanged. The previous future Crop phase was
absorbed into this phase; Phase 5 removed the final Export-only session boundary.

### Phase 5 — export state and queue

Export state is owned by the runtime-only `export` Redux slice. It exposes focused
selectors and domain actions for queue entries, queued/running/completed/failed/
cancelled lifecycle, progress, queue execution, finish policy, optimized dialog
open/close, settings, command-preview status, and launch errors. The `exportPresets`
slice owns reusable preset records and arguments; it retains the explicit reviewed
feature storage adapter rather than entering the Redux Persist allow-list.

Queue entries are immutable job snapshots at queue time: source identity/reservation,
trim, crop, audio selection, route, optimized settings, and output selection are
captured in the serializable entry. Source replacement does not change queued jobs.
The runtime queue retains pending jobs and all non-serializable execution details,
while Rust remains authoritative for paths, temporary media, FFmpeg processes,
cancellation, and source reservations. Native progress and terminal results dispatch
focused Redux lifecycle actions.

`OptimizedExportDialog` is mounted directly by the application feature boundary and
selects its own state. File menu, keyboard shortcuts, and dialog actions dispatch
semantic commands directly. Fast Cut and optimized export use the same thunk-to-
typed-adapter-to-runtime-queue path. `ExportPanel`, `ExportPanelHandle`,
`ExportPanelControllerContext`, `ExportPanelControllerProvider`,
`useExportPanelController`, `useExportController`, and the Export-only session
Context/provider/hook were deleted.

Queue/runtime/dialog state, active settings, and queue snapshots are not persisted.
Preferences persistence is unchanged. Presets remain intentionally persisted only by
their existing explicit feature adapter. Stop for human review.

### Phase 6 — playback cleanup

Evaluate any genuinely shared playback status. Keep pointer, media-element, audio-graph,
and per-frame values local/runtime-owned. Do not dispatch per-frame updates. Stop for
review.

### Phase 7 — remaining Context audit

Explicitly decide keep/reduce/move/remove for updater, theme, interaction, and
controller contexts. The objective is no accidental application-state Context, not
zero Context.

### Phase 8 — wiring cleanup

Search for application-state values/callbacks forwarded through components without
semantic ownership. Remove root and intermediate transport props while preserving
presentational APIs and explicit composition contracts.

Audit broad Redux selectors such as whole-domain selectors and aggregate feature selectors
alongside the prop/callback wiring review. Consumers should use the narrowest meaningful
selector: replace aggregate selection where a component reads only a small subset, but
keep an aggregate selector where the consumer genuinely owns or uses the aggregate.
Do not rebuild broad Context-style dependency surfaces through Redux selectors. Verify
that broad selectors are not causing unrelated rerenders or recreating state coupling;
Keep an aggregate selector only when a consumer genuinely owns or uses that aggregate.
Stop for review.

### Phase 9 — consolidation

Remove obsolete providers/hooks/reducers/adapters, audit selectors and serializability,
verify dependency direction, persistence behavior, source replacement, cancellation,
queue execution, listener cleanup, and full frontend/native quality gates. Produce the
final migration summary. Do not merge `redux-migration` into `master`.

## Phase acceptance checklist

For every phase:

- exactly one canonical owner exists for every migrated value;
- no native/runtime object or callback has entered Redux;
- source IDs, operation IDs, waveform job IDs, cancellation, and cleanup guarantees
  remain intact;
- reducer/selector and relevant feature tests cover changed observable behavior;
- required frontend/native/media validation is run and reported exactly;
- the branch is reviewed in a PR targeting `redux-migration`;
- implementation stops until a human approves and merges the phase.
