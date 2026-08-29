import type { en } from "./locales/en";

export type TranslationShape<Translation> = {
  [Key in keyof Translation]: Translation[Key] extends string
    ? string
    : TranslationShape<Translation[Key]>;
};

export type TranslationSchema = TranslationShape<typeof en>;
