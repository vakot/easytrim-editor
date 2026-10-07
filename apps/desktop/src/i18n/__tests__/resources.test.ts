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

  it("interpolates selected-track counts in merged audio summaries", () => {
    expect(i18n.getFixedT("en")("audio.output.messages.merged", { count: 3 })).toBe(
      "3 selected tracks are merged into one track",
    );
    expect(i18n.getFixedT("sk")("audio.output.messages.merged", { count: 3 })).toBe(
      "3 vybrané stopy sa zlúčia do jednej stopy",
    );
    expect(i18n.getFixedT("ru")("audio.output.messages.merged", { count: 3 })).toBe(
      "3 выбранные дорожки объединяются в одну дорожку",
    );
    expect(i18n.getFixedT("en")("audio.output.tooltips.merge")).toBe(
      "All selected tracks are merged into one track; this requires encoding.",
    );
    expect(i18n.getFixedT("sk")("audio.output.tooltips.merge")).toBe(
      "Všetky vybrané stopy sa zlúčia do jednej stopy; vyžaduje si to kódovanie.",
    );
    expect(i18n.getFixedT("ru")("audio.output.tooltips.merge")).toBe(
      "Все выбранные дорожки объединяются в одну; это требует кодирования.",
    );
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
