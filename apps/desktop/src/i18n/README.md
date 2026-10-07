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

A translation unit is one ordinary message or one complete plural family. Provide every cardinal
form required by your language, with the same interpolation parameters, or leave the whole family
untranslated for English fallback. Do not copy English suffixes blindly:
`queue.summary.jobs` needs `_one` and `_other` in English, but also `_few` and `_many` in Russian
and Slovak. If English defines an explicit `_zero` form, translate that form too. Remove all forms
of an incomplete family until the missing translations have been reviewed.

Coverage is the percentage of canonical English translation units present in a locale. A plural
family counts once and is present only when all required forms are available. Coverage measures
presence and completeness, not translation quality or human review status. It has no minimum
threshold and does not affect validation success.

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

Use the local coverage summary and optional missing-unit details with:

```sh
pnpm i18n:check
pnpm i18n:check --verbose
pnpm i18n:check --verbose ru
```

Verbose locale filtering changes only the missing-unit details; the summary always includes every
supported locale. Build preparation generates the compact frontend coverage metadata from the
validated resources.

## Terminology for contributors

Use these terms consistently in labels, help text, and search terms. Keep product names and units
such as EasyTrim, FFmpeg, FFprobe, GitHub, Ko-fi, LUFS, dB, dBTP, FPS, codec names, and container
formats unchanged. Prefer English fallback when a technical translation is uncertain.

| Concept                       | English         | Russian            | Slovak                 |
| ----------------------------- | --------------- | ------------------ | ---------------------- |
| Imported media                | Source          | Источник           | Zdroj                  |
| Saved output action           | Export          | Экспорт            | Export                 |
| Encoded output process        | Render          | Рендеринг          | Renderovanie           |
| Cut without re-encoding       | Lossless Cut    | Обрезка без потерь | Strih bez prekódovania |
| Pending exports               | Export Queue    | Очередь экспорта   | Front exportov         |
| Reusable export configuration | Preset          | Пресет             | Predvoľba              |
| Audio stream row              | Track           | Дорожка            | Stopa                  |
| Time ruler                    | Timeline        | Временная шкала    | Časová os              |
| Selected time range           | Segment         | Сегмент            | Segment                |
| Playback view                 | Preview         | Предпросмотр       | Náhľad                 |
| Video framing                 | Crop            | Обрезка кадра      | Orezanie obrazu        |
| Audio level adjustment        | Gain            | Усиление           | Zosilnenie             |
| Perceived audio level         | Loudness        | Громкость          | Hlasitosť              |
| Peak protection               | Limiter         | Лимитер            | Obmedzovač špičiek     |
| Background audio cleanup      | Noise Reduction | Шумоподавление     | Redukcia šumu          |
| Completed actions list        | Activity Feed   | Лента активности   | Prehľad aktivít        |
| Panel arrangement             | Layout          | Макет              | Rozloženie             |
| Editing area                  | Workspace       | Рабочая область    | Pracovný priestor      |
