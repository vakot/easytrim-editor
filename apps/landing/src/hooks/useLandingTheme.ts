import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

import {
  applyTheme,
  isThemePreference,
  resolveTheme,
  subscribeToSystemTheme,
  systemPrefersDark,
  type ThemePreference,
} from "@easytrim-editor/ui/theme";

/** Shared with the pre-paint script in `index.html`, which applies a saved choice before React. */
const THEME_STORAGE_KEY = "easytrim-landing-theme";

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * Runs a theme change inside a view transition, so the page crossfades to the new colors in the
 * 300ms set in `globals.css` instead of each element following its own transition. The update is
 * flushed synchronously so the new theme is applied before the browser captures the new view.
 * Without view transitions, or with reduced motion, the theme switches at once.
 *
 * `data-theme-switching` pauses element transitions for the switch, so the new view, or the page
 * itself without a view transition, shows the final colors at once.
 */
function transitionTheme(update: () => void) {
  const root = document.documentElement;
  root.dataset.themeSwitching = "";
  const done = () => delete root.dataset.themeSwitching;

  if (typeof document.startViewTransition !== "function" || prefersReducedMotion()) {
    update();
    // Keep transitions paused until the new colors have been styled once.
    requestAnimationFrame(() => requestAnimationFrame(done));
    return;
  }
  document.startViewTransition(() => flushSync(update)).finished.finally(done);
}

function subscribeToSystemThemeTransition(onChange: () => void): () => void {
  return subscribeToSystemTheme(() => transitionTheme(onChange));
}

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
 * The visitor's System, Light, or Dark choice, applied to the page exactly as the application
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
