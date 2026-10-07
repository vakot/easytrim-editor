import { describe, expect, it } from "vitest";

import { createLanguageSearcher, getLanguageDisplayName, SUPPORTED_LANGUAGES } from "../languages";

const searchLanguages = createLanguageSearcher(SUPPORTED_LANGUAGES);

describe("supported languages", () => {
  it("contains only the languages currently supported by the application", () => {
    expect(SUPPORTED_LANGUAGES.map(({ code }) => code)).toEqual(["en", "ru", "sk"]);
  });
});

describe("createLanguageSearcher", () => {
  it("preserves supported language order for an empty query", () => {
    const results = searchLanguages("   ");

    expect(results).toEqual(SUPPORTED_LANGUAGES);
    expect(results).not.toBe(SUPPORTED_LANGUAGES);
  });

  it.each([
    ["englsh", "en"],
    ["russan", "ru"],
    ["slovak", "sk"],
  ])("tolerates the typo or partial query %s", (query, expectedCode) => {
    expect(searchLanguages(query)[0]?.code).toBe(expectedCode);
  });

  it("matches multiple partial tokens", () => {
    expect(searchLanguages("slovenc sk")[0]?.code).toBe("sk");
  });

  it("searches both native and English names", () => {
    expect(searchLanguages("русский")[0]?.code).toBe("ru");
    expect(searchLanguages("slovak")[0]?.code).toBe("sk");
  });

  it("ignores diacritics in native language names", () => {
    expect(searchLanguages("slovencina")[0]?.code).toBe("sk");
  });

  it("matches ISO language codes", () => {
    expect(searchLanguages("ru")[0]?.code).toBe("ru");
    expect(searchLanguages("sk")[0]?.code).toBe("sk");
  });
});

describe("language display names", () => {
  it("avoids repeating an English name when it matches the native name", () => {
    expect(getLanguageDisplayName(SUPPORTED_LANGUAGES[0])).toBe("English");
  });

  it("includes the English name when a language has a distinct native name", () => {
    expect(getLanguageDisplayName(SUPPORTED_LANGUAGES[1])).toBe("Русский");
  });
});
