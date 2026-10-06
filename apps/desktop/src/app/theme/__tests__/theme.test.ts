import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRIMARY_COLOR,
  PRIMARY_COLOR_PRESETS,
  primaryColorPalette,
  resolveTheme,
} from "../theme";

describe("resolveTheme", () => {
  it("matches the current system theme by default", () => {
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
  });

  it("keeps an explicit theme independent from the system", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("primaryColorPalette", () => {
  it("uses the selected HEX color directly", () => {
    expect(primaryColorPalette("#4299e1").color).toBe("#4299e1");
    expect(primaryColorPalette("#efbf04").color).toBe("#efbf04");
  });

  it("uses the amber preset as the default primary color", () => {
    expect(DEFAULT_PRIMARY_COLOR).toBe(PRIMARY_COLOR_PRESETS[0].color);
  });
});
