import { createContext, useContext } from "react";

import type { ExportPreset } from "@/app/store/lib/export-presets";

interface PresetDeleteDialogContextValue {
  preset: ExportPreset | null;
  setPreset: (preset: ExportPreset | null) => void;
}

const PresetDeleteDialogContext = createContext<PresetDeleteDialogContextValue | null>(null);

function usePresetDeleteDialog() {
  const context = useContext(PresetDeleteDialogContext);
  if (!context) throw new Error("usePresetDeleteDialog must be used within PresetDeleteDialog");
  return context;
}

export { PresetDeleteDialogContext, usePresetDeleteDialog };
