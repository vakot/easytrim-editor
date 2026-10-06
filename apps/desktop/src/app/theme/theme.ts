import type { HexColor } from "@/lib/color.types";
import { hexToHsl, hslToHex } from "@/lib/color.utils";

const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const PRIMARY_COLOR_PRESETS = [
  { id: "amber", color: "#efbf04" },
  { id: "rose", color: "#e85d75" },
  { id: "violet", color: "#8b6ee8" },
  { id: "blue", color: "#4299e1" },
  { id: "emerald", color: "#32a876" },
] as const satisfies readonly { color: HexColor; id: string }[];

export const DEFAULT_PRIMARY_COLOR: PrimaryColor = PRIMARY_COLOR_PRESETS[0].color;

export type PrimaryColor = HexColor;

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function primaryColorPalette(color: PrimaryColor) {
  const { hue, saturation } = hexToHsl(color);
  return {
    color,
    light: hslToHex(hue, saturation, 42),
    lightForeground: saturation < 34 && hue > 35 && hue < 70 ? "#241d00" : "#ffffff",
    dark: hslToHex(hue, saturation, 67),
    darkForeground: hslToHex(hue, saturation, 13),
  };
}

function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  return preference === "system" ? (systemPrefersDark ? "dark" : "light") : preference;
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(SYSTEM_THEME_QUERY).matches
  );
}

function subscribeToSystemTheme(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

export {
  isThemePreference,
  primaryColorPalette,
  resolveTheme,
  subscribeToSystemTheme,
  systemPrefersDark,
};
