import { useAppDialog } from "@/app/hooks/useAppDialog";

function useSettingsDialog() {
  return useAppDialog("settings");
}

export { useSettingsDialog };
