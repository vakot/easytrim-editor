# EasyTrim architecture

This page describes the durable ownership and dependency rules contributors need when changing
EasyTrim. It is intentionally about responsibilities and boundaries, not an inventory of files.

## Product layers

The repository is a pnpm workspace. `apps/desktop` owns the coupled React frontend and Tauri
native application. Root scripts provide shared tooling and deterministic automation. Add a
workspace package only when at least two consumers need a stable shared contract.

The desktop application has two cooperating layers:

- **Frontend** composes the editor, owns capability UI, and consumes typed application state and
  native adapters.
- **Native layer** owns filesystem and process authority, media inspection/rendering, and Tauri
  command adapters.

The frontend never acquires arbitrary filesystem or process authority. The native layer never
owns presentation concerns.

The editor's cross-feature lifecycle is defined by the canonical `EditingInstance` collection;
see [Editing instance lifecycle](editing-instance-lifecycle.md) for the contract migration table,
identity rules, and source/export ownership boundaries.

## Frontend ownership

Application code composes the editor workspace, initializes providers, owns the application store,
and coordinates workflows that span capabilities. Feature modules own capability orchestration,
feature-specific hooks, state consumption, and presentation.

The stable product capabilities are:

```text
features/source
features/preview
features/timeline
features/audio
features/export
```

Each top-level feature exposes a deliberate `index.ts` public API. Application code and other
features use that API rather than importing another feature's internals. Shared shadcn/Radix
primitives live under `components/ui`; genuinely shared pure product logic belongs in `domain`;
technical adapters belong in `lib`.

Application-owned cross-feature workflows—such as source replacement, preview reset, timeline
reset, audio refresh, and export invalidation—belong in application orchestration (listeners,
middleware, thunks, services, or providers), not in visual components.

## Native ownership

Native dependencies flow from thin Tauri commands through application use cases to framework-
independent domain, media, and process modules:

```text
commands -> application -> domain / media / process
                    `----> managed in-memory state
```

Only command and desktop entrypoint modules should depend directly on Tauri runtime types. Keep
argument validation, media builders, and process lifecycle logic framework-independent and
unit-testable where practical.

## Dependency direction

The intended frontend direction is:

```text
main -> app composition -> feature public APIs
                     |-> app store and cross-feature orchestration
features -> app typed state contracts, components/ui, domain, lib, local internals
```

Shared UI and domain modules do not import product features. A feature may depend on application
state contracts intrinsic to its capability, but feature-to-feature dependencies must go through a
public API. If two features need substantial internal access to each other, revisit ownership
instead of bypassing the boundary.

## File placement and growth

Use ownership to decide where a module belongs. Keep a feature flat until related components,
hooks, or semantic internal modules justify grouping. Do not split code into global `domain` or
`lib` merely to make a feature smaller, and do not add packages or abstractions for hypothetical
future consumers.

Keep runtime handles, DOM/media objects, timers, callbacks, and other non-serializable resources
with their owning runtime or controller. Serializable status and descriptors may cross the state
boundary when the UI needs to observe them. See [State management](state-management.md) and
[Runtime and security](runtime-security.md) for those boundaries.
