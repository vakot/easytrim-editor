# Interface localization

EasyTrim Editor bundles English and Slovak translations with the desktop frontend. The initial
language follows the stored preference when valid, then the browser language, and finally English.
Language changes are persisted with the other application preferences.

## Architecture

Top-level translation namespaces follow semantic application ownership:

```text
common, app, settings, queue, source, preview, timeline, audio, export, support, units
```

Text belongs to its capability even when another component renders it. For example, the top-bar
queue menu and export-queue panel labels live under `queue`, while export settings and command
preview text live under `export`. Do not create namespaces for individual React components or
layout positions.

Every namespace uses only these optional semantic categories, in this order when present:

```text
actions, labels, status, messages, tooltips, dialogs, accessibility, options
```

Do not add empty categories. `common` is reserved for context-independent semantics such as
`common.actions.cancel`; identical English text alone is not a reason to share a key. Contextual
queue cancellation therefore remains `queue.actions.cancel` even though its English value is also
“Cancel”.

Child keys include only context not already expressed by their ancestors:

```text
good: preview.actions.play
good: queue.status.completed
bad:  preview.actions.playPreview
bad:  queue.status.queueCompleted
```

English defines the canonical keys. `TranslationShape` widens its string leaves, and every other
locale must satisfy the resulting `TranslationSchema`, so locale nesting is compile-time
identical without requiring translated values to equal English literals. i18next module
augmentation uses the same schema, making literal calls such as `t("preview.actions.play")`
type-safe.

Production translation calls must use direct string literals. Prefer explicit branches or lookup
objects containing already translated values over constructed keys. Do not add inline English
`defaultValue` fallbacks: they bypass missing-key guarantees.

Plural suffixes such as `_one`, `_few`, and `_other` are part of i18next's resolution contract and
remain adjacent. A call uses the unsuffixed base with `count`. Equivalent locale leaves must use
the same interpolation parameter names, such as `{{filename}}`, `{{count}}`, and `{{version}}`.

## Validation and adding locales

Run `pnpm i18n:check` directly or `pnpm lint`, which includes it. The read-only validator rejects:

- missing, extra, empty, unused, or suspiciously encoded locale entries;
- unsupported or misordered namespace categories;
- mismatched interpolation parameters;
- missing keys and interpolation arguments at call sites;
- dynamic translation keys and inline fallbacks.

Plural families are treated atomically when checking usage. The validator reports issues only; it
never removes translation data and is intentionally separate from `lint:fix`.

To add a locale, create its file in `locales/`, make it satisfy `TranslationSchema`, register its
language code in `SUPPORTED_LANGUAGES` and `resources`, and add its native name under
`settings.options.languages` in every locale. Update the settings menu's explicit language-label
map, then run the full validation workflow.
