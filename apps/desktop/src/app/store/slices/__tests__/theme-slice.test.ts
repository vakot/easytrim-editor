import { describe, expect, it } from "vitest";

import type { RootState } from "@/app/store/store";
import {
  customPrimaryColorChanged,
  primaryColorChanged,
  selectCustomPrimaryColor,
  selectPrimaryColor,
  selectPrimaryColorKey,
  selectThemePreference,
  themePreferenceChanged,
  themeReducer,
} from "@/app/store/slices/theme-slice";

describe("theme Redux domain", () => {
  it("starts from deterministic product defaults", () => {
    expect(themeReducer(undefined, { type: "theme/initialize" })).toEqual({
      preference: "system",
      primaryColor: "amber",
      customPrimaryColor: "#efbf04",
    });
  });

  it("changes the theme preference independently", () => {
    const nextState = themeReducer(undefined, themePreferenceChanged("dark"));

    expect(nextState.preference).toBe("dark");
    expect(nextState.primaryColor).toBe("amber");
  });

  it("changes preset and custom colors while retaining the custom value", () => {
    const presetState = themeReducer(undefined, primaryColorChanged("blue"));
    const customState = themeReducer(presetState, customPrimaryColorChanged("#123456"));
    const nextPresetState = themeReducer(customState, primaryColorChanged("rose"));

    expect(presetState).toMatchObject({ primaryColor: "blue", customPrimaryColor: "#efbf04" });
    expect(customState).toMatchObject({ primaryColor: "#123456", customPrimaryColor: "#123456" });
    expect(nextPresetState).toMatchObject({ primaryColor: "rose", customPrimaryColor: "#123456" });
  });

  it("selects the canonical color values and derives the custom key", () => {
    const state = {
      theme: themeReducer(undefined, customPrimaryColorChanged("#abcdef")),
    } as RootState;

    expect(selectThemePreference(state)).toBe("system");
    expect(selectPrimaryColor(state)).toBe("#abcdef");
    expect(selectPrimaryColorKey(state)).toBe("custom");
    expect(selectCustomPrimaryColor(state)).toBe("#abcdef");
  });
});
