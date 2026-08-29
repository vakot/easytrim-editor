import type { HexColor } from "@/lib/color.types";
import { hexToHsl, hslToHex } from "@/lib/color.utils";

const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const PRIMARY_COLORS = ["amber", "rose", "violet", "blue", "emerald"] as const;
export const CUSTOM_PRIMARY_COLOR = "custom" as const;
export const DEFAULT_PRIMARY_COLOR = "amber" as const;
export const DEFAULT_CUSTOM_PRIMARY_COLOR = "#efbf04" as const;

export type PrimaryColorKey = (typeof PRIMARY_COLORS)[number] | typeof CUSTOM_PRIMARY_COLOR;
export type CustomPrimaryColor = HexColor;
export type PrimaryColor = (typeof PRIMARY_COLORS)[number] | CustomPrimaryColor;

const primaryColorValues = {
  amber: "#efbf04",
  rose: "#e85d75",
  violet: "#8b6ee8",
  blue: "#4299e1",
  emerald: "#32a876",
} as const;

export function isCustomPrimaryColor(value: unknown): value is CustomPrimaryColor {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function resolvePrimaryColor(color: PrimaryColor): string {
  return color.startsWith("#")
    ? color
    : primaryColorValues[color as (typeof PRIMARY_COLORS)[number]];
}

export function primaryColorPalette(color: PrimaryColor) {
  const hex = resolvePrimaryColor(color);
  const { hue, saturation } = hexToHsl(hex);
  return {
    color: hex,
    light: hslToHex(hue, saturation, 42),
    lightForeground: saturation < 34 && hue > 35 && hue < 70 ? "#241d00" : "#ffffff",
    dark: hslToHex(hue, saturation, 67),
    darkForeground: hslToHex(hue, saturation, 13),
  };
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  return preference === "system" ? (systemPrefersDark ? "dark" : "light") : preference;
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(SYSTEM_THEME_QUERY).matches
  );
}

export function subscribeToSystemTheme(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}
