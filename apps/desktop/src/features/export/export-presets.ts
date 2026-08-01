import { STORAGE_KEYS, readStoredJson, writeStoredJson } from "@/lib/storage";

export const DEFAULT_OPTIMIZED_ARGUMENTS =
  "-c:v hevc_nvenc -preset p3 -tune hq -rc vbr -cq 24 -b:v 0 -spatial_aq 1 -temporal_aq 1 -aq-strength 8 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart";

export interface ExportPreset {
  id: string;
  name: string;
  argumentsText: string;
  description?: string;
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

const DEFAULT_NVENC_ARGUMENTS = (preset: number) =>
  DEFAULT_OPTIMIZED_ARGUMENTS.replace("-preset p3", `-preset p${preset}`);

export const DEFAULT_PRESETS: ExportPreset[] = [
  {
    id: "hevc-nvenc-p1",
    name: "P1 · Fastest",
    description: "Fastest NVENC encoding; largest files and lowest compression efficiency.",
    argumentsText: DEFAULT_NVENC_ARGUMENTS(1),
  },
  {
    id: "hevc-nvenc-p2",
    name: "P2 · Very fast",
    description: "Very fast export with large files; useful when turnaround matters most.",
    argumentsText: DEFAULT_NVENC_ARGUMENTS(2),
  },
  {
    id: "hevc-nvenc-p3",
    name: "P3 · Fast",
    description: "Fast NVENC export with a practical balance of speed, size, and quality.",
    argumentsText: DEFAULT_NVENC_ARGUMENTS(3),
  },
  {
    id: "hevc-nvenc-p4",
    name: "P4 · Quality",
    description: "Quality-focused NVENC encoding; smaller files with a longer render time.",
    argumentsText: DEFAULT_NVENC_ARGUMENTS(4),
  },
  {
    id: "hevc-nvenc-p5",
    name: "P5 · Smallest",
    description: "Smallest files in this set; slowest NVENC option for efficient storage.",
    argumentsText: DEFAULT_NVENC_ARGUMENTS(5),
  },
];

const DEFAULT_PRESET_ID = "hevc-nvenc-p3";

export const initialExportPresetState: ExportPresetState = {
  presets: DEFAULT_PRESETS,
  selectedPresetId: DEFAULT_PRESET_ID,
  argumentsText: DEFAULT_PRESETS.find((preset) => preset.id === DEFAULT_PRESET_ID)!.argumentsText,
  nextPresetSequence: 0,
};

export function loadExportPresetState(): ExportPresetState {
  const stored = readStoredJson<Partial<ExportPresetState>>(STORAGE_KEYS.exportPresets);
  if (
    !stored ||
    !Array.isArray(stored.presets) ||
    typeof stored.argumentsText !== "string" ||
    (stored.selectedPresetId !== null && typeof stored.selectedPresetId !== "string") ||
    typeof stored.nextPresetSequence !== "number"
  ) {
    return initialExportPresetState;
  }

  const presets = stored.presets.filter(
    (preset): preset is ExportPreset =>
      Boolean(preset) &&
      typeof preset.id === "string" &&
      typeof preset.name === "string" &&
      typeof preset.argumentsText === "string",
  );
  const availablePresets = presets.length > 0 ? presets : initialExportPresetState.presets;
  const selectedPresetId = availablePresets.some((preset) => preset.id === stored.selectedPresetId)
    ? stored.selectedPresetId
    : (availablePresets[0]?.id ?? null);
  const selectedPreset = availablePresets.find((preset) => preset.id === selectedPresetId);

  return {
    presets: availablePresets,
    selectedPresetId,
    argumentsText: selectedPreset?.argumentsText ?? stored.argumentsText,
    nextPresetSequence: Math.max(0, Math.floor(stored.nextPresetSequence)),
  };
}

export function persistExportPresetState(state: ExportPresetState): void {
  writeStoredJson(STORAGE_KEYS.exportPresets, state);
}

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
