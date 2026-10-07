import { describe, expect, it } from "vitest";

import { i18n } from "../config";
import {
  isSupportedLanguage,
  resolveInitialLanguage,
  resolveLanguagePreference,
  SUPPORTED_LANGUAGES,
} from "../resources";

describe("resolveInitialLanguage", () => {
  it("supports only English and Russian", () => {
    expect(SUPPORTED_LANGUAGES).toEqual(["en", "ru"]);
    expect(isSupportedLanguage("en")).toBe(true);
    expect(isSupportedLanguage("ru")).toBe(true);
    expect(isSupportedLanguage("sk")).toBe(false);
  });

  it("uses the first supported system language", () => {
    expect(resolveInitialLanguage(["de-DE", "ru-RU", "sk-SK", "en-US"])).toBe("ru");
  });

  it("normalizes regional and underscore-separated locales", () => {
    expect(resolveInitialLanguage(["SK_sk"])).toBe("en");
    expect(resolveInitialLanguage(["ru-RU"])).toBe("ru");
    expect(resolveInitialLanguage(["en-GB"])).toBe("en");
  });

  it("falls back to English when no preferred locale is supported", () => {
    expect(resolveInitialLanguage(["de-DE", "fr-FR"])).toBe("en");
    expect(resolveInitialLanguage([])).toBe("en");
  });

  it("uses complete Russian plural forms alongside English", () => {
    expect(i18n.getFixedT("en")("audio.output.merged", { count: 3 })).toBe(
      "3 selected tracks are merged into one track",
    );
    expect(i18n.getFixedT("ru")("audio.output.merged", { count: 3 })).toBe(
      "Объединены 3 выбранные дорожки",
    );
    expect(i18n.getFixedT("ru")("audio.output.merged", { count: 1 })).toBe(
      "Объединена 1 выбранная дорожка",
    );
    expect(i18n.getFixedT("ru")("audio.output.merged", { count: 5 })).toBe(
      "Объединено 5 выбранных дорожек",
    );
    expect(i18n.getFixedT("en")("audio.output.merge.tooltip")).toBe(
      "All selected tracks are merged into one track; this requires encoding",
    );
    expect(i18n.getFixedT("ru")("audio.output.merge.tooltip")).toBe(
      "Все выбранные дорожки объединяются в одну; это требует кодирования",
    );
  });

  it("uses locale-specific forms for a complete plural family", () => {
    expect(i18n.getFixedT("ru")("source.search.results", { count: 3 })).toBe("3 результата");
    expect(i18n.getFixedT("ru")("source.search.results", { count: 5 })).toBe("5 результатов");
  });

  it("localizes accessible stereo-meter labels", () => {
    expect(i18n.getFixedT("en")("timeline.audioMeter.accessibility.audioLevel")).toBe(
      "Stereo audio level",
    );
    expect(i18n.getFixedT("ru")("timeline.audioMeter.accessibility.leftAudioChannelLevel")).toBe(
      "Уровень звука левого канала",
    );
  });
});

describe("resolveLanguagePreference", () => {
  it("uses a valid stored preference before system languages", () => {
    expect(resolveLanguagePreference("ru-RU", ["en-US"])).toBe("ru");
  });

  it("falls through an unsupported stored preference to system languages", () => {
    expect(resolveLanguagePreference("sk-SK", ["ru-RU", "en-US"])).toBe("ru");
  });
});

describe("partial locale fallback", () => {
  it("uses canonical English for an unsupported locale", () => {
    expect(i18n.getFixedT("sk")("source.delete.action")).toBe("Delete");
  });
});
