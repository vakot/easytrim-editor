import type { en } from "./locales/en";

type TranslationShape<Translation> = {
  [Key in keyof Translation]: Translation[Key] extends string
    ? string
    : TranslationShape<Translation[Key]>;
};

// Native error IDs are checked by the i18n validator; keep their large catalog
// out of i18next's recursive key types to avoid exceeding TypeScript's depth limit.
type ErrorFeature = "app" | "audio" | "export" | "preview" | "queue" | "source" | "timeline";

export type TranslationSchema = TranslationShape<Omit<typeof en, ErrorFeature>> & {
  [Feature in ErrorFeature]: TranslationShape<Omit<(typeof en)[Feature], "errors">> & {
    errors: Record<string, unknown>;
  };
};

type PluralSuffix = "zero" | "one" | "two" | "few" | "many" | "other";
type PluralBase<Key extends string> = Key extends `${infer Base}_${PluralSuffix}` ? Base : never;

export type PartialTranslationSchema<Translation = TranslationSchema> = {
  [Key in keyof Translation]?: Translation[Key] extends string
    ? string
    : PartialTranslationSchema<Translation[Key]>;
} & {
  // Locale-specific forms are type-safe only for plural families declared by English.
  [Key in `${PluralBase<Extract<keyof Translation, string>>}_${PluralSuffix}`]?: string;
};
