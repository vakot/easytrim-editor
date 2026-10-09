import { describe, expect, it } from "vitest";

import {
  AUDIO_METADATA_LANGUAGES,
  languageCodeFromMetadata,
  metadataCodeFromLanguage,
  normalizeMetadataLanguageCode,
  SUPPORTED_LANGUAGES,
} from "../languages";

describe("supported languages", () => {
  it("contains only the languages currently supported by the application", () => {
    expect(SUPPORTED_LANGUAGES.map(({ code }) => code)).toEqual(["en", "ru"]);
  });
  it("provides metadata languages beyond the application UI language list", () => {
    expect(AUDIO_METADATA_LANGUAGES.length).toBeGreaterThan(SUPPORTED_LANGUAGES.length);
    expect(AUDIO_METADATA_LANGUAGES.find(({ code }) => code === "fr")).toMatchObject({
      englishName: "French",
      metadataCode: "fra",
      nativeName: "Français",
    });
  });

  it("maps FFmpeg ISO language codes to selector values and back", () => {
    expect(languageCodeFromMetadata("eng")).toBe("en");
    expect(languageCodeFromMetadata("ru")).toBe("ru");
    expect(languageCodeFromMetadata("fra")).toBe("fr");
    expect(languageCodeFromMetadata("unsupported")).toBeUndefined();
    expect(metadataCodeFromLanguage("en")).toBe("eng");
    expect(metadataCodeFromLanguage("ru")).toBe("rus");
    expect(metadataCodeFromLanguage("fr")).toBe("fra");
    expect(normalizeMetadataLanguageCode("ru")).toBe("rus");
    expect(normalizeMetadataLanguageCode("eng")).toBe("eng");
    expect(normalizeMetadataLanguageCode("")).toBeUndefined();
  });
});
