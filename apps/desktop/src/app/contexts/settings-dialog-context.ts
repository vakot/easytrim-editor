import { createContext } from "react";

interface SettingsDialogContextValue {
  closeSettings: () => void;
  isSettingsOpen: boolean;
  openSettings: () => void;
}

const SettingsDialogContext = createContext<SettingsDialogContextValue | null>(null);

export { SettingsDialogContext };
export type { SettingsDialogContextValue };
