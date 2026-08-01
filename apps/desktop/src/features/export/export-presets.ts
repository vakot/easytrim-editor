export const DEFAULT_OPTIMIZED_ARGUMENTS =
  "-c:v hevc_nvenc -preset p3 -tune hq -rc vbr -cq 24 -b:v 0 -spatial_aq 1 -temporal_aq 1 -aq-strength 8 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart";

export interface ExportPreset {
  id: string;
  name: string;
  argumentsText: string;
}

export interface ExportPresetState {
  presets: ExportPreset[];
  selectedPresetId: string | null;
  argumentsText: string;
  nextPresetSequence: number;
}

export type ExportPresetAction =
  | { type: "arguments-changed"; argumentsText: string }
  | { type: "preset-selected"; presetId: string }
  | { type: "preset-new-started" }
  | { type: "preset-created"; name: string }
  | { type: "preset-updated"; name: string }
  | { type: "preset-deleted" };

const DEFAULT_PRESET: ExportPreset = {
  id: "balanced-hevc-nvenc",
  name: "Balanced HEVC (NVENC)",
  argumentsText: DEFAULT_OPTIMIZED_ARGUMENTS,
};

export const initialExportPresetState: ExportPresetState = {
  presets: [DEFAULT_PRESET],
  selectedPresetId: DEFAULT_PRESET.id,
  argumentsText: DEFAULT_PRESET.argumentsText,
  nextPresetSequence: 0,
};

export function exportPresetReducer(
  state: ExportPresetState,
  action: ExportPresetAction,
): ExportPresetState {
  switch (action.type) {
    case "arguments-changed":
      return { ...state, argumentsText: action.argumentsText };
    case "preset-selected": {
      const preset = state.presets.find((candidate) => candidate.id === action.presetId);
      return preset
        ? { ...state, selectedPresetId: preset.id, argumentsText: preset.argumentsText }
        : state;
    }
    case "preset-new-started":
      return { ...state, selectedPresetId: null };
    case "preset-created": {
      if (presetNameError(state.presets, action.name)) {
        return state;
      }
      const nextPresetSequence = state.nextPresetSequence + 1;
      const preset: ExportPreset = {
        id: `runtime-preset-${nextPresetSequence}`,
        name: action.name.trim(),
        argumentsText: state.argumentsText,
      };
      return {
        ...state,
        presets: [...state.presets, preset],
        selectedPresetId: preset.id,
        nextPresetSequence,
      };
    }
    case "preset-updated": {
      const selectedPresetId = state.selectedPresetId;
      if (!selectedPresetId || presetNameError(state.presets, action.name, selectedPresetId)) {
        return state;
      }
      return {
        ...state,
        presets: state.presets.map((preset) =>
          preset.id === selectedPresetId
            ? {
                ...preset,
                name: action.name.trim(),
                argumentsText: state.argumentsText,
              }
            : preset,
        ),
      };
    }
    case "preset-deleted": {
      if (!state.selectedPresetId) {
        return state;
      }
      const presets = state.presets.filter((preset) => preset.id !== state.selectedPresetId);
      const nextPreset = presets[0];
      return {
        ...state,
        presets,
        selectedPresetId: nextPreset?.id ?? null,
        argumentsText: nextPreset?.argumentsText ?? state.argumentsText,
      };
    }
  }
}

export function selectedExportPreset(state: ExportPresetState): ExportPreset | undefined {
  return state.presets.find((preset) => preset.id === state.selectedPresetId);
}

export function presetNameError(
  presets: ExportPreset[],
  name: string,
  excludedPresetId?: string,
): string | null {
  const normalized = name.trim();
  if (!normalized) {
    return "A preset name is required.";
  }
  if (normalized.length > 64) {
    return "Preset names must be 64 characters or fewer.";
  }
  if (
    presets.some(
      (preset) =>
        preset.id !== excludedPresetId &&
        preset.name.localeCompare(normalized, undefined, { sensitivity: "accent" }) === 0,
    )
  ) {
    return "Preset names must be unique.";
  }
  return null;
}
