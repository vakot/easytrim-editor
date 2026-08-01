import { describe, expect, it } from "vitest";

import { resolveTheme } from "../theme";

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
