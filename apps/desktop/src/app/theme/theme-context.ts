import { createContext } from "react";

import type {
  CustomPrimaryColor,
  PrimaryColor,
  PrimaryColorKey,
  ResolvedTheme,
  ThemePreference,
} from "./theme";

export interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  primaryColor: PrimaryColor;
  primaryColorKey: PrimaryColorKey;
  customPrimaryColor: CustomPrimaryColor;
  setPreference: (preference: ThemePreference) => void;
  setPrimaryColor: (primaryColor: PrimaryColor) => void;
  previewPrimaryColor: (primaryColor: PrimaryColor | null) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
