import { describe, expect, it } from "vitest";

import {
  applyPrimaryColor,
  applyTheme,
  DEFAULT_PRIMARY_COLOR,
  PRIMARY_COLOR_PRESETS,
  primaryColorPalette,
  resolveTheme,
} from "../theme.utils";

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

describe("applyTheme", () => {
  it("marks a system dark theme dark without pinning light", () => {
    const root = document.createElement("html");
    applyTheme(root, "system", "dark");

    expect(root).toHaveClass("dark");
    expect(root).not.toHaveClass("light");
    expect(root.dataset.theme).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
  });

  it("pins light only for an explicit light choice", () => {
    const root = document.createElement("html");
    applyTheme(root, "system", "light");
    expect(root).not.toHaveClass("light", "dark");

    applyTheme(root, "light", "light");
    expect(root).toHaveClass("light");
    expect(root).not.toHaveClass("dark");
    expect(root.style.colorScheme).toBe("light");
  });
});

describe("applyPrimaryColor", () => {
  it("sets the light and dark primary tokens from the palette", () => {
    const root = document.createElement("html");
    const palette = primaryColorPalette(DEFAULT_PRIMARY_COLOR);
    applyPrimaryColor(root, DEFAULT_PRIMARY_COLOR);

    expect(root.style.getPropertyValue("--primary-light")).toBe(palette.light);
    expect(root.style.getPropertyValue("--primary-foreground-light")).toBe(palette.lightForeground);
    expect(root.style.getPropertyValue("--primary-dark")).toBe(palette.dark);
    expect(root.style.getPropertyValue("--primary-foreground-dark")).toBe(palette.darkForeground);
  });
});
