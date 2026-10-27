import type { HexColor } from "./color.types";
import { hexToHsl, hslToHex } from "./color.utils";

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

/**
 * Applies a theme to the document root the way the token stylesheet expects: `.dark` whenever the
 * resolved theme is dark, and `.light` only for an explicit light choice, so a system light theme
 * keeps following the operating system's default tokens.
 */
function applyTheme(root: HTMLElement, preference: ThemePreference, resolvedTheme: ResolvedTheme) {
  root.classList.toggle("light", preference === "light");
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
}

/** Sets the light and dark primary tokens derived from one primary color. */
function applyPrimaryColor(root: HTMLElement, primaryColor: PrimaryColor) {
  const palette = primaryColorPalette(primaryColor);
  root.style.setProperty("--primary-light", palette.light);
  root.style.setProperty("--primary-foreground-light", palette.lightForeground);
  root.style.setProperty("--primary-dark", palette.dark);
  root.style.setProperty("--primary-foreground-dark", palette.darkForeground);
}

export {
  applyPrimaryColor,
  applyTheme,
  isThemePreference,
  primaryColorPalette,
  resolveTheme,
  subscribeToSystemTheme,
  systemPrefersDark,
};
