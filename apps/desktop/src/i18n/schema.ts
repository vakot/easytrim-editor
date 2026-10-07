import type { en } from "./locales/en";

type TranslationShape<Translation> = {
  [Key in keyof Translation]: Translation[Key] extends string
    ? string
    : TranslationShape<Translation[Key]>;
};

export type TranslationSchema = TranslationShape<typeof en>;

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
