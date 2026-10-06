import { useContext } from "react";

import { SettingsDialogContext } from "@/app/contexts/settings-dialog-context";

function useSettingsDialog() {
  const context = useContext(SettingsDialogContext);
  if (!context) throw new Error("useSettingsDialog must be used within SettingsDialogProvider.");
  return context;
}

export { useSettingsDialog };
