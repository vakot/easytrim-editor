# EasyTrim architecture

This page describes the durable ownership and dependency rules contributors need when changing
EasyTrim. It is intentionally about responsibilities and boundaries, not an inventory of files.

## Product layers

The repository is a pnpm workspace. `apps/desktop` owns the coupled React frontend and Tauri
native application. `apps/landing` is the static product website published to GitHub Pages; it
has no router, store, or native runtime. `packages/ui` (`@easytrim-editor/ui`) owns browser-safe
presentational primitives, visual effects, and design tokens shared by both applications; see
[Shared UI package](#shared-ui-package). Root scripts provide shared tooling and deterministic
automation. Add a workspace package only when at least two consumers need a stable shared contract.

The desktop application has two cooperating layers:

- **Frontend** composes the editor, owns capability UI, and consumes typed application state and
  native adapters.
- **Native layer** owns filesystem and process authority, media inspection/rendering, and Tauri
  command adapters.

The frontend never acquires arbitrary filesystem or process authority. The native layer never
owns presentation concerns.

The editor's cross-feature lifecycle is defined by the canonical `EditingInstance` collection;
see [Editing instance lifecycle](editing-instance-lifecycle.md) for the contract migration table,
identity rules, and source/export ownership boundaries. The value-by-value ownership ledger is in
[ownership-ledger.md](ownership-ledger.md).

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
primitives live in `@easytrim-editor/ui` or, while they still depend on desktop-only concerns,
under `components/ui`; genuinely shared pure product logic belongs in `domain`; technical adapters
belong in `lib`.

Feature-owned React components live under the feature's `components/` directory. Small components
are direct children of that directory. A cohesive large component may use a nested component
package with its own `components/`, `hooks/`, `contexts/`, `lib/`, optional container, and
`index.ts` barrel:

```text
features/<feature>/
  components/
    LargeComponent/
      components/
      hooks/
      contexts/
      lib/
      LargeComponent.tsx
      index.ts
    SmallComponent.tsx
  hooks/
  contexts/
  lib/
  index.ts
```

The feature root is reserved for the public barrel and non-component feature modules such as
feature hooks, contexts, and semantic libraries.

Application-owned cross-feature workflows—such as source replacement, preview reset, timeline
reset, audio refresh, and export invalidation—belong in application orchestration (listeners,
middleware, thunks, services, or providers), not in visual components.

## Shared UI package

`@easytrim-editor/ui` is a source-only package: consumers compile its TypeScript and CSS with their
own Vite and Tailwind build, so it has no build step or `dist` output.

- **Boundary.** It contains browser-safe presentation only: primitives such as `Badge`, `Button`,
  `Card`, `Item`, `Progress`, `ScrollArea`, `Separator`, and `Tooltip`; effects such as `Confetti`
  and `TextReveal`; brand icons; the `Timestamp` primitive with its date-time formatting; the `cn`
  class-name helper; the stateless achievement presentation (`AchievementCard`,
  `AchievementUnlockToast`, tier styles, and Galactic Glyphs) that the website showcases; and the
  semantic design tokens, including the achievement tier and secret palettes, and base styles. It never imports desktop code, Tauri, Redux, i18n, or
  native adapters; ESLint enforces this. Values that come from the application, such as the locale
  or translated fallback text, arrive as props.
- **Public surface.** Consumers import only the subpaths listed in the package `exports`, such as
  `@easytrim-editor/ui/button` or `@easytrim-editor/ui/globals.css`. Files not listed there are
  private; widen the export map deliberately instead of deep-importing.
- **Styles.** A consumer imports `@easytrim-editor/ui/globals.css` once instead of importing
  Tailwind directly. That stylesheet brings Tailwind, the shared animation and variant layers, the
  semantic token contract, the Inter font, and the base layer, and registers the package sources
  for class scanning. Consumer stylesheets add only consumer-specific tokens, such as the desktop
  sidebar and preview colors.
- **What stays in desktop.** Feature containers and Redux-connected controls stay with their owner
  even when they render shared presentation: `AchievementStandaloneItem` reads achievement records
  and i18n and renders `AchievementCard`, and the announcement queue decides when an
  `AchievementUnlockToast` appears, how long it stays, and which sound plays. Primitives that depend
  on desktop-only concerns, such as i18n strings or Tauri adapters, stay in
  `apps/desktop/src/components` until those concerns are lifted into props. A thin desktop binding
  may adapt a shared primitive to application context; for example, `RelativeTimestamp` supplies
  the active language to `Timestamp`.

To migrate another primitive, move it with `git mv` together with its tests and stories into
`packages/ui/src` (components under `components/`, helpers under `lib/` or `hooks/`), switch its
internal imports to relative paths, add one `exports` entry, and update consumers to the new
subpath. Do not leave a copy or a re-export behind in desktop. When a component mixes presentation
with application state, move the presentation and leave a desktop container that passes resolved,
localized values as props. The package runs its own Vitest suite and typecheck; its stories render
in the desktop Storybook with the application theme.

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

Use ownership to decide where a module belongs. Keep small components flat under a feature's
`components/` directory, and group a cohesive large component only when its internal components,
hooks, contexts, or semantic modules justify a nested package. Do not split code into global
`domain` or `lib` merely to make a feature smaller, and do not add packages or abstractions for
hypothetical future consumers.

Keep runtime handles, DOM/media objects, timers, callbacks, and other non-serializable resources
with their owning runtime or controller. Serializable status and descriptors may cross the state
boundary when the UI needs to observe them. See [State management](state-management.md) and
[Runtime and security](runtime-security.md) for those boundaries.
