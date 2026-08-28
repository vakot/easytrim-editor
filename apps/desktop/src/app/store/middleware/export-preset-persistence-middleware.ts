import type { Middleware } from "@reduxjs/toolkit";

import { persistExportPresetState } from "@/features/export/export-presets";

import type { RootState } from "../store";

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
