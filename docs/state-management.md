# EasyTrim state management

EasyTrim uses Redux Toolkit for shared, serializable application state while keeping ephemeral UI
state and runtime resources close to their owners.

## Ownership model

- **Redux** owns editor/application state shared across unrelated UI, used by multiple interaction
  paths, or participating in a workflow: source selection/readiness, media capabilities, trim,
  audio choices, preview status, tools, export queue, Preferences, and serializable workflow
  status. Preferences owns durable user choices such as theme, primary colors, activity feed view,
  and editor defaults.
- **Feature Redux** remains with the owning capability when multiple consumers or complex domain
  transitions justify it. It is not a generic global bucket.
- **Local React state or feature-hook state** owns hover, focus, disclosure, popovers, pointer
  drags, animation, draft form values, copy feedback, and other transient visual interaction.
- **Context** remains appropriate for dependency injection, environment providers, updater services,
  and imperative controller boundaries.
- **Runtime owners** keep DOM/media refs, timers, abort controllers, callbacks, AudioContext and
  MediaNode instances, Tauri objects, and other mutable/non-serializable handles. Redux stores only
  serializable status or descriptors needed by the UI.

## Store and slice design

The application store, typed hooks, persistence integration, and application-owned slices live in
`app/store/`; a feature may keep a feature-owned slice beside its capability. Store composition is
focused, with one coherent responsibility per slice and selectors colocated with the state they
encapsulate. Prefer domain/event actions such as `sourceSelected`, `trimChanged`, and
`exportCompleted` over an uncontrolled collection of generic setters.

Reducers are pure. They do not call Tauri, FFmpeg/FFprobe, browser media APIs, storage, timers, or
other effects. Components dispatch actions and read through narrow typed selectors; they do not
manually synchronize Redux to storage or pass Redux values through intermediate components solely
for transport.

Redux state is runtime-only unless a domain is explicitly persisted with `redux-persist`. Persist
only stable, user-facing domains; never persist transient, session, native, or runtime-owned state.

## Async workflows and source replacement

Use a plain action for synchronous transitions, a thunk for an explicit async use case, listener
middleware for state/event reactions, and a dedicated runtime/service for native resources and
cleanup. Do not add another effects framework.

Source and operation IDs identify asynchronous work. Stale inspect, preview, audio-preview, and
waveform results must be ignored; waveform job IDs reject older completions. Cancellation and
listener cleanup are idempotent, partial failures remain observable, and queued exports retain
reserved source resources until released. Source replacement resets source-bound state while
retaining only intentionally broader defaults or presets.

Open editor sessions use the single `editingInstances` slice. It owns stable instance IDs, current
snapshots, per-instance settings, source availability, and serializable export-attempt history.
Attempt requests and snapshots are captured at launch, while transient source/trim/crop/audio
slices remain the active working view. The runtime owns native job handles; Redux records lifecycle
state keyed by `(instanceId, attemptId)`. See [Editing instance lifecycle](editing-instance-lifecycle.md).

Do not dispatch on every video frame, pointer movement, animation tick, or audio-graph update.
High-frequency synchronization stays in local state or refs unless a reviewed cross-feature need
establishes otherwise.

## Change guidance

Before moving a value, identify its current and target source of truth, all readers and writers,
transition side effects, lifetime/reset semantics, and why shared Redux ownership is necessary.
Maintain one canonical owner; do not keep Context and Redux as synchronized stores after a migration
has settled. Reducer, selector, and async-boundary tests should cover observable success, failure,
cancellation, stale-result rejection, and cleanup behavior where applicable.
