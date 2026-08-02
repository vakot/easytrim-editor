# Interface localization

EasyTrim Editor bundles translations with the desktop frontend. It reads the initial language from
`navigator.languages`, supports language-only matching, and falls back to English. Manual changes
remain in memory and are intentionally not written to browser or OS storage.

English is the typed source schema. Add keys to `locales/en.ts` first, then mirror them in every
other locale. To add a language, provide its locale file, register it in `resources.ts`, and add its
native display name to `LanguageSelector.tsx`.
