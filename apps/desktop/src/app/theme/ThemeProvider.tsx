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
  isCustomPrimaryColor,
  isPrimaryColorKey,
  CUSTOM_PRIMARY_COLOR,
  primaryColorPalette,
  resolveTheme,
  subscribeToSystemTheme,
  systemPrefersDark,
  type ThemePreference,
  type PrimaryColor,
  type PrimaryColorKey,
  type CustomPrimaryColor,
} from "./theme";
import { ThemeContext } from "./theme-context";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const stored = readStoredJson<{ theme?: unknown }>(STORAGE_KEYS.preferences);
    return isThemePreference(stored?.theme) ? stored.theme : "system";
  });
  const [colorState, setColorState] = useState(() => readStoredColorState());
  const { primaryColor, primaryColorKey, customPrimaryColor } = colorState;
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, systemPrefersDark, () => false);
  const resolvedTheme = resolveTheme(preference, systemDark);
  const updatePreference = useCallback((nextPreference: ThemePreference) => {
    setPreference(nextPreference);
    const stored = readStoredJson<Record<string, unknown>>(STORAGE_KEYS.preferences) ?? {};
    writeStoredJson(STORAGE_KEYS.preferences, { ...stored, theme: nextPreference });
  }, []);
  const updatePrimaryColor = useCallback(
    (nextPrimaryColor: PrimaryColor) => {
      const nextPrimaryColorKey: PrimaryColorKey = isCustomPrimaryColor(nextPrimaryColor)
        ? CUSTOM_PRIMARY_COLOR
        : nextPrimaryColor;
      const nextCustomPrimaryColor = isCustomPrimaryColor(nextPrimaryColor)
        ? nextPrimaryColor
        : colorState.customPrimaryColor;
      const stored = readStoredJson<Record<string, unknown>>(STORAGE_KEYS.preferences) ?? {};
      writeStoredJson(STORAGE_KEYS.preferences, {
        ...stored,
        primaryColor: nextPrimaryColorKey,
        customPrimaryColor: nextCustomPrimaryColor,
      });
      setColorState({
        primaryColor: nextPrimaryColor,
        primaryColorKey: nextPrimaryColorKey,
        customPrimaryColor: nextCustomPrimaryColor,
      });
    },
    [colorState.customPrimaryColor],
  );
  const previewPrimaryColor = useCallback(
    (nextPrimaryColor: PrimaryColor | null) => {
      const root = document.documentElement;
      root.toggleAttribute("data-primary-color-scrubbing", nextPrimaryColor !== null);
      const appliedColor = nextPrimaryColor ?? colorState.primaryColor;
      root.dataset.primaryColor = appliedColor;
      applyPrimaryColor(root, appliedColor);
    },
    [colorState.primaryColor],
  );

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", preference === "light");
    root.classList.toggle("dark", preference === "dark");
    root.dataset.theme = resolvedTheme;
    root.dataset.primaryColor = colorState.primaryColor;
    applyPrimaryColor(root, colorState.primaryColor);
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
  }, [preference, colorState.primaryColor, resolvedTheme]);

  const value = useMemo(
    () => ({
      preference,
      resolvedTheme,
      primaryColor,
      primaryColorKey,
      customPrimaryColor,
      setPreference: updatePreference,
      setPrimaryColor: updatePrimaryColor,
      previewPrimaryColor,
    }),
    [
      preference,
      primaryColor,
      primaryColorKey,
      customPrimaryColor,
      resolvedTheme,
      updatePreference,
      updatePrimaryColor,
      previewPrimaryColor,
    ],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

interface StoredColorPreferences {
  primaryColor?: unknown;
  customPrimaryColor?: unknown;
}

interface ColorState {
  primaryColor: PrimaryColor;
  primaryColorKey: PrimaryColorKey;
  customPrimaryColor: CustomPrimaryColor;
}

function readStoredColorState(): ColorState {
  const stored = readStoredJson<StoredColorPreferences>(STORAGE_KEYS.preferences);
  const storedCustomPrimaryColor = isCustomPrimaryColor(stored?.customPrimaryColor)
    ? stored.customPrimaryColor
    : "#efbf04";

  if (isPrimaryColorKey(stored?.primaryColor)) {
    if (stored.primaryColor === CUSTOM_PRIMARY_COLOR) {
      return {
        primaryColor: storedCustomPrimaryColor,
        primaryColorKey: CUSTOM_PRIMARY_COLOR,
        customPrimaryColor: storedCustomPrimaryColor,
      };
    }
    return {
      primaryColor: stored.primaryColor,
      primaryColorKey: stored.primaryColor,
      customPrimaryColor: storedCustomPrimaryColor,
    };
  }

  if (isCustomPrimaryColor(stored?.primaryColor)) {
    return {
      primaryColor: stored.primaryColor,
      primaryColorKey: CUSTOM_PRIMARY_COLOR,
      customPrimaryColor: stored.primaryColor,
    };
  }

  return {
    primaryColor: "amber",
    primaryColorKey: "amber",
    customPrimaryColor: storedCustomPrimaryColor,
  };
}

function applyPrimaryColor(root: HTMLElement, primaryColor: PrimaryColor) {
  const palette = primaryColorPalette(primaryColor);
  root.style.setProperty("--primary-light", palette.light);
  root.style.setProperty("--primary-foreground-light", palette.lightForeground);
  root.style.setProperty("--primary-dark", palette.dark);
  root.style.setProperty("--primary-foreground-dark", palette.darkForeground);
}
