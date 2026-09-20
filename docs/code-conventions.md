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

Tests live in an owning module's `__tests__/` directory and mirror the complete source filename
stem. Keep shared setup, factories, mocks, and fixtures in `src/test/`. Stories live in a nested
`__stories__` directory owned by the component's immediate parent, use lowercase module-stem names,
and use typed CSF. New reusable components should add or update their matching story.

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
