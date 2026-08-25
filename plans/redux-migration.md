# EasyTrim Editor Redux migration plan

Status: Phase 0 — architecture and rules only

This is the maintained plan for the controlled Redux Toolkit migration. It is based
on the frontend and native architecture at the `master` baseline used to create the
`redux-migration` integration branch. No Redux dependency or runtime implementation is
introduced by Phase 0.

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
- Active editing state, tool defaults, theme preferences, and export presets retain
  their current lifetime/persistence behavior until a later reviewed phase explicitly
  changes it. Redux persistence is not part of this migration.

## Current composition and ownership

The current composition in `apps/desktop/src/App.tsx` is:

```text
AppUpdatesProvider                 updater service Context
  ThemeProvider                     theme/environment Context
    EditorViewStateProvider         shared view/tools Context
      EditorSessionProvider         session hook + crop local state Context
        ExportPanelControllerProvider imperative panel-ref Context
          EditorContractsProvider   playback/controller Context
            EasyTrimEditorApp       root composition and prop wiring
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

There is no `Redux now` domain at the Phase 0 baseline because the store does not yet
exist. All application domains listed as `Redux later` remain on their current owners
until a reviewed implementation phase establishes the new source of truth.

## Ownership classification

| Domain                             | Classification            | Current owner                                                                                | Target / phase                                                                                   |
| ---------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Source/session/media lifecycle     | Redux later               | `sessionReducer` inside `useEasyTrimEditorApp`, exposed through `EditorSessionContext`       | One coherent session/source slice in Phase 3; async extraction in Phase 4                        |
| Shared editor tools and view       | Redux later               | `EditorViewStateContext` and `tool-settings.ts`                                              | Feature-owned editor view slice in Phase 2                                                       |
| Crop selection and crop resolution | Redux later               | `EditorSessionProvider` source-bound state plus `useCropSelection` pointer state             | Canonical crop values in preview/editor state in Phase 6; pointer internals stay local           |
| Playback transport and media graph | Keep runtime/native-owned | `useEditorInteractionController`, `EditorContractsProvider`, DOM/media refs, Web Audio nodes | Keep local/runtime; audit in Phase 6                                                             |
| Export queue status                | Redux later               | React queue state in `useEasyTrimEditorApp` plus module-level runtime queue                  | Serializable export slice in Phase 5; job handles and queue engine remain runtime-owned          |
| Export presets                     | Redux later               | `exportPresetReducer` in `useEasyTrimEditorApp`, persisted by `export-presets.ts`            | Export/preset slice in Phase 5; persistence remains an explicit adapter                          |
| Import/drop workflow status        | Redux later               | `useEasyTrimEditorApp` local state and native drag-drop listener                             | Source/import workflow actions in Phase 4, boundary to be finalized with orchestration           |
| Updater status                     | Keep Context              | `AppUpdatesProvider`; native `AvailableUpdate` object in a ref                               | Keep service Context; audit serializable status in Phase 7                                       |
| Theme and accepted preferences     | Keep Context              | `ThemeProvider`, `ThemeContext`, `localStorage` adapter                                      | Keep environment Context; no Redux persistence                                                   |
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

### 2. Shared editor view/tools — Redux later, Phase 2

Current owner: `EditorViewStateProvider` in
`apps/desktop/src/app/editor-view-state.tsx`, backed by `useState`. It owns active
tools (`safeTrimFollowingEnabled`, loop, segment, playback speed), persisted tool
defaults, source-details/timeline visibility, and workspace/editor-stage panel
layouts.

Readers include `PanelVisibilityControls`, `SourceWorkspace`, `EditorStage`,
`useTimelineTools`, `useEditorInteractionController`, Settings/View menus, and
`EditorSessionProvider` for the merge default. Writers are toolbar/menu controls and
resizable-panel callbacks. The propagation problem is a broad Context plus a
`toolDefaults.mergeAudioEnabled` value passed into `useEasyTrimEditorApp` through the
session provider.

Target source of truth: an editor-owned view/tools slice, likely with selectors such as
`selectEditorTools`, `selectToolDefaults`, `selectShowSourceDetails`,
`selectShowTimeline`, `selectWorkspaceLayout`, and `selectEditorStageLayout`.
Domain actions should include `toolChanged`, `toolReset`, `toolDefaultChanged`,
`toolDefaultsReset`, `sourceDetailsVisibilityChanged`, `timelineVisibilityChanged`,
and layout changes. `mergeAudioEnabled` is a default preference, not source-bound
audio state.

Side-effect owner: the existing `tool-settings.ts` storage adapter remains outside the
reducer. A later reviewed implementation may use a narrowly scoped listener or
explicit adapter call for persistence; it must not introduce Redux persistence.

Reset/lifetime: view layout/visibility and active tool state retain current process
lifetime. Source replacement must not silently reset them. Existing tool defaults keep
their accepted preference behavior.

Expected obsolete code: `EditorViewStateContext`, `EditorViewStateProvider`,
`useEditorViewState`, and `useTimelineTools` transport wrappers once all consumers use
focused selectors/actions. `EditorStage` and `SourceWorkspace` should connect near
their state needs without making presentational controls store-aware.

### 3. Crop and preview editing values — Redux later, Phase 6

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

### 4. Playback and transport — keep local/runtime-owned, Phase 6 audit

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

### 5. Export queue and execution — Redux later, Phase 5

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

### 6. Export presets — Redux later, Phase 5

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

### 7. Import/drop workflow and native dialog status — Redux later, Phase 4

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

### 8. Updater — keep Context, Phase 7 audit

Current owner: `AppUpdatesProvider` and `AppUpdatesContext`. Serializable values are
status, available version, and installing state. The actual `AvailableUpdate` object,
checking/installing guards, and install callback are kept in refs. Readers are
`StatusBar` and `HelpMenu`.

Keep the service Context unless a later inventory finds enough disconnected consumers
to justify a small updater-status slice. Even then, only serializable status belongs in
Redux; the native updater object and install operation remain in the provider/service.

### 9. Theme and preferences — keep Context

Current owner: `ThemeProvider` and `ThemeContext`. It manages theme resolution against
the system preference, primary-color scrubbing, DOM CSS variables, and accepted
preference persistence through `lib/storage.ts`. Keep it as an environment/style
boundary. Color wheel drafts and pointer state remain local. Redux is not a reason to
replace this Context or add a persistence layer.

### 10. Imperative controller and local UI state — keep

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
focused tests, and one source of truth without beginning session migration.

### Phase 2 — editor/view/tool state

Migrate active tools, defaults, visibility, and layouts where shared ownership is
confirmed. Preserve the existing preference adapter. Remove `EditorViewStateContext`
only when no legitimate Context responsibility remains. Stop for review.

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
