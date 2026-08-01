import { describe, expect, it } from "vitest";

import { resolveInitialLanguage } from "./resources";

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
});
