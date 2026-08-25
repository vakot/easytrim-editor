import { createContext } from "react";

export type UpdateStatus = "idle" | "checking" | "up-to-date" | "available" | "error";

export interface AppUpdates {
  status: UpdateStatus;
  availableVersion: string | null;
  isInstalling: boolean;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

export const AppUpdatesContext = createContext<AppUpdates | null>(null);
