import type { Middleware } from "@reduxjs/toolkit";

import type { RootState } from "../store";
import { persistExportPresetState } from "@/features/export/export-presets";

export const exportPresetPersistenceMiddleware: Middleware<unknown, RootState> =
  ({ getState }) =>
  (next) =>
  (action) => {
    const result = next(action);
    if (
      typeof action === "object" &&
      action !== null &&
      "type" in action &&
      typeof action.type === "string" &&
      action.type.startsWith("exportPresets/")
    ) {
      persistExportPresetState(getState().exportPresets);
    }
    return result;
  };
