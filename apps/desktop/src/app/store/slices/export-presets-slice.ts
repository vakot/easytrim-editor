import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  type ExportPreset,
  loadExportPresetState,
  presetNameError,
} from "@/app/store/export-presets";

import type { RootState } from "../store";

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
      if (
        !selectedPresetId ||
        presetNameError(state.presets, action.payload.name, selectedPresetId)
      ) {
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
  exportPresetCreated,
  exportPresetUpdated,
  exportPresetDeleted,
} = exportPresetsSlice.actions;
export const exportPresetsReducer = exportPresetsSlice.reducer;

export const selectExportPresetList = (state: RootState): ExportPreset[] =>
  state.exportPresets.presets;
export const selectSelectedExportPreset = (state: RootState): ExportPreset | undefined =>
  state.exportPresets.presets.find((preset) => preset.id === state.exportPresets.selectedPresetId);
export const selectExportArguments = (state: RootState): string =>
  state.exportPresets.argumentsText;
