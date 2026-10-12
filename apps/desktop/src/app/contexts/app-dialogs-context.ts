import { createContext } from "react";

interface AppDialogsContextValue {
  closeCommandPalette: () => void;
  closeSettings: () => void;
  isCommandPaletteOpen: boolean;
  isSettingsOpen: boolean;
  openCommandPalette: () => void;
  openSettings: () => void;
  toggleCommandPalette: () => void;
}

const AppDialogsContext = createContext<AppDialogsContextValue | null>(null);

export { AppDialogsContext };
export type { AppDialogsContextValue };
