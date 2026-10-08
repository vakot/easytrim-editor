# Help translate EasyTrim

## Contributing translations

English is the canonical source and fallback. Locale files live in `locales/`; the supported
languages are English and Russian.

Find missing translation units with:

```sh
pnpm i18n:check
pnpm i18n:check --verbose
pnpm i18n:check --verbose ru
```

Edit the target locale file, then run the validator again. Run the normal project checks before
submitting a pull request.

**Prefer human translations.** Machine translation may be useful as a reference, but submitted
translations should be reviewed by someone who understands the target language and the UI context.
Do not bulk-fill missing strings with machine-generated text just to increase coverage. Leaving an
English fallback is better than submitting wording that cannot be confidently reviewed.

Coverage measures presence and completeness of translation units. It does not measure translation
quality or human review status.

## Translation guidelines

- Translate meaning and UI context, not words mechanically. Inspect the call site when context is
  unclear.
- Prefer natural wording for the target language.
- Preserve every interpolation parameter, such as `{{name}}` and `{{count}}`.
- Translate complete plural families, including every form required by the target language.
- Use established EasyTrim terminology from the table below.
- Identical English text can belong to different semantic keys; translate each key in its context.

## Terminology

| Concept       | English         | Russian          |
| ------------- | --------------- | ---------------- |
| Source        | Source          | Источник         |
| Source panel  | Source explorer | Источники        |
| Layout        | Layout          | Компоновка       |
| Export        | Export          | Экспорт          |
| Render        | Render          | Рендер           |
| Fast Export   | Fast Export     | Быстрый экспорт  |
| Export Queue  | Export Queue    | Очередь экспорта |
| Preset        | Preset          | Пресет           |
| Track         | Track           | Дорожка          |
| Timeline      | Timeline        | Временная шкала  |
| Segment       | Segment         | Сегмент          |
| Preview       | Preview         | Предпросмотр     |
| Gain          | Gain            | Усиление         |
| Loudness      | Loudness        | Громкость        |
| Activity Feed | Activity Feed   | Лента активности |
| Workspace     | Workspace       | Рабочая область  |

Keep product and technical names unchanged where appropriate, including EasyTrim, FFmpeg,
FFprobe, GitHub, Ko-fi, LUFS, dB, dBTP, FPS, codec names, and container names.

## For developers

- `locales/en.ts` defines canonical keys. Other locale files may be partial and use English fallback.
- Keep each key with its semantic owner. Use `common` only for genuinely universal concepts.
- Use literal keys in translation calls, such as `t("queue.deleteSource.label")`.
- The validator checks key structure and usage, interpolation parameters, plural families, and
  missing translation units. Coverage does not affect validation success.
