import { createContext } from "react";

export type UpdateStatus = "idle" | "checking" | "up-to-date" | "available" | "error";

export interface AppUpdates {
  status: UpdateStatus;
  availableVersion: string | null;
  isInstalling: boolean;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

const defaultAppUpdates: AppUpdates = {
  status: "idle",
  availableVersion: null,
  isInstalling: false,
  checkForUpdates: async () => undefined,
  installUpdate: async () => undefined,
};

export const AppUpdatesContext = createContext<AppUpdates>(defaultAppUpdates);
