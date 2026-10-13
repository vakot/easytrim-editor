import { createContext, useContext } from "react";

import type { ExportPreset } from "@/app/store/lib/export-presets";

type PresetEditorRequest = { mode: "create" } | { mode: "edit"; preset: ExportPreset };

interface PresetEditorDialogContextValue {
  request: PresetEditorRequest | null;
  setRequest: (request: PresetEditorRequest | null) => void;
}

const PresetEditorDialogContext = createContext<PresetEditorDialogContextValue | null>(null);

function usePresetEditorDialog() {
  const context = useContext(PresetEditorDialogContext);
  if (!context) throw new Error("usePresetEditorDialog must be used within PresetEditorDialog");
  return context;
}

export { PresetEditorDialogContext, usePresetEditorDialog };
export type { PresetEditorRequest };
