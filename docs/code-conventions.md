# EasyTrim code conventions

These conventions describe the repository-specific patterns contributors should follow. Generic
agent quality and scope policy remains in [`.agents/rules/code-quality.md`](../.agents/rules/code-quality.md).

## Naming and placement

- Frontend directories use `kebab-case`; `__tests__` is the reserved test-directory exception.
- Application React component files use `PascalCase.tsx` and normally export the matching named
  component. `components/ui` keeps ecosystem `kebab-case.tsx` names for shadcn/Radix primitives.
- Feature-owned components live under the feature's `components/` directory. Keep small components
  as direct children; place a cohesive large component in a nested package with its internal
  `components/`, `hooks/`, `contexts/`, `lib/`, optional container, and `index.ts` barrel.
- Hook files use the hook symbol name, usually in `.ts`. Other first-class modules use semantic
  kebab-case names.
- Use `.types.ts`, `.consts.ts`, `.utils.ts`, and similar role suffixes only for independently
  reusable or intentionally shared primitives, with an owner in the basename. Avoid ownerless
  `utils.ts`, `helpers.ts`, `common.ts`, and `misc.ts` files.

Keep single-consumer helpers, types, and constants with their owning module. Component props live
in the same file as their component, immediately above the component declaration. Use a subsystem
`types.ts` only for a deliberate shared contract, never for a component's props-only type.

## React component file organization

Organize React component files for top-down readability. After imports, place constants and static
configuration first, then the main component or entry point, followed by smaller supporting
components in descending order of responsibility and complexity, and then the smallest reusable UI
primitives. Place context definitions and providers after the components that use them, followed by
hooks, helper functions, utilities, and finally exports. Keep a declaration earlier only when a
concrete language or module constraint requires it.

Use inline prop types for simple component props that are local to one component:

```tsx
function SettingsLanguageCoverage({ language }: { language: SupportedLanguage }) {
  // ...
}
```

Keep a named props type when it is shared, part of a public API, or complex enough that naming it
improves readability.

## Component state and props

Treat Redux as the main bus for shared application and feature workflow state. An app- or
feature-specific component reads the state it consumes with typed selectors and dispatches domain
actions or thunks itself. Do not pass Redux-owned values, derived display state, or action callbacks
through an intermediate component just to reach the component that uses them.

Keep app and feature component props minimal and mostly identity-based (`streamIndex`, `sourceId`,
or `instanceId`), plus `children` when composition requires it. A product-specific control should
own its state connection and behavior rather than expose a broad configuration and callback API.
Use a feature-local hook or context for ephemeral state shared by nested controls, such as an
unsubmitted dialog draft.

Reserve broad, generic controlled-value and event APIs for primitives under `components/ui`.
Primitives such as `Slider` accept generic values and events (`value`, `onValueChange`,
`onValueCommit`, `onClick`, and `onDoubleClick`) and remain unaware of Redux and product semantics.
Context-specific wrappers belong to their feature: for example, `VolumeSlider` accepts a track
identity such as `streamIndex`, selects and updates that track, and configures the generic `Slider`.

Keep reusable UI primitive props limited to indispensable behavior or data. Before adding a custom
prop, check whether a native React/DOM prop (`className`, `style`, `id`, `aria-*`, `data-*`, or a
native event handler) or normal composition (`children`) already expresses the need; if it does,
use that mechanism. Inherit and forward native element props directly instead of omitting and
redeclaring standard attributes. Do not add convenience aliases, fixed-value configuration props,
or consumer-specific formatting and accessibility prose to expose implementation details. Keep such
details internal unless consumers have a concrete need to control them.

Shared components may expose only the standard `className` prop for caller styling. Do not add
secondary class-name props such as `wrapperClassName`, `containerClassName`, `rootClassName`,
`contentClassName`, or `triggerClassName`; use composition or a meaningful subcomponent instead.
Standard React and DOM props must keep their standard meaning: compose supported handlers and
styles with internal behavior, and omit props from the public type when the component must own them.

## Imports and exports

Use named exports by default. Default exports are reserved for framework/tooling contracts that
require them. Cross-feature consumers import through the target feature's `index.ts`; do not import
feature internals. `components/ui` uses local wrappers rather than importing `radix-ui` or
`react-resizable-panels` directly from application/feature code. Preserve the documented direction
between app composition, features, domain, UI primitives, adapters, and native code.

Type-only imports use the repository's consistent type-import syntax. Let `simple-import-sort`
own import/export ordering; named members use deterministic alphabetical ordering where order has no
semantic meaning.

## Tests and stories

Tests live in an owning module's `__tests__/` directory and mirror the covered component's name:
`ComponentName.tsx` uses `ComponentName.test.tsx`. Keep shared setup, factories, mocks, and fixtures
in `src/test/`. Stories live in a nested `__stories__` directory owned by the component's immediate
parent, match the covered component's name (`ComponentName.stories.tsx` for `ComponentName.tsx`),
and use typed CSF. For non-component modules, preserve the module's filename stem. New reusable
components should add or update their matching story.

## Styling and tooling

Use semantic Tailwind tokens such as `bg-card`, `text-muted-foreground`, and `border-input`.
Tailwind class ordering belongs to Prettier's Tailwind plugin; ESLint owns the configured utility
correctness checks. Keep CSS-module selectors, runtime/DOM hook classes, and other intentional
non-Tailwind names when they express a real boundary.

The repository's `pnpm format`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and `pnpm knip`
scripts are the source of truth for formatting, linting, types, and production dead-code analysis.
Do not add test-only production exports or disable serializability/lint checks to hide a warning.

Application menus use `MenuGroup` for each contiguous item section, with `MenuSeparator` between
groups, including one-item groups and nested submenu sections.
