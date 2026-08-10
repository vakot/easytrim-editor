export const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";
export const THEME_PREFERENCES = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export const PRIMARY_COLORS = ["amber", "rose", "violet", "blue", "emerald"] as const;

export type PrimaryColor = (typeof PRIMARY_COLORS)[number] | `#${string}`;

const primaryColorValues = {
  amber: "#efbf04",
  rose: "#e85d75",
  violet: "#8b6ee8",
  blue: "#4299e1",
  emerald: "#32a876",
} as const;

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && THEME_PREFERENCES.includes(value as ThemePreference);
}

export function isPrimaryColor(value: unknown): value is PrimaryColor {
  return (
    typeof value === "string" &&
    (PRIMARY_COLORS.includes(value as (typeof PRIMARY_COLORS)[number]) ||
      /^#[0-9a-f]{6}$/i.test(value))
  );
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
    light: hslToHex(hue, Math.max(saturation, 48), 42),
    lightForeground: saturation < 34 && hue > 35 && hue < 70 ? "#241d00" : "#ffffff",
    dark: hslToHex(hue, Math.max(saturation, 54), 67),
    darkForeground: hslToHex(hue, Math.max(saturation, 42), 13),
  };
}

export function colorFromSpectrumPosition(x: number, y: number, size: number): `#${string}` {
  const radius = size / 2;
  const horizontal = x - radius;
  const vertical = y - radius;
  const distance = Math.min(Math.hypot(horizontal, vertical) / radius, 1);
  const hue = (Math.atan2(vertical, horizontal) * 180) / Math.PI + 90;
  return hslToHex((hue + 360) % 360, distance * 100, 50);
}

export function hslToHex(hue: number, saturation: number, lightness: number): `#${string}` {
  const chroma = (1 - Math.abs((2 * lightness) / 100 - 1)) * (saturation / 100);
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const [red, green, blue] =
    segment < 1
      ? [chroma, secondary, 0]
      : segment < 2
        ? [secondary, chroma, 0]
        : segment < 3
          ? [0, chroma, secondary]
          : segment < 4
            ? [0, secondary, chroma]
            : segment < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  const match = lightness / 100 - chroma / 2;
  return `#${[red, green, blue]
    .map((channel) =>
      Math.round((channel + match) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function hexToHsl(hex: string) {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const hue =
    delta === 0
      ? 0
      : ((maximum === red
          ? (green - blue) / delta
          : maximum === green
            ? (blue - red) / delta + 2
            : (red - green) / delta + 4) *
          60 +
          360) %
        360;
  return { hue, saturation: saturation * 100 };
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
