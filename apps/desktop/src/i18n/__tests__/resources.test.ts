import { describe, expect, it } from "vitest";

import { i18n } from "../config";
import { resolveInitialLanguage, resolveLanguagePreference } from "../resources";

describe("resolveInitialLanguage", () => {
  it("uses the first supported system language", () => {
    expect(resolveInitialLanguage(["de-DE", "ru-RU", "sk-SK", "en-US"])).toBe("ru");
  });

  it("normalizes regional and underscore-separated locales", () => {
    expect(resolveInitialLanguage(["SK_sk"])).toBe("sk");
    expect(resolveInitialLanguage(["ru-RU"])).toBe("ru");
    expect(resolveInitialLanguage(["en-GB"])).toBe("en");
  });

  it("falls back to English when no preferred locale is supported", () => {
    expect(resolveInitialLanguage(["de-DE", "fr-FR"])).toBe("en");
    expect(resolveInitialLanguage([])).toBe("en");
  });

  it("falls back for incomplete plural translations while retaining translated messages", () => {
    expect(i18n.getFixedT("en")("audio.output.merged", { count: 3 })).toBe(
      "3 selected tracks are merged into one track",
    );
    expect(i18n.getFixedT("sk")("audio.output.merged", { count: 3 })).toBe(
      "3 selected tracks are merged into one track",
    );
    expect(i18n.getFixedT("ru")("audio.output.merged", { count: 3 })).toBe(
      "3 selected tracks are merged into one track",
    );
    for (const language of ["ru", "sk"] as const) {
      expect(i18n.getFixedT(language)("audio.output.merged", { count: 1 })).toBe(
        "1 selected track is merged into one track",
      );
      expect(i18n.getFixedT(language)("audio.output.merged", { count: 5 })).toBe(
        "5 selected tracks are merged into one track",
      );
    }
    expect(i18n.getFixedT("en")("audio.output.merge.tooltip")).toBe(
      "All selected tracks are merged into one track; this requires encoding.",
    );
    expect(i18n.getFixedT("sk")("audio.output.merge.tooltip")).toBe(
      "Všetky vybrané stopy sa zlúčia do jednej stopy; vyžaduje si to kódovanie.",
    );
    expect(i18n.getFixedT("ru")("audio.output.merge.tooltip")).toBe(
      "Все выбранные дорожки объединяются в одну; это требует кодирования.",
    );
  });

  it("uses locale-specific forms for a complete plural family", () => {
    expect(i18n.getFixedT("ru")("source.search.results", { count: 3 })).toBe("3 результата");
    expect(i18n.getFixedT("ru")("source.search.results", { count: 5 })).toBe("5 результатов");
    expect(i18n.getFixedT("sk")("source.search.results", { count: 3 })).toBe("3 výsledky");
    expect(i18n.getFixedT("sk")("source.search.results", { count: 5 })).toBe("5 výsledkov");
  });

  it("localizes accessible stereo-meter labels", () => {
    expect(i18n.getFixedT("en")("timeline.audioMeter.accessibility.audioLevel")).toBe(
      "Stereo audio level",
    );
    expect(i18n.getFixedT("ru")("timeline.audioMeter.accessibility.leftAudioChannelLevel")).toBe(
      "Уровень звука левого канала",
    );
    expect(i18n.getFixedT("sk")("timeline.audioMeter.accessibility.rightAudioChannelLevel")).toBe(
      "Úroveň zvuku pravého kanála",
    );
  });
});

describe("resolveLanguagePreference", () => {
  it("uses a valid stored preference before system languages", () => {
    expect(resolveLanguagePreference("sk-SK", ["en-US"])).toBe("sk");
    expect(resolveLanguagePreference("ru-RU", ["en-US"])).toBe("ru");
  });

  it("falls through an invalid stored preference to system languages", () => {
    expect(resolveLanguagePreference("de-DE", ["sk-SK", "en-US"])).toBe("sk");
  });
});

describe("partial locale fallback", () => {
  it("uses canonical English for a semantic key awaiting translation review", () => {
    expect(i18n.getFixedT("ru")("source.delete.action")).toBe("Delete");
    expect(i18n.getFixedT("sk")("export.preset.actions.edit")).toBe("Edit");
  });
});
