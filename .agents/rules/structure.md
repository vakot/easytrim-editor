# Repository structure rule

Apply this rule when creating, moving, or reviewing files and module boundaries.

## Canonical layout

Grow toward this structure without creating empty ceremonial directories:

```text
easytrim-editor/
|-- AGENTS.md
|-- .agents/
|   |-- rules/                         # Shared auto-applied repository policy
|   `-- skills/                        # Task-specific agent workflows
|-- .github/
|   `-- PULL_REQUEST_TEMPLATE.md
|-- apps/
|   `-- desktop/
|       |-- public/                    # Static packaged frontend assets only
|       |-- src/
|       |   |-- app/                   # Composition, initialization, providers, store, orchestration
|       |   |-- components/
|       |   |   `-- ui/                # Shared shadcn/Radix primitives
|       |   |-- domain/                # Genuinely shared pure product logic
|       |   |-- features/
|       |   |   |-- source/
|       |   |   |-- preview/
|       |   |   |-- timeline/
|       |   |   |-- audio/
|       |   |   `-- export/
|       |   |-- lib/                   # Technical infrastructure and typed adapters
|       |   |   `-- tauri/             # Typed IPC adapter; no generic invoke use
|       |   |-- styles/                # Tokens, reset, and application-wide styles
|       |   |-- test/                  # Shared test setup, factories, fixtures, and mocks
|       |   `-- main.tsx
|       `-- src-tauri/
|           |-- binaries/              # Pinned packaged sidecars
|           |-- capabilities/          # Explicit Tauri permissions
|           |-- src/
|           |   |-- application/       # Use-case orchestration
|           |   |-- commands/          # Thin Tauri IPC adapters
|           |   |-- domain/            # Framework-independent types and invariants
|           |   |-- media/             # Probe, preview, waveform, and export builders
|           |   |-- process/           # Child lifecycle, progress, and cancellation
|           |   |-- error.rs
|           |   |-- lib.rs
|           |   |-- main.rs            # Minimal desktop entry point
|           |   `-- state.rs
|           `-- tests/                  # Native integration tests
|-- packages/                           # Shared packages after a second consumer exists
|-- plans/                              # Product and implementation plans
|-- scripts/                            # Deterministic repository automation
`-- tests/
    `-- fixtures/
        `-- media/                      # Tiny generated or redistributable fixtures
```

The root pnpm workspace owns shared tooling and scripts. `apps/desktop` owns its runtime
dependencies and the coupled React/Tauri application. Add a package under `packages/` only when
at least two workspace consumers need a stable shared contract; do not split code merely to make
the repository appear modular.

## Frontend ownership

Use this ownership hierarchy:

```text
app/
|-- application and editor composition
|-- global initialization and providers
|-- Redux store infrastructure
`-- cross-feature lifecycle orchestration

features/
|-- capability orchestration components
|-- capability UI composition
|-- feature-specific hooks and effects
|-- capability Redux consumption
`-- internal feature logic and presentation

components/ui/  shared shadcn/Radix primitives
domain/         genuinely shared pure product logic
lib/            technical infrastructure and adapters
test/           shared test infrastructure
```

Do not move code into `domain/` or global `lib/` merely to make a feature smaller. Move a module
out only when its ownership is genuinely broader than one capability.

### Application infrastructure and composition

```text
app/
|-- components/
|   |-- editor-workspace/               # Application layout composition
|   `-- providers/                      # Provider implementations and global initialization
|-- contexts/                           # App-level Context contracts only
|-- editor-interaction/                 # Cross-feature playback and synchronization logic
|-- hooks/                              # Application and cross-feature hooks
`-- store/
    |-- store.ts
    |-- redux-hooks.ts
    |-- persistence.ts
    |-- middleware/
    `-- slices/
```

- `app/store/` contains Redux composition, typed hooks, persistence integration, and
  application-owned state. A feature-owned Redux domain may remain in its feature when the root
  store deliberately composes it.
- `app/store/persistence.ts` owns Redux Persist configuration and storage-adapter normalization.
- `app/contexts/` contains app-level Context contracts and declarations. It does not own Provider
  runtime effects or initialization.
