import { useContext, useSyncExternalStore } from "react";

import { ThemeContext, type ThemeContextValue } from "./theme-context";

function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

function usePrimaryColor() {
  const { getPrimaryColor, subscribeToPrimaryColor } = useTheme();
  return useSyncExternalStore(subscribeToPrimaryColor, getPrimaryColor, getPrimaryColor);
}

export { usePrimaryColor, useTheme };
