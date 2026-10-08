import { describe, expect, it } from "vitest";

import {
  createLanguageSearcher,
  getLanguageDisplayName,
  languageCodeFromMetadata,
  metadataCodeFromLanguage,
  normalizeMetadataLanguageCode,
  SUPPORTED_LANGUAGES,
} from "../languages";

const searchLanguages = createLanguageSearcher(SUPPORTED_LANGUAGES);

describe("supported languages", () => {
  it("contains only the languages currently supported by the application", () => {
    expect(SUPPORTED_LANGUAGES.map(({ code }) => code)).toEqual(["en", "ru"]);
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
  ])("tolerates the typo or partial query %s", (query, expectedCode) => {
    expect(searchLanguages(query)[0]?.code).toBe(expectedCode);
  });

  it("matches the native and English Russian names", () => {
    expect(searchLanguages("Русский")[0]?.code).toBe("ru");
    expect(searchLanguages("Russian")[0]?.code).toBe("ru");
  });

  it("matches ISO language codes", () => {
    expect(searchLanguages("ru")[0]?.code).toBe("ru");
    expect(searchLanguages("en")[0]?.code).toBe("en");
  });
});

describe("language display names", () => {
  it("avoids repeating an English name when it matches the native name", () => {
    expect(getLanguageDisplayName(SUPPORTED_LANGUAGES[0])).toBe("English");
  });

  it("includes the English name when a language has a distinct native name", () => {
    expect(getLanguageDisplayName(SUPPORTED_LANGUAGES[1])).toBe("Русский (Russian)");
  });

  it("maps FFmpeg ISO language codes to selector values and back", () => {
    expect(languageCodeFromMetadata("eng")).toBe("en");
    expect(languageCodeFromMetadata("ru")).toBe("ru");
    expect(languageCodeFromMetadata("unsupported")).toBeUndefined();
    expect(metadataCodeFromLanguage("en")).toBe("eng");
    expect(metadataCodeFromLanguage("ru")).toBe("rus");
    expect(normalizeMetadataLanguageCode("ru")).toBe("rus");
    expect(normalizeMetadataLanguageCode("eng")).toBe("eng");
    expect(normalizeMetadataLanguageCode("")).toBeUndefined();
  });
});
