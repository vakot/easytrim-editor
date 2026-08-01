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
  resolveTheme,
  subscribeToSystemTheme,
  systemPrefersDark,
  type ThemePreference,
} from "./theme";
import { ThemeContext } from "./theme-context";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const stored = readStoredJson<{ theme?: unknown }>(STORAGE_KEYS.preferences);
    return isThemePreference(stored?.theme) ? stored.theme : "system";
  });
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, systemPrefersDark, () => false);
  const resolvedTheme = resolveTheme(preference, systemDark);
  const updatePreference = useCallback((nextPreference: ThemePreference) => {
    setPreference(nextPreference);
    const stored = readStoredJson<Record<string, unknown>>(STORAGE_KEYS.preferences) ?? {};
    writeStoredJson(STORAGE_KEYS.preferences, { ...stored, theme: nextPreference });
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", preference === "light");
    root.classList.toggle("dark", preference === "dark");
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;

    return () => {
      root.classList.remove("light", "dark");
      delete root.dataset.theme;
      root.style.removeProperty("color-scheme");
    };
  }, [preference, resolvedTheme]);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference: updatePreference }),
    [preference, resolvedTheme, updatePreference],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}
