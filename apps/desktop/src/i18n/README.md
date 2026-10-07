# Interface localization

EasyTrim keeps one translation object per language in `locales/en.ts`, `locales/ru.ts`, and
`locales/sk.ts`. These are the only supported locale files. The stored language preference takes
priority over the system language, and English is the final fallback.

## Key ownership

`en.ts` defines the canonical key structure and English wording. Organize a key by capability,
then product concept, then the exact message. For example, the queue's source deletion label,
tooltip, and confirmation belong together under `queue.deleteSource`. The appearance setting's
label and explanation belong under `settings.appearance.primaryColor`. A domain may use `actions`
or `status` where those names represent a coherent concept; there is no required category list or
category order.

Keep `app` for application shell concepts. Commands, layout, media tools, and updates have their
own top-level domains. Do not create a domain for a single React component or screen position.
Use `common` only for universal language primitives, such as `common.actions.cancel`,
`common.actions.resetToDefault`, and `common.status.loading`. Queue export retry keeps its own
`queue.actions.retryExport` key because its context and Slovak wording differ from the general
retry action. Identical English text does not imply shared meaning: a queue's
`queue.progress.tooltip` and `queue.progress.accessibleLabel` currently have the same English
value but can differ by language and presentation context.

Keys are semantic contracts. If English wording changes without changing meaning, keep the key.
If the meaning or context changes enough that an existing translation might be wrong, use a new
semantic key and let untranslated locales fall back to English until reviewed. Do not retain a
stale translation under the new meaning.

Translate complete messages. Keep plural forms and interpolation on the complete sentence, as in
`source.delete.confirmation.description` with `{{name}}`. Do not assemble sentences from translated
fragments. Add a short `// Translators:` comment when a path and English text still leave an
important concept ambiguous; avoid comments that only repeat the message.

## Editing and validation

Agents adding or changing product copy must edit English only. Do not add, rewrite, or invent
Russian or Slovak wording unless the task explicitly requests work on that translation. Partial
translations are intentional: i18next falls back to the English canonical value for missing keys.
The existing Russian and Slovak values may be moved with their semantic keys during a structural
migration without rewriting their wording.

Use literal keys in translation calls, such as `t("queue.deleteSource.label")`. Do not construct
keys dynamically or supply inline `defaultValue` fallbacks. The English type supplies key safety;
partial locale types allow missing entries but reject unknown ones. `pnpm i18n:check` rejects
invalid or unused English keys, duplicate keys, empty objects and values, invalid plural families,
unknown partial-locale keys, mismatched interpolation parameters, missing call-site parameters,
dynamic calls, and inline fallbacks. It never writes translations. `pnpm lint` also runs this check.
