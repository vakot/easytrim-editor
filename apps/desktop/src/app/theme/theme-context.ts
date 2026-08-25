import { createContext } from "react";

import type { PrimaryColor, ResolvedTheme } from "./theme";

export interface ThemeContextValue {
  resolvedTheme: ResolvedTheme;
  previewPrimaryColor: (primaryColor: PrimaryColor | null) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
