# EasyTrim Editor Redux migration plan

Status: Phase 2B — Editor tools Redux migration complete; Phase 2C is next

This is the maintained plan for the controlled Redux Toolkit migration. It is based
on the frontend and native architecture at the `master` baseline used to create the
`redux-migration` integration branch. Phase 1 introduced the Redux foundation and
migrated Preferences as the first permanent Redux-owned domain. Phase 1.5 establishes
the application infrastructure structure before the next functional migration.

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
        EditorViewStateProvider     editor layout Context only
          EditorSessionProvider     session hook + crop local state Context
            ExportPanelControllerProvider imperative panel-ref Context
              EditorContractsProvider playback/controller Context
                EasyTrimEditorApp   root composition and prop wiring
```

`useEasyTrimEditorApp` currently owns a reducer-backed `SessionState` plus unrelated
queue, import workflow, audio-preview, and preset state. `EditorSessionContext` exposes
that aggregate to the application and features. `useSourceDetails` and
`useEditorContracts` reshape the aggregate into feature contracts, which makes the
source and callback path convenient but also causes root-level wiring and broad
subscriptions.

The native side remains authoritative for source paths, source generations, media
inspection, preview/audio-preview/waveform artifacts, export-source reservations,
operation cancellation, and FFmpeg process execution. Rust `AppState` stores those
runtime resources in memory; Redux must never replace that authority.

Redux owns Preferences and active Editor tools. The store registers only Preferences
for persistence and hydrates it before downstream editor initialization; Editor tools
are runtime-only. The remaining application domains listed as `Redux later` stay on
their current owners until a reviewed implementation phase establishes a new source
of truth.

## Ownership classification

| Domain                             | Classification            | Current owner                                                                                | Target / phase                                                                                   |
| ---------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Source/session/media lifecycle     | Redux later               | `sessionReducer` inside `useEasyTrimEditorApp`, exposed through `EditorSessionContext`       | One coherent session/source slice in Phase 3; async extraction in Phase 4                        |
| Preferences                        | Redux now                 | Redux `preferences` slice; root `redux-persist` allow-list                                   | Completed Phase 1 pilot; persisted by explicit Redux Persist configuration                       |
| Editor tools                       | Redux now                 | `editorTools` Redux slice; initialized and reset from Preferences defaults                   | Completed Phase 2B; runtime-only active state                                                    |
| Editor layout                      | Redux later               | Visibility/layout state in `EditorViewStateProvider` and resizable-panel callbacks           | Dedicated editor-layout domain; Phase 2C                                                         |
| Crop selection and crop resolution | Redux later               | `EditorSessionProvider` source-bound state plus `useCropSelection` pointer state             | Canonical crop values in preview/editor state in Phase 6; pointer internals stay local           |
| Playback transport and media graph | Keep runtime/native-owned | `useEditorInteractionController`, `EditorContractsProvider`, DOM/media refs, Web Audio nodes | Keep local/runtime; audit in Phase 6                                                             |
| Export queue status                | Redux later               | React queue state in `useEasyTrimEditorApp` plus module-level runtime queue                  | Serializable export slice in Phase 5; job handles and queue engine remain runtime-owned          |
| Export presets                     | Redux later               | `exportPresetReducer` in `useEasyTrimEditorApp`, persisted by `export-presets.ts`            | Export/preset slice in Phase 5; persistence remains an explicit adapter                          |
| Import/drop workflow status        | Redux later               | `useEasyTrimEditorApp` local state and native drag-drop listener                             | Source/import workflow actions in Phase 4, boundary to be finalized with orchestration           |
| Updater status                     | Keep Context              | `AppUpdatesProvider`; native `AvailableUpdate` object in a ref                               | Keep service Context; audit serializable status in Phase 7                                       |
| Theme and style environment        | Keep Context              | `ThemeProvider`, `ThemeContext`, `localStorage` adapter                                      | Keep environment Context; no Redux persistence                                                   |
| Imperative export-panel controller | Keep runtime/native-owned | `ExportPanelControllerContext` and `ExportPanelHandle` ref                                   | Keep Context; remove only accidental transport during Phase 8 if possible                        |
| Editor interaction contracts       | Keep runtime/native-owned | `EditorInteractionContext` and `useEditorInteractionController`                              | Keep Context for refs/callbacks/media lifecycle; reduce only if a later boundary makes that safe |
| Component and pointer UI state     | Keep local                | Feature/component hooks and local state                                                      | Remains local throughout the migration                                                           |

## Detailed domain inventory

### 1. Source/session/media lifecycle — Redux later, Phase 3/4

Current owner: `sessionReducer` in
`apps/desktop/src/app/session-state.ts`, instantiated by
`apps/desktop/src/app/hooks/useEasyTrimEditorApp.ts`, then exposed through
`EditorSessionContext` and `useSourceDetails`.

Current state includes:

- capability status (`checking`, `ready`, `failed`);
- session status (`idle`, `loading-source`, `ready`, `failed`);
- source selection identity/display name;
- inspected `MediaInfo` and source-bound `PreviewState`;
- trim range;
- audio-track enablement, per-track volume, master volume/enablement, and merge flag;
- waveform status by stream, width, job ID, URL, and error;
- last source/application error.

Readers include `App.tsx`, `SourceWorkspace`, `SourceSidebar`, capability/source
components, `EditorStage`, preview/audio/timeline features, export composition, File and
Settings menus, and the editor interaction controller. Writers are the source picker
and Tauri drop listener, inspection/preview/proxy/audio-preview/waveform completions,
trim and audio controls, and image-error callbacks. The current propagation problem is
that `EditorSessionContext` exposes the entire hook result, then `useSourceDetails`
creates a second aggregate contract while `App.tsx` forwards source data and callbacks
into `ExportPanel`.

Target source of truth: one Redux-owned session/source domain, with slice boundaries
kept together where source invariants require them. Candidate selectors are:
`selectSessionStatus`, `selectCapabilities`, `selectActiveSource`, `selectSourceMedia`,
`selectPreview`, `selectTrim`, `selectAudioTracks`, `selectAudioPreviewState`, and
`selectCanExport`. Candidate actions are `sourceSelected`, `sourceCleared`,
`sourceReady`, `sourceFailed`, `previewLoading`, `previewReady`, `previewFailed`,
`trimChanged`, audio transition actions, and waveform loading/result/failure actions.

Side-effect owner: Phase 3 keeps the existing hook/service orchestration while the
slice becomes the only state owner. Phase 4 moves choosing/importing, inspection,
preview preparation, proxy fallback, audio previews, waveforms, capabilities, and
drop events into explicit thunks/listeners or a narrow orchestration adapter. Typed
functions in `apps/desktop/src/lib/tauri/media.ts` remain the native boundary.

Reset/lifetime: selecting a source establishes a new source ID and resets media,
preview, trim, audio tracks, waveform records, crop, and audio-preview descriptors.
Stale source IDs and waveform job IDs reject old completions. Failed replacement stays
the current failed import rather than restoring the previous source. Accepted tool
defaults and presets survive source replacement. Native Rust `AppState` continues to
cancel source-bound helpers and retain explicitly reserved export sources.

Expected obsolete code: the aggregate `EditorSessionContext` value, `useSourceDetails`
transport wrappers, duplicated source callback forwarding, and the session reducer's
React hook instantiation disappear only after the slice and consumers are migrated.
The low-level `AudioTracks`, preview, timeline, and export presentational contracts may
remain props where they are useful reusable APIs.

### 2. Preferences — Redux now, completed Phase 1 pilot

Canonical owner: the Redux `preferences` slice in
`apps/desktop/src/app/store/slices/preferences-slice.ts`. It owns the four tool defaults for safe
trim following, loop playback, segment playback, and merge audio. The slice starts
from deterministic product defaults; it does not read storage while the module is
initialized.

Readers include `SettingsMenu` through focused selectors and `EditorSessionProvider`
for the merge-audio initialization policy. Writers are the Settings actions
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

The active-tool fields were removed from `EditorViewStateContext` and
`EditorViewStateProvider`; `useTimelineTools` was removed because it only reshaped
that Context state. The transitional provider now owns editor layout only. The
presentational `TimelineTools` props remain a useful feature boundary.

### 4. Editor layout — Redux later, Phase 2C

Current owner: `EditorViewStateProvider` stores `showSourceDetails`, `showTimeline`,
`workspaceLayout`, and `editorStageLayout`. `SourceWorkspace`, `EditorStage`, and
`PanelVisibilityControls` apply those values to `react-resizable-panels`; resize
callbacks write back through generic Context setters. `useTimelinePanelSizing` and
`timeline-pane-sizing.ts` contain related panel constraints and sizing calculations.

Readers include `PanelVisibilityControls`, `SourceWorkspace`, `EditorStage`, panel
separators, and the panel-sizing hook. Writers are the top-bar visibility controls,
workspace/editor-stage resize callbacks, panel collapse/expand effects, and future
restore/reset commands. The wiring problem is that non-trivial visibility, dimensions,
valid panel combinations, and resize-derived behavior are modeled as unrelated generic
setters beside tool state.

Target source of truth: a dedicated editor-layout domain owning canonical serializable
visibility and layout state. Likely selectors include `selectPanelVisibility`,
`selectShowSourceDetails`, `selectShowTimeline`, `selectWorkspaceLayout`,
`selectEditorStageLayout`, and `selectNormalizedLayout`. Likely actions include
`panelVisibilityChanged`, `workspaceLayoutChanged`, `editorStageLayoutChanged`,
`layoutRestored`, and `layoutReset`.

Side-effect owner: React-resizable-panels remains the imperative UI integration boundary.
Pure layout normalization, constraint, and valid-combination calculations remain
adjacent pure functions with focused tests. Reducers/actions coordinate canonical
serializable layout transitions; they do not own panel refs or pointer/drag internals.

Reset/lifetime: layout is runtime application state and retains its current process
lifetime across source replacement. Showing/hiding a panel must preserve or normalize
valid dimensions according to layout constraints. Restore applies a validated layout;
reset returns the documented defaults. Component-local pointer/drag state remains
local/runtime-owned.

Expected obsolete code: layout fields and generic setters in
`EditorViewStateContext`, the layout portion of `EditorViewStateProvider`, and layout
forwarding through `useEditorViewState`. `SourceWorkspace` and `EditorStage` should
connect to layout selectors/actions near their semantic ownership while presentational
panel primitives remain reusable.

### 5. Crop and preview editing values — Redux later, Phase 6

Current owner: `EditorSessionProvider` keeps `cropResolution` and canonical `crop` in
local state and exposes them through `EditorSessionContext`. `useCropSelection` owns
the crop dialog, pointer drag, frame, and animation internals. Readers include
`VideoPreview`/`CropViewport` and the export panel; writers are crop interaction
callbacks and source-media reset logic.

The canonical normalized crop and resolution are shared by preview and optimized
export, so they are a candidate for feature-level Redux after core session migration.
Selectors/actions may be `selectCrop`, `selectCropResolution`, `cropChanged`, and
`cropResolutionChanged`. The viewport bounds, source aspect-ratio measurement,
pointer ID, drag state, and transition frame remain local/runtime-owned.

Side-effect owner: none for the pure values; export request construction continues in
the export feature and native adapter. Reset to full crop and source dimensions on
source replacement. Expected obsolete code is the crop portion of
`EditorSessionContext`, not the crop interaction hook itself.

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

Current owner: `exportQueue`, `queueStarted`, `queueFinishAction`, and available finish
actions are React state in `useEasyTrimEditorApp`. `export-queue.ts` separately owns
module-level `pendingJobs`, `jobsById`, execution gating, source reservations,
cancellation, FFmpeg progress, and callbacks that update `ExportToast` state.

Readers include `StatusBar`, `SourceSidebar`/`ExportQueue`, QueueMenu, App-level start
and dialog wiring, and export controls. Writers are `useExportController`, queue
keyboard/menu actions, native progress, cancellation, completion/failure, and queue
finish effects. The propagation problem is `setQueue` and queue callbacks crossing
`App.tsx` and feature props while the actual execution state lives in a module-level
controller.

Target source of truth: a serializable export slice for queue entries and queue
workflow status. Candidate selectors are `selectExportQueue`,
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

Expected obsolete code: `setQueue` prop plumbing and queue state in the root hook. The
module-level runtime job map is not obsolete unless a replacement service preserves
its ownership guarantees.

### 8. Export presets — Redux later, Phase 5

Current owner: `exportPresetReducer` and `ExportPresetState` in
`features/export/export-presets.ts`, instantiated in `useEasyTrimEditorApp` and
persisted through `localStorage` on every state change. Readers are `ExportPanel`,
`PresetManager`, optimized export settings, and Settings menu paths. Writers are
preset selection, argument editing, create/update/delete actions passed through
`onPresetAction`.

Target source of truth: an export-preset slice with the existing domain actions
(`argumentsChanged`, `presetSelected`, `presetNewStarted`, `presetCreated`,
`presetUpdated`, `presetDeleted`) and selectors for the selected preset, arguments,
and available presets. Preserve validation and stable preset IDs; do not replace this
with generic setters.

Side-effect owner: the existing load/persist adapter remains outside reducers. The
current accepted persistence behavior is preserved until a later reviewed decision.
Presets outlive source replacement and are runtime preferences, not project/session
state.

Expected obsolete code: the reducer instance and `onPresetAction` root forwarding.
The preset domain module and persistence adapter remain, potentially relocated under
the owning feature.

### 9. Import/drop workflow and native dialog status — Redux later, Phase 4

Current owner: `useEasyTrimEditorApp` local state for `isChoosingSource`,
`isNativeDialogOpen`, `isSourceDragActive`, `dropListenerError`, and source selection
callbacks. Readers are App overlays, CustomTitleBar/FileMenu, SourceWorkspace/DropOverlay,
and keyboard shortcut paths. Writers are native picker/drop events and export output
dialog callbacks.

Target source of truth: finalize during Phase 4 as either a small source-import slice
or part of the session/source slice; do not create a generic app slice. Candidate
selectors are `selectIsChoosingSource`, `selectIsNativeDialogOpen`,
`selectIsSourceDragActive`, and `selectDropListenerError`. Candidate actions are
`sourceChoiceStarted`, `sourceChoiceFinished`, `sourceDragChanged`, and
`dropListenerFailed`.

Side-effect owner: a thunk/listener or narrow integration hook calls the typed media
adapter and owns drag-drop subscription cleanup. The native dialog itself remains
native-owned. Reset drag/error status on a new event; source import failure remains an
observable failed transition.

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

`ExportPanelControllerContext` owns an `ExportPanelHandle` ref and imperative actions;
it is non-serializable controller state and remains Context. `EditorInteractionContext`
has the same status for playback refs/callbacks.

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
are separated from Provider implementations. The transitional `EditorViewState`
infrastructure and the existing theme subsystem remain in place intentionally. This
phase changes no state ownership or runtime behavior.

Preferences → Redux, completed in Phase 1. Editor tools → Redux, completed in Phase
2B. Editor layout remains the next functional migration.

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

#### Phase 2C — editor layout

Migrate panel visibility, workspace layout, editor-stage layout, resize-derived state,
normalization, valid constraints, restore, and reset into its own layout domain.
Preserve the resizable-panel integration boundary and keep pointer/drag internals
local. Keep normalization and constraint calculations pure and tested. Migrate
consumers and remove layout-specific Context/setter wiring, validate hidden/shown and
resize transitions, and stop for review.

The exact ordering may be refined when Phase 2 starts if dependencies suggest a better
sequence, but the domains must remain separate even while the current provider still
exists as an implementation artifact. Each sub-phase follows the normal sequence:
identify owner/readers/writers, establish one Redux owner, migrate consumers, remove
obsolete wiring, validate, and stop for human review before the next boundary.

### Phase 3 — session/source reducer

Move the existing session reducer semantics into the chosen session/source slice.
Preserve source selection, media readiness/failure, trim, audio state, preview state,
capabilities, waveform states, and source/job ID guards. Add focused reducer/selector
tests and remove duplicate ownership. Stop for review.

### Phase 4 — source/media orchestration

Reduce `useEasyTrimEditorApp` by moving choosing/importing, inspection, preview/proxy,
audio-preview, waveform, capability, and drop workflows into the approved thunk/listener
convention. Keep typed Tauri adapters and Rust-owned paths/processes. Verify stale
results, cancellation, listener cleanup, and source replacement. Stop for review.

### Phase 5 — export state and queue

Migrate serializable export queue/preset state and root wiring. Keep runtime queue jobs,
source reservations, output IDs, progress channels, cancellation, and native finish
actions outside reducers. Preserve accepted preset persistence and queue behavior. Stop
for review.

### Phase 6 — crop and playback cleanup

Evaluate canonical crop values and any genuinely shared playback status. Keep pointer,
media-element, audio-graph, and per-frame values local/runtime-owned. Do not dispatch
per-frame updates. Stop for review.

### Phase 7 — remaining Context audit

Explicitly decide keep/reduce/move/remove for updater, theme, interaction, and
controller contexts. The objective is no accidental application-state Context, not
zero Context.

### Phase 8 — wiring cleanup

Search for application-state values/callbacks forwarded through components without
semantic ownership. Remove root and intermediate transport props while preserving
presentational APIs and explicit composition contracts. Stop for review.

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
