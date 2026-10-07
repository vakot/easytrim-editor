import Fuse from "fuse.js";

import { FUZZY_SEARCH_OPTIONS } from "@/lib/fuzzy-search.consts";

export type Language = {
  /** ISO 639-1 alpha-2 identifier. */
  code: string;
  englishName: string;
  nativeName: string;
};

const LANGUAGE_REGIONS: Readonly<Record<string, string>> = {
  de: "DE",
  en: "GB",
  es: "ES",
  fr: "FR",
  ja: "JP",
  ko: "KR",
  pt: "PT",
  ru: "RU",
  sk: "SK",
  uk: "UA",
  zh: "CN",
};

const LANGUAGE_CODES = [
  "aa",
  "ab",
  "ae",
  "af",
  "ak",
  "am",
  "an",
  "ar",
  "as",
  "av",
  "ay",
  "az",
  "ba",
  "be",
  "bg",
  "bh",
  "bi",
  "bm",
  "bn",
  "bo",
  "br",
  "bs",
  "ca",
  "ce",
  "ch",
  "co",
  "cr",
  "cs",
  "cu",
  "cv",
  "cy",
  "da",
  "de",
  "dv",
  "dz",
  "ee",
  "el",
  "en",
  "eo",
  "es",
  "et",
  "eu",
  "fa",
  "ff",
  "fi",
  "fj",
  "fo",
  "fr",
  "fy",
  "ga",
  "gd",
  "gl",
  "gn",
  "gu",
  "gv",
  "ha",
  "he",
  "hi",
  "ho",
  "hr",
  "ht",
  "hu",
  "hy",
  "hz",
  "ia",
  "id",
  "ie",
  "ig",
  "ii",
  "ik",
  "io",
  "is",
  "it",
  "iu",
  "ja",
  "jv",
  "ka",
  "kg",
  "ki",
  "kj",
  "kk",
  "kl",
  "km",
  "kn",
  "ko",
  "kr",
  "ks",
  "ku",
  "kv",
  "kw",
  "ky",
  "la",
  "lb",
  "lg",
  "li",
  "ln",
  "lo",
  "lt",
  "lu",
  "lv",
  "mg",
  "mh",
  "mi",
  "mk",
  "ml",
  "mn",
  "mr",
  "ms",
  "mt",
  "my",
  "na",
  "nb",
  "nd",
  "ne",
  "ng",
  "nl",
  "nn",
  "no",
  "nr",
  "nv",
  "ny",
  "oc",
  "oj",
  "om",
  "or",
  "os",
  "pa",
  "pi",
  "pl",
  "ps",
  "pt",
  "qu",
  "rm",
  "rn",
  "ro",
  "ru",
  "rw",
  "sa",
  "sc",
  "sd",
  "se",
  "sg",
  "si",
  "sk",
  "sl",
  "sm",
  "sn",
  "so",
  "sq",
  "sr",
  "ss",
  "st",
  "su",
  "sv",
  "sw",
  "ta",
  "te",
  "tg",
  "th",
  "ti",
  "tk",
  "tl",
  "tn",
  "to",
  "tr",
  "ts",
  "tt",
  "tw",
  "ty",
  "ug",
  "uk",
  "ur",
  "uz",
  "ve",
  "vi",
  "vo",
  "wa",
  "wo",
  "xh",
  "yi",
  "yo",
  "za",
  "zh",
  "zu",
] as const;

const ENGLISH_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

export const LANGUAGE_CATALOG: readonly Language[] = LANGUAGE_CODES.map((code) => {
  const englishName = ENGLISH_NAMES.of(code) ?? code;
  const localizedName = new Intl.DisplayNames([code], { type: "language" }).of(code) ?? englishName;
  const [firstCharacter, ...remainingCharacters] = Array.from(localizedName);
  const nativeName = `${firstCharacter?.toLocaleUpperCase(code) ?? ""}${remainingCharacters.join("")}`;

  return { code, englishName, nativeName };
});

export function getLanguageRegion(language: Language): string | undefined {
  return LANGUAGE_REGIONS[language.code];
}

export function filterLanguages<T extends Language>(languages: readonly T[], query: string): T[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [...languages];

  return createLanguageSearcher(languages)(normalizedQuery);
}

export function createLanguageSearcher<T extends Language>(languages: readonly T[]) {
  const searchEntries = languages.map((language) => ({
    language,
    code: language.code,
    englishName: language.englishName,
    nativeName: language.nativeName,
    searchTerms: language.code === "pt" ? "pt br pt-br brazilian portuguese" : "",
  }));

  const fuse = new Fuse(searchEntries, {
    ...FUZZY_SEARCH_OPTIONS,
    ignoreDiacritics: true,
    keys: ["code", "englishName", "nativeName", "searchTerms"],
  });

  return (query: string): T[] => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [...languages];

    return fuse.search(normalizedQuery).map(({ item }) => item.language);
  };
}

export function getLanguageDisplayName(language: Language): string {
  return language.nativeName.toLowerCase() === language.englishName.toLowerCase()
    ? language.nativeName
    : `${language.nativeName} (${language.englishName})`;
}
