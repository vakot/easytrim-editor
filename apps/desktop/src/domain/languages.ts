import Fuse from "fuse.js";

import { FUZZY_SEARCH_OPTIONS } from "@/lib/fuzzy-search.consts";

export const SUPPORTED_LANGUAGES = [
  {
    code: "en",
    englishName: "English",
    nativeName: "English",
    region: "GB",
  },
  {
    code: "ru",
    englishName: "Russian",
    nativeName: "Русский",
    region: "RU",
  },
] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_METADATA_CODES: Record<Language["code"], string> = {
  en: "eng",
  ru: "rus",
};

export function createLanguageSearcher<T extends Language>(languages: readonly T[]) {
  const fuse = new Fuse(languages, {
    ...FUZZY_SEARCH_OPTIONS,
    ignoreDiacritics: true,
    keys: ["code", "englishName", "nativeName"],
  });

  return (query: string): T[] => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [...languages];

    return fuse.search(normalizedQuery).map(({ item }) => item);
  };
}

export function getLanguageDisplayName(language: Language): string {
  return language.nativeName === language.englishName
    ? language.nativeName
    : `${language.nativeName} (${language.englishName})`;
}

function languageCodeFromMetadata(languageCode: string | undefined): Language["code"] | undefined {
  const normalizedCode = languageCode?.toLowerCase();
  return SUPPORTED_LANGUAGES.find(
    ({ code }) => code === normalizedCode || LANGUAGE_METADATA_CODES[code] === normalizedCode,
  )?.code;
}

function metadataCodeFromLanguage(code: Language["code"]): string {
  return LANGUAGE_METADATA_CODES[code];
}

function normalizeMetadataLanguageCode(languageCode: string | undefined): string | undefined {
  if (languageCode === undefined || languageCode === "") return undefined;
  const selectorCode = languageCodeFromMetadata(languageCode);
  return selectorCode === undefined ? languageCode : metadataCodeFromLanguage(selectorCode);
}

export { languageCodeFromMetadata, metadataCodeFromLanguage, normalizeMetadataLanguageCode };
