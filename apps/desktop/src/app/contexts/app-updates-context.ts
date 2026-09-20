import { createContext } from "react";

export type UpdateStatus = "idle" | "checking" | "up-to-date" | "available" | "error";

interface AppUpdates {
  availableVersion: string | null;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
  isInstalling: boolean;
  status: UpdateStatus;
}

export const AppUpdatesContext = createContext<AppUpdates | null>(null);

export type { AppUpdates };
