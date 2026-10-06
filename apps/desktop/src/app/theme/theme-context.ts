import { createContext } from "react";

import type { PrimaryColor, ResolvedTheme } from "./theme";

interface ThemeContextValue {
  finishPrimaryColorPreview: (committedColor: PrimaryColor) => void;
  previewPrimaryColor: (primaryColor: PrimaryColor) => void;
  resolvedTheme: ResolvedTheme;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export type { ThemeContextValue };
