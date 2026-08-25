import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  loadExportPresetState,
  presetNameError,
  type ExportPreset,
  type ExportPresetState,
} from "@/features/export/export-presets";
import type { RootState } from "../store";

export type ExportPresetAction =
  | { type: "arguments-changed"; argumentsText: string }
  | { type: "preset-selected"; presetId: string }
  | { type: "preset-new-started" }
  | { type: "preset-created"; name: string }
  | { type: "preset-updated"; name: string }
  | { type: "preset-deleted" };

const exportPresetsSlice = createSlice({
  name: "exportPresets",
  initialState: loadExportPresetState(),
  reducers: {
    exportArgumentsChanged: (state, action: PayloadAction<string>) => {
      state.argumentsText = action.payload;
    },
    exportPresetSelected: (state, action: PayloadAction<string>) => {
      const preset = state.presets.find((candidate) => candidate.id === action.payload);
      if (!preset) return;
      state.selectedPresetId = preset.id;
      state.argumentsText = preset.argumentsText;
    },
    exportPresetNewStarted: (state) => {
      state.selectedPresetId = null;
    },
    exportPresetCreated: (state, action: PayloadAction<{ name: string }>) => {
      if (presetNameError(state.presets, action.payload.name)) return;
      const nextPresetSequence = state.nextPresetSequence + 1;
      const preset: ExportPreset = {
        id: `runtime-preset-${nextPresetSequence}`,
        name: action.payload.name.trim(),
        argumentsText: state.argumentsText,
      };
      state.presets.push(preset);
      state.selectedPresetId = preset.id;
      state.nextPresetSequence = nextPresetSequence;
    },
    exportPresetUpdated: (state, action: PayloadAction<{ name: string }>) => {
      const selectedPresetId = state.selectedPresetId;
      if (!selectedPresetId || presetNameError(state.presets, action.payload.name, selectedPresetId)) {
        return;
      }
      const preset = state.presets.find((candidate) => candidate.id === selectedPresetId);
      if (preset) {
        preset.name = action.payload.name.trim();
        preset.argumentsText = state.argumentsText;
      }
    },
    exportPresetDeleted: (state) => {
      if (!state.selectedPresetId) return;
      state.presets = state.presets.filter((preset) => preset.id !== state.selectedPresetId);
      const nextPreset = state.presets[0];
      state.selectedPresetId = nextPreset?.id ?? null;
      state.argumentsText = nextPreset?.argumentsText ?? state.argumentsText;
    },
  },
});

export const {
  exportArgumentsChanged,
  exportPresetSelected,
  exportPresetNewStarted,
  exportPresetCreated,
  exportPresetUpdated,
  exportPresetDeleted,
} = exportPresetsSlice.actions;
export const exportPresetsReducer = exportPresetsSlice.reducer;

export const selectExportPresets = (state: RootState): ExportPresetState => state.exportPresets;
export const selectExportPresetList = (state: RootState): ExportPreset[] =>
  state.exportPresets.presets;
export const selectSelectedExportPreset = (state: RootState): ExportPreset | undefined =>
  state.exportPresets.presets.find(
    (preset) => preset.id === state.exportPresets.selectedPresetId,
  );
export const selectExportArguments = (state: RootState): string => state.exportPresets.argumentsText;

export function exportPresetActionToRedux(action: ExportPresetAction) {
  switch (action.type) {
    case "arguments-changed":
      return exportArgumentsChanged(action.argumentsText);
    case "preset-selected":
      return exportPresetSelected(action.presetId);
    case "preset-new-started":
      return exportPresetNewStarted();
    case "preset-created":
      return exportPresetCreated({ name: action.name });
    case "preset-updated":
      return exportPresetUpdated({ name: action.name });
    case "preset-deleted":
      return exportPresetDeleted();
  }
}