- `app/components/providers/` contains app-level Provider implementations and initialization.
- The editor entrypoint should read as page and layout composition: it names the feature surfaces
  that form the workspace while each feature owns its own data and internal layout.
- Do not select feature-owned Redux data at the application root solely to pass it back through
  feature props. Application composition may read state that genuinely controls cross-feature
  layout or lifecycle.
- Source replacement, preview reset, timeline reset, audio refresh, and export invalidation are
  cross-feature workflows. Keep them in application listeners, middleware, thunks, services, or
  another application-owned orchestration boundary rather than a visual feature.

Canonical composition example:

```tsx
export function EditorWorkspace() {
  return (
    <WorkspacePanels>
      <SourcePanel />
      <Preview />
      <Timeline />
      <AudioPanel />
    </WorkspacePanels>
  );
}
```

Use existing layout primitives. Do not introduce a generic layout abstraction only to match the
example.

## Capability-first features

The canonical top-level product capabilities are:

```text
features/
|-- source/
|-- preview/
|-- timeline/
|-- audio/
`-- export/
```

Choose stable capability names, not a temporary operation, widget, layout position, or current
implementation detail. For example, `source` owns more than initial import and `audio` owns more
than the current track-list presentation.

Every top-level feature has an intentional `features/<feature>/index.ts` public API. Application
code and other features consume that API whenever practical:

```ts
import { Preview } from "@/features/preview";
```

Do not reach into another feature's `components/`, `hooks/`, or internal logic. Do not use wildcard
exports or broad barrels. Export only meaningful orchestration surfaces and any narrow contract
that is intentionally shared. Feature internals may use direct relative imports.

### Feature shape and growth

Start flat and add only directories that own real files:

```text
features/audio/
|-- index.ts
`-- AudioPanel.tsx
```

A mature feature may grow into:

```text
features/preview/
|-- index.ts
|-- Preview.tsx                         # Public orchestration root
|-- components/                        # Focused feature-local UI
|-- hooks/                             # Cohesive feature interactions and effects
`-- lib/                               # Semantic pure/internal modules when grouping helps
```

- A feature may expose multiple orchestration components when it has multiple independent,
  meaningful application surfaces. Do not create public roots merely to reduce file size.
- An orchestration component owns both capability-level state and logic orchestration and the
  feature's UI/layout composition. It may select Redux state, dispatch actions, use local state,
  coordinate effects, and call capability-specific typed services.
- Do not add a container-to-presentation boundary that only forwards already-resolved feature
  state into a second root. Extract a hook or focused component only when it represents a coherent
  responsibility.
- Feature hooks may own selectors, dispatch, local state, effects, interaction lifecycles, event
  coordination, derived state, and capability-specific service calls. Extract them when that
  logic has a meaningful independent responsibility, not to make a component superficially
  shorter.
- Components under `components/` normally receive the small state and actions needed for their
  focused rendering responsibility. A nested component may read state directly when that clearly
  avoids excessive prop threading, but trivial leaves should remain presentational by default.
- Keep pure feature logic local and give modules semantic names. Introduce `lib/` only when enough
  related internal modules justify grouping.
- Split files when responsibilities diverge, not at an arbitrary line count.

## Redux and runtime ownership

Features are not required to be Redux-free. A capability orchestration root should read and
dispatch intrinsic application state at the closest meaningful boundary. Do not create props
drilling merely to hide Redux from a feature.

Keep non-serializable and platform-owned resources with their runtime owner. Frontend modules use
typed functions from `apps/desktop/src/lib/tauri/`; they do not call generic `invoke`, construct
FFmpeg commands, or acquire arbitrary filesystem or process authority.

Native dependency direction remains:

```text
commands -> application -> domain/media/process
                    `----> managed in-memory state
```

Only `commands/`, `lib.rs`, and `main.rs` depend on Tauri runtime types. Keep native domain,
argument-building, validation, and most process logic framework-independent and unit-testable.

## Frontend dependency direction

```text
main -> app composition -> feature public APIs
                     |-> app store and cross-feature orchestration

features -> app typed Redux hooks/selectors/actions
features -> components/ui, domain, lib, and local internals
```

