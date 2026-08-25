# Frontend state-management rule

Apply this rule to every frontend state or architecture change. Redux Toolkit is the
approved application-state mechanism for the EasyTrim Editor migration. This rule
supplements the React interface skill; it does not require every React value to move
into Redux.

## Classify ownership before editing

Every new or migrated value must have one clearly identified owner:

### Application and domain state

Use Redux when the value represents the editor/application, is read by unrelated UI
regions, changes through more than one interaction path, participates in a workflow
or domain transition, is needed by keyboard/menu/native-event paths, or must survive
component rearrangement.

Examples include source selection and readiness, media capabilities, trim, audio
track choices, source-bound preview status, shared editor tools, export queue state,
and serializable workflow status.

### Feature state

Feature-owned Redux is appropriate when multiple consumers or complex transitions
justify it. Keep the code in the owning feature; do not move feature state into a
generic global dumping ground merely because it is shared.

### Local ephemeral UI state

Keep state local to a component or feature hook when its ownership is naturally local
and no external consumer needs it. This includes hover, temporary focus, disclosure
and popover state, pointer-drag internals, animation state, draft form values, copy
feedback, and other transient visual interaction state.

Do not promote local state merely because Redux is available.

### Environment and service boundaries

React Context remains valid for dependency injection, environment, or runtime
services. Theme/environment providers, updater services, and imperative controller
boundaries may remain Context when that is clearer than Redux.

### Native and non-serializable resources

Never store runtime handles or mutable objects in Redux. Keep DOM nodes, media
element refs, timers, animation handles, AbortControllers, Tauri/native update
objects, callbacks, AudioContext/MediaNode instances, and mutable third-party
instances in their owning adapter or controller. Store only serializable status or
descriptors when the UI needs to observe them.

## Store structure

- Use Redux Toolkit and one application store composed from focused reducers/slices. Keep the
  application store, typed hooks, and Redux Persist integration in `app/store/`.
- Do not create a monolithic `appSlice`, a catch-all slice, or slices based only on
  React component boundaries.
- Choose boundaries from product/domain ownership and invariants. A coherent session
  and source domain may remain one slice even when it has many fields; tiny slices
  without independent ownership are not an improvement.
- Keep product state under `apps/desktop/src/app/store/` or the owning feature, following
  the repository dependency direction. Application-owned slices live under `app/store/slices/`;
  feature-owned Redux domains may remain with their owning feature.
- Keep the store serializable by default. Configure middleware deliberately and do
  not disable serializability checks globally to hide warnings.
- Redux state is runtime-only by default. Persistence is explicit and opt-in per
  domain through `redux-persist`. Use a root allow-list when a complete domain is
  persisted; use a nested persisted reducer when only selected fields are persisted.
  Unconfigured domains must not hydrate or persist automatically.
- Components and UI handlers must only dispatch Redux actions; they must not manually
  synchronize Redux state to storage. Reducers remain pure, and persistence adapters
  stay outside reducers and the slice modules. Do not persist transient, session,
  native, or other runtime-owned state.
- Use `redux-persist` as the Redux persistence mechanism; do not add another
  persistence library. Existing non-Redux theme and preset adapters remain with their
  owning domains. Do not persist transient, session, native, or other runtime-owned
  state without an explicit product requirement.

## Slice contracts

Each slice must have one coherent responsibility, stable domain vocabulary, focused
state, colocated selectors, and focused reducer tests. Prefer domain/event actions
such as `sourceSelected`, `sourceReady`, `trimChanged`, `queueStarted`, and
`exportCompleted` over an uncontrolled collection of generic setters. A simple setter
is acceptable for a genuinely independent preference or view flag.

Reducers are pure. They must not call Tauri, FFmpeg/FFprobe, browser media APIs,
storage, timers, or other effects.

## Selectors and React integration

- Expose typed `useAppDispatch` and `useAppSelector` hooks from the application store
  integration.
- Components normally read Redux through narrow selectors. Selectors hide state shape
  where that improves domain encapsulation.
- Keep derived values derived. Prefer selectors such as `selectActiveSource` and
  `selectCanExport` over separately synchronized mutable fields.
- Memoize only when computation or reference stability requires it.
- Connect application/feature components near the dependency. Keep reusable low-level
  controls presentational and independent from Redux when their props are a meaningful
  component contract.
- Do not pass a Redux-backed value and callback through intermediate components solely
  for transport. Props remain correct for presentation, composition, parent-owned
  state, and generic reusable components.
- Do not import the store singleton throughout arbitrary modules. Direct
  `store.getState()` or `store.dispatch()` outside the React integration boundary
  requires a concrete architectural reason and must not bypass typed adapters.

## Async orchestration

Use the smallest mechanism that expresses the workflow:

- plain action and reducer for synchronous transitions;
- thunk for an explicit async command or use case;
- listener middleware for reactions to state transitions or events when that decouples
  the workflow cleanly;
- an existing dedicated runtime/service module for ownership of native resources,
  child processes, subscriptions, and cleanup.

Do not introduce sagas or another state/effects framework. Redux modules may call typed
Tauri/service adapters through a narrow orchestration boundary, but they must not own
filesystem paths, FFmpeg command construction, native handles, or process lifecycle.

## Source replacement and async correctness

Every migrated domain must preserve the current source-replacement guarantees:

- source and operation IDs identify async work;
- stale inspect, preview, audio-preview, and waveform results are ignored;
- waveform job IDs reject older completions;
- cancellation and listener cleanup remain idempotent;
- partial failures remain observable and do not become false success;
- queued exports retain their explicitly reserved source resources until released.

Important transitions should become easier to inspect in Redux, not hide race handling
inside generic effects. Source replacement resets source-bound state while retaining
only state whose lifetime is intentionally broader, such as accepted tool defaults or
presets. Native/runtime cleanup remains with the native or runtime owner.

Do not dispatch on every video frame or use Redux as a media-element synchronization
bus. High-frequency playhead, pointer, animation, and audio graph coordination stays
in local state or refs unless a later reviewed design establishes a real cross-feature
need.

## Migration discipline

Before moving a value, document:

1. the current source of truth;
2. the target source of truth;
3. every writer and reader;
4. side effects caused by transitions;
5. lifetime and reset semantics;
6. why the value belongs in Redux at all.

During migration there must be one canonical owner for each domain. Do not keep Context
and Redux as synchronized parallel stores beyond a short, explicitly reviewed
transition. Remove obsolete providers, hooks, reducer code, and forwarding props when
the migrated owner is stable.

## Testing

Each migrated slice/domain needs focused reducer and selector tests that assert
observable transitions. Async orchestration tests cover success, failure, cancellation,
stale-result rejection, and cleanup where applicable. Existing feature/component tests
continue to verify user-facing behavior, accessibility, and development usability.

Every phase must leave the application runnable and must stop for human review before
the next migration phase begins.
