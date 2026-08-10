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

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", preference === "light");
    root.classList.toggle("dark", preference === "dark");
    root.dataset.theme = resolvedTheme;
    root.dataset.primaryColor = primaryColor;
    root.style.colorScheme = resolvedTheme;

    return () => {
      root.classList.remove("light", "dark");
      delete root.dataset.theme;
      delete root.dataset.primaryColor;
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
    }),
    [preference, primaryColor, resolvedTheme, updatePreference, updatePrimaryColor],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}
