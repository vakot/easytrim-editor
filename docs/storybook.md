# Storybook

Storybook documents the local design system used by the desktop application. Its scope is limited to reusable modules under `apps/desktop/src/components/**`; feature screens and application workflows remain outside the Storybook catalog.

## Commands

Run Storybook during development:

```sh
pnpm storybook
```

Build the static catalog:

```sh
pnpm build:storybook
```

The repository check includes the Storybook typecheck and production build. The accessibility addon evaluates stories in the Storybook accessibility panel; stories with known exceptions should document the reason in their story parameters.

## Story organization

- Put stories in a nested `__stories__` directory owned by the same immediate parent as the component, mirroring the existing `__tests__` convention.
- Never place a story beside a production component file.
- Use lowercase filenames matching the module stem, such as `button.stories.tsx` for `button.tsx`.
- Keep one story file per module or closely related component family. Do not create a file for every exported subcomponent.
- Use typed CSF with `Meta`, `StoryObj`, `satisfies`, and the component in the metadata.
- Prefer `args` for a single component state. Use a typed `render` when a story needs composition, controlled state, providers, or event wiring.

Each meaningful module should have a useful default state and representative variants where they exist. Use a consistent taxonomy such as `Default`, `Variants`, `Sizes`, `States`, `Disabled`, and `Interactive`; name stories after the behavior a reviewer should inspect.

Stories may define small display-only helpers locally, but must not add story-only APIs to production components or duplicate application-level fixtures. Keep examples neutral and focused on the public component contract. New reusable components under `src/components` should add or update their matching story as part of the same change.

Storybook files are included in formatting, linting, TypeScript, and build checks. Keep imports, Tailwind classes, accessibility attributes, and controls compatible with those checks. Components that are intentionally excluded from the catalog must be called out in the change description and reviewed against the component inventory.

## Themes and design tokens

The preview loads the application token stylesheet and provides toolbar controls for light/dark mode and the supported primary colors. Stories should use semantic tokens such as `bg-card`, `text-muted-foreground`, and `border-input` instead of introducing one-off palette values.
