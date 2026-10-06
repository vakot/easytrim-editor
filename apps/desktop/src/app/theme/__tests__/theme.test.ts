import { describe, expect, it } from "vitest";

import { primaryColorPalette, resolveTheme } from "../theme";

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
});
