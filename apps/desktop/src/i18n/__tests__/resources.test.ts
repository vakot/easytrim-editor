import { describe, expect, it } from "vitest";

import i18n from "../config";
import { resolveInitialLanguage } from "../resources";

describe("resolveInitialLanguage", () => {
  it("uses the first supported system language", () => {
    expect(resolveInitialLanguage(["de-DE", "sk-SK", "en-US"])).toBe("sk");
  });

  it("normalizes regional and underscore-separated locales", () => {
    expect(resolveInitialLanguage(["SK_sk"])).toBe("sk");
    expect(resolveInitialLanguage(["en-GB"])).toBe("en");
  });

  it("falls back to English when no preferred locale is supported", () => {
    expect(resolveInitialLanguage(["de-DE", "fr-FR"])).toBe("en");
    expect(resolveInitialLanguage([])).toBe("en");
  });

  it("interpolates selected-track counts in merged audio summaries", () => {
    expect(i18n.getFixedT("en")("audio.output.merged", { count: 3 })).toBe(
      "3 selected tracks are merged into one track; selected audio is encoded.",
    );
    expect(i18n.getFixedT("sk")("audio.output.merged", { count: 3 })).toBe(
      "3 vybrané stopy sa zlúčia do jednej stopy; vybraný zvuk sa zakóduje.",
    );
  });
});
