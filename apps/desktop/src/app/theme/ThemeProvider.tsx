import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

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

function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useAppSelector(selectThemePreference);
  const primaryColor = useAppSelector(selectPrimaryColor);
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, systemPrefersDark, () => false);
  const resolvedTheme = resolveTheme(preference, systemDark);
  const previewedColor = useRef<PrimaryColor | null>(null);
  const previousPrimaryColor = useRef(primaryColor);

  const previewPrimaryColor = useCallback(
    (nextPrimaryColor: PrimaryColor) => {
      const root = document.documentElement;
      const isPersistedColor = nextPrimaryColor === primaryColor;
      previewedColor.current = isPersistedColor ? null : nextPrimaryColor;
      root.toggleAttribute("data-primary-color-scrubbing", !isPersistedColor);
      if (!isPersistedColor) {
        root.style.setProperty("--primary-color-preview", nextPrimaryColor);
      } else {
        root.style.removeProperty("--primary-color-preview");
      }
      applyPrimaryColor(root, nextPrimaryColor);
    },
    [primaryColor],
  );

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", preference === "light");
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.dataset.theme = resolvedTheme;
    if (previousPrimaryColor.current !== primaryColor) {
      previousPrimaryColor.current = primaryColor;
      previewedColor.current = null;
      root.removeAttribute("data-primary-color-scrubbing");
      root.style.removeProperty("--primary-color-preview");
    }
    applyPrimaryColor(root, previewedColor.current ?? primaryColor);
    root.style.colorScheme = resolvedTheme;

    return () => {
      root.classList.remove("light", "dark");
      delete root.dataset.theme;
      root.removeAttribute("data-primary-color-scrubbing");
      previewedColor.current = null;
      root.style.removeProperty("--primary-color-preview");
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

export { ThemeProvider };
