import type { en } from "./locales/en";

type TranslationShape<Translation> = {
  [Key in keyof Translation]: Translation[Key] extends string
    ? string
    : TranslationShape<Translation[Key]>;
};

export type TranslationSchema = TranslationShape<typeof en>;

export type PartialTranslationSchema<Translation = TranslationSchema> = {
  [Key in keyof Translation]?: Translation[Key] extends string
    ? string
    : PartialTranslationSchema<Translation[Key]>;
};
