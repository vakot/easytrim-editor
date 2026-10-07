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
  return language.nativeName;
}
