import { useContext } from "react";

import { ExportPanelControllerContext } from "@/app/contexts/export-panel-context";

export function useExportPanelController() {
  const value = useContext(ExportPanelControllerContext);
  if (!value) {
    throw new Error("useExportPanelController must be used within ExportPanelControllerProvider.");
  }
  return value;
}
