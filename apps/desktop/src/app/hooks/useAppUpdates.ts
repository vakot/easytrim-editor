import { useContext } from "react";

import { AppUpdatesContext } from "@/app/contexts/app-updates-context";

export function useAppUpdates() {
  return useContext(AppUpdatesContext);
}
