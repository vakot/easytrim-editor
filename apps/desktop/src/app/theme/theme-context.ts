import { createContext } from "react";

import type { PrimaryColor, ResolvedTheme } from "./theme";

interface ThemeContextValue {
  getPrimaryColor: () => PrimaryColor;
  previewPrimaryColor: (primaryColor: PrimaryColor) => void;
  resolvedTheme: ResolvedTheme;
  subscribeToPrimaryColor: (listener: () => void) => () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export type { ThemeContextValue };
