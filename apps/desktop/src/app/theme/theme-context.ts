import { createContext } from "react";

import type { PrimaryColor, ResolvedTheme, ThemePreference } from "./theme";

export interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  primaryColor: PrimaryColor;
  setPreference: (preference: ThemePreference) => void;
  setPrimaryColor: (primaryColor: PrimaryColor) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
