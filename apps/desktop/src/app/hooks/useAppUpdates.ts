import { useContext } from "react";

import { type AppUpdates, AppUpdatesContext } from "@/app/contexts/app-updates-context";

export function useAppUpdates(): AppUpdates {
  const value = useContext(AppUpdatesContext);
  if (!value) {
    throw new Error("useAppUpdates must be used within AppUpdatesProvider.");
  }
  return value;
}
