import { type ReactNode, useCallback, useLayoutEffect, useMemo, useSyncExternalStore } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectPrimaryColor, selectThemePreference } from "@/app/store/slices/preferences-slice";

import {
  type PrimaryColor,
  primaryColorPalette,
  resolveTheme,
  subscribeToSystemTheme,
  systemPrefersDark,
} from "./theme";
import { ThemeContext } from "./theme-context";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useAppSelector(selectThemePreference);
  const primaryColor = useAppSelector(selectPrimaryColor);
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, systemPrefersDark, () => false);
  const resolvedTheme = resolveTheme(preference, systemDark);
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
    () => ({ resolvedTheme, previewPrimaryColor }),
    [resolvedTheme, previewPrimaryColor],
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
