import { STORAGE_KEYS } from "@/lib/storage.consts";
import { readStoredJson, writeStoredJson } from "@/lib/storage.utils";

const DEFAULT_OPTIMIZED_ARGUMENTS =
  "-c:v hevc_nvenc -preset p3 -tune hq -rc vbr -cq 24 -b:v 0 -spatial_aq 1 -temporal_aq 1 -aq-strength 8 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart";

export interface ExportPreset {
  argumentsText: string;
  description?: string;
  id: string;
  name: string;
}

export type PresetNameError = "duplicate" | "required" | "tooLong";

interface ExportPresetState {
  argumentsText: string;
  nextPresetSequence: number;
  presets: ExportPreset[];
  selectedPresetId: string | null;
}

const DEFAULT_NVENC_ARGUMENTS = (preset: number) =>
  DEFAULT_OPTIMIZED_ARGUMENTS.replace("-preset p3", `-preset p${preset}`);

const DEFAULT_PRESETS: ExportPreset[] = [
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
    name: "P5 · Smaller",
    description: "Smaller files with a moderate render-time tradeoff.",
    argumentsText: DEFAULT_NVENC_ARGUMENTS(5),
  },
  {
    id: "hevc-nvenc-p6",
    name: "P6 · Very small",
    description: "Higher compression efficiency; slower encoding for very small files.",
    argumentsText: DEFAULT_NVENC_ARGUMENTS(6),
  },
  {
    id: "hevc-nvenc-p7",
    name: "P7 · Smallest",
    description: "Highest-efficiency NVENC preset; slowest option in the full preset range.",
    argumentsText: DEFAULT_NVENC_ARGUMENTS(7),
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
    nextPresetSequence: stored.nextPresetSequence,
  };
}

export function persistExportPresetState(state: ExportPresetState): void {
  writeStoredJson(STORAGE_KEYS.exportPresets, state);
}

export function presetNameError(
  presets: ExportPreset[],
  name: string,
  excludedPresetId?: string,
): PresetNameError | null {
  const normalized = name.trim();
  if (!normalized) {
    return "required";
  }
  if (normalized.length > 64) {
    return "tooLong";
  }
  if (
    presets.some(
      (preset) =>
        preset.id !== excludedPresetId &&
        preset.name.localeCompare(normalized, undefined, { sensitivity: "accent" }) === 0,
    )
  ) {
    return "duplicate";
  }
  return null;
}
