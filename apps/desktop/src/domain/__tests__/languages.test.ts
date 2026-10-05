import { describe, expect, it } from "vitest";

import { filterLanguages, getLanguageDisplayName, LANGUAGE_CATALOG } from "../languages";

describe("filterLanguages", () => {
  it("matches English and native names without case or extra whitespace sensitivity", () => {
    expect(filterLanguages(LANGUAGE_CATALOG, "  RUSSIAN ")).toContainEqual(
      expect.objectContaining({ code: "ru" }),
    );
    expect(filterLanguages(LANGUAGE_CATALOG, "русский")).toContainEqual(
      expect.objectContaining({ code: "ru" }),
    );
    expect(filterLanguages(LANGUAGE_CATALOG, "  UKRAINIAN  ")).toContainEqual(
      expect.objectContaining({ code: "uk" }),
    );
    expect(filterLanguages(LANGUAGE_CATALOG, "日本語")).toContainEqual(
      expect.objectContaining({ code: "ja" }),
    );
  });

  it("returns a copy of the supplied list for an empty search", () => {
    const languages = LANGUAGE_CATALOG.slice(0, 2);
    const results = filterLanguages(languages, "   ");

    expect(results).toEqual(languages);
    expect(results).not.toBe(languages);
  });

  it("normalizes whitespace inside names and queries", () => {
    const languages = [{ code: "x-test", englishName: "Middle   English", nativeName: "ME" }];

    expect(filterLanguages(languages, "middle english")).toEqual(languages);
  });

  it("matches language codes and searches native names without diacritics", () => {
    expect(filterLanguages(LANGUAGE_CATALOG, "ru")).toContainEqual(
      expect.objectContaining({ code: "ru" }),
    );
    expect(filterLanguages(LANGUAGE_CATALOG, "espanol")).toContainEqual(
      expect.objectContaining({ code: "es" }),
    );
  });
});

describe("language display names", () => {
  it("avoids repeating an English name when it matches the native name", () => {
    expect(getLanguageDisplayName(LANGUAGE_CATALOG.find(({ code }) => code === "en")!)).toBe(
      "English",
    );
  });

  it("includes the English name when a language has a distinct native name", () => {
    expect(getLanguageDisplayName(LANGUAGE_CATALOG.find(({ code }) => code === "ru")!)).toBe(
      "Русский (Russian)",
    );
  });
});
