import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { type ExportPreset, loadExportPresetState } from "@/app/store/lib/export-presets";

import type { RootState } from "../store";

type ExportPresetUpdate =
  | { argumentsText: string; customName: string | null; presetKind: "builtIn" }
  | { argumentsText: string; name: string; presetKind: "custom" };

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
      const nextPresetSequence = state.nextPresetSequence + 1;
      const preset: ExportPreset = {
        id: `runtime-preset-${nextPresetSequence}`,
        kind: "custom",
        name: action.payload.name.trim(),
        argumentsText: state.argumentsText,
      };

      state.presets.push(preset);
      state.selectedPresetId = preset.id;
      state.nextPresetSequence = nextPresetSequence;
    },
    exportPresetUpdated: (state, action: PayloadAction<ExportPresetUpdate>) => {
      const selectedPresetId = state.selectedPresetId;
      if (!selectedPresetId) {
        return;
      }
      const preset = state.presets.find((candidate) => candidate.id === selectedPresetId);
      if (!preset) return;

      if (preset.kind === "builtIn" && action.payload.presetKind === "builtIn") {
        if (action.payload.customName === null) delete preset.customName;
        else preset.customName = action.payload.customName;
      } else if (preset.kind === "custom" && action.payload.presetKind === "custom") {
        preset.name = action.payload.name.trim();
      } else {
        return;
      }
      preset.argumentsText = action.payload.argumentsText;
      state.argumentsText = action.payload.argumentsText;
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

const {
  exportArgumentsChanged,
  exportPresetCreated,
  exportPresetDeleted,
  exportPresetSelected,
  exportPresetUpdated,
} = exportPresetsSlice.actions;

const exportPresetsReducer = exportPresetsSlice.reducer;

const selectExportPresetList = (state: RootState): ExportPreset[] => state.exportPresets.presets;
const selectSelectedExportPreset = (state: RootState): ExportPreset | undefined =>
  state.exportPresets.presets.find((preset) => preset.id === state.exportPresets.selectedPresetId);

const selectExportArguments = (state: RootState): string => state.exportPresets.argumentsText;

export {
  exportArgumentsChanged,
  exportPresetCreated,
  exportPresetDeleted,
  exportPresetSelected,
  exportPresetsReducer,
  exportPresetUpdated,
  selectExportArguments,
  selectExportPresetList,
  selectSelectedExportPreset,
};
