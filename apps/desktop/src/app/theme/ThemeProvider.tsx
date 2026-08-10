import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { STORAGE_KEYS, readStoredJson, writeStoredJson } from "@/lib/storage";
import {
  isThemePreference,
  isPrimaryColor,
  primaryColorPalette,
  resolveTheme,
  subscribeToSystemTheme,
  systemPrefersDark,
  type ThemePreference,
  type PrimaryColor,
} from "./theme";
import { ThemeContext } from "./theme-context";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const stored = readStoredJson<{ theme?: unknown }>(STORAGE_KEYS.preferences);
    return isThemePreference(stored?.theme) ? stored.theme : "system";
  });
  const [primaryColor, setPrimaryColor] = useState<PrimaryColor>(() => {
    const stored = readStoredJson<{ primaryColor?: unknown }>(STORAGE_KEYS.preferences);
    return isPrimaryColor(stored?.primaryColor) ? stored.primaryColor : "amber";
  });
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, systemPrefersDark, () => false);
  const resolvedTheme = resolveTheme(preference, systemDark);
  const updatePreference = useCallback((nextPreference: ThemePreference) => {
    setPreference(nextPreference);
    const stored = readStoredJson<Record<string, unknown>>(STORAGE_KEYS.preferences) ?? {};
    writeStoredJson(STORAGE_KEYS.preferences, { ...stored, theme: nextPreference });
  }, []);
  const updatePrimaryColor = useCallback((nextPrimaryColor: PrimaryColor) => {
    setPrimaryColor(nextPrimaryColor);
    const stored = readStoredJson<Record<string, unknown>>(STORAGE_KEYS.preferences) ?? {};
    writeStoredJson(STORAGE_KEYS.preferences, { ...stored, primaryColor: nextPrimaryColor });
  }, []);
  const previewPrimaryColor = useCallback(
    (nextPrimaryColor: PrimaryColor | null) => {
      const root = document.documentElement;
      root.toggleAttribute("data-primary-color-scrubbing", nextPrimaryColor !== null);
      const appliedColor = nextPrimaryColor ?? primaryColor;
      root.dataset.primaryColor = appliedColor;
      applyPrimaryColor(root, appliedColor);
    },
    [primaryColor],
  );

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", preference === "light");
    root.classList.toggle("dark", preference === "dark");
    root.dataset.theme = resolvedTheme;
    root.dataset.primaryColor = primaryColor;
    applyPrimaryColor(root, primaryColor);
    root.style.colorScheme = resolvedTheme;

    return () => {
      root.classList.remove("light", "dark");
      delete root.dataset.theme;
      delete root.dataset.primaryColor;
      root.removeAttribute("data-primary-color-scrubbing");
      root.style.removeProperty("--primary-light");
      root.style.removeProperty("--primary-foreground-light");
      root.style.removeProperty("--primary-dark");
      root.style.removeProperty("--primary-foreground-dark");
      root.style.removeProperty("color-scheme");
    };
  }, [preference, primaryColor, resolvedTheme]);

  const value = useMemo(
    () => ({
      preference,
      resolvedTheme,
      primaryColor,
      setPreference: updatePreference,
      setPrimaryColor: updatePrimaryColor,
      previewPrimaryColor,
    }),
    [
      preference,
      primaryColor,
      resolvedTheme,
      updatePreference,
      updatePrimaryColor,
      previewPrimaryColor,
    ],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

function applyPrimaryColor(root: HTMLElement, primaryColor: PrimaryColor) {
  const palette = primaryColorPalette(primaryColor);
  root.style.setProperty("--primary-light", palette.light);
  root.style.setProperty("--primary-foreground-light", palette.lightForeground);
  root.style.setProperty("--primary-dark", palette.dark);
  root.style.setProperty("--primary-foreground-dark", palette.darkForeground);
}