- Application composition consumes feature public APIs.
- Features may consume application Redux contracts intrinsic to their capability.
- A feature may not import another feature's internals. Use the target feature's deliberate public
  API when a cross-feature dependency is justified.
- If two features need substantial access to each other's internals, resolve the ownership problem
  rather than bypassing public APIs or creating a cycle.
- Shared UI primitives, pure domain logic, and technical adapters do not import product features.

## Frontend naming and exports

### Directories

Use `kebab-case` for all frontend directories, including directories that contain React
components: `context-menus/`, `status-bar/`, `audio/`, and `editor-workspace/`.

The reserved test directory name `__tests__/` is an explicit exception. Use it only for test suites
owned by the containing module folder.

### React components

Application-owned React component files use `PascalCase.tsx`, and the primary component export
normally matches the filename:

```tsx
export function VideoPreview() {}
```

The explicit exception is `src/components/ui/`: shadcn/Radix primitive files remain
`kebab-case.tsx`, such as `button.tsx`, `scroll-area.tsx`, and `cursor-tooltip.tsx`. This is a
tooling/ecosystem convention, not a second general component convention.

### Hooks and other TypeScript modules

Hook files use the hook symbol name directly and use `.ts` unless JSX is required:

```text
useAppUpdates.ts
usePlaybackModes.ts
useTimelineInteractions.ts
```

The primary hook export matches the filename. First-class TypeScript modules use semantic
kebab-case names such as `source-actions.ts`, `source-media-runtime.ts`, and
`panel-layout-listener.ts`.

Dedicated extracted primitive modules use a dotted role suffix. Use a semantic kebab-case base for
module-level primitives and a PascalCase base matching the owner for component-specific
primitives:

```text
context-menu.types.ts
source-import.types.ts
AudioTracks.types.ts
TrimTimeline.types.ts
brand-icons.consts.ts
StatusBar.consts.ts
timeline-format.utils.ts
StatusBar.utils.ts
source.fixtures.ts
```

Use `.types.ts` for type-only contracts, `.consts.ts` for grouped static values, and `.utils.ts` for
small cohesive helper functions or supporting calculations. Apply the same `<owner>.<role>.ts`
shape to other dedicated primitive roles such as `.fixtures.ts`, `.mocks.ts`, or `.schemas.ts`
when they exist. The suffix must describe the complete module; do not label state, runtime,
adapters, domain models, or configuration as utilities merely because they export functions.

Never use ownerless catch-all names such as `utils.ts`, `helpers.ts`, `common.ts`, or `misc.ts`.
Do not extract types, constants, or helpers from an otherwise cohesive implementation solely to
create a suffixed file. Ambient declarations required by TypeScript or tooling retain `.d.ts`, such
as `vite-env.d.ts` and `i18next.d.ts`.

### Tests

Test files live under an owning module folder's `__tests__/` directory and mirror the complete
source filename stem:

```text
components/
|-- __tests__/
|   `-- VideoPreview.test.tsx
`-- VideoPreview.tsx

hooks/
|-- __tests__/
|   `-- usePlaybackModes.test.ts
`-- usePlaybackModes.ts

slices/
|-- __tests__/
|   `-- source-slice.test.ts
`-- source-slice.ts
```

Do not change application component, hook, or module casing in test filenames: the test filename
matches its source owner plus `.test`. Keep `src/test/` for global setup, shared factories,
reusable mocks, and fixtures rather than test suites. Tests covering a broader application boundary
remain in an explicitly named owner such as `app/store/integration/__tests__/`.

### Module exports

Named exports are the application default:

```ts
export function Timeline() {}
export const selectCurrentSource = ...;
export type TimelineState = ...;
```

Use default exports only where an external framework or tooling contract requires or strongly
justifies one, such as Vite or ESLint configuration. Do not rewrite legitimate integration-point
defaults solely for stylistic uniformity.

## General growth rules

- Keep generated files, media fixtures, packaged binaries, and user output out of source
  directories.
- Put reusable automation in `scripts/`; do not hide build logic in ad hoc shell snippets.
- Reserve root/native `tests/` for cross-module or real-process integration.
- When moving a boundary, update imports, tests, rules, skills, and architecture documentation in
  the same logical migration.
