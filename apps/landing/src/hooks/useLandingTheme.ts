import { useLayoutEffect, useState, useSyncExternalStore } from "react";

import {
  applyTheme,
  isThemePreference,
  resolveTheme,
  subscribeToSystemThemeTransition,
  systemPrefersDark,
  type ThemePreference,
  transitionTheme,
} from "@easytrim-editor/ui/theme";

/** Shared with the pre-paint script in `index.html`, which applies a saved choice before React. */
const THEME_STORAGE_KEY = "easytrim-landing-theme";

function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function storeTheme(preference: ThemePreference) {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable, such as in a private window; the choice then lasts for the visit.
  }
}

/**
 * The visitor's System, Light, or Dark choice, applied and crossfaded exactly as the application
 * applies its own, and remembered on this device.
 */
function useLandingTheme() {
  const [preference, setPreference] = useState(readStoredTheme);
  const systemDark = useSyncExternalStore(
    subscribeToSystemThemeTransition,
    systemPrefersDark,
    () => false,
  );

  const resolvedTheme = resolveTheme(preference, systemDark);

  useLayoutEffect(() => {
    applyTheme(document.documentElement, preference, resolvedTheme);
  }, [preference, resolvedTheme]);

  function changePreference(next: ThemePreference) {
    storeTheme(next);
    // A choice that resolves to the colors already shown has nothing to crossfade.
    if (resolveTheme(next, systemDark) === resolvedTheme) setPreference(next);
    else transitionTheme(() => setPreference(next));
  }

  return { preference, resolvedTheme, setPreference: changePreference };
}

export { THEME_STORAGE_KEY, useLandingTheme };
