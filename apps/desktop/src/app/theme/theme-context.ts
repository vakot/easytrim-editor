import { createContext } from "react";

import type { PrimaryColor, ResolvedTheme } from "./theme";

export interface ThemeContextValue {
  previewPrimaryColor: (primaryColor: PrimaryColor | null) => void;
  resolvedTheme: ResolvedTheme;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
