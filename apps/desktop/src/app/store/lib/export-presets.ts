import { STORAGE_KEYS } from "@/lib/storage.consts";
import { readStoredJson, writeStoredJson } from "@/lib/storage.utils";

const DEFAULT_OPTIMIZED_ARGUMENTS =
  "-c:v hevc_nvenc -preset p3 -tune hq -rc vbr -cq 24 -b:v 0 -spatial-aq 1 -temporal-aq 1 -aq-strength 8 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart";

const LEGACY_DEFAULT_OPTIMIZED_ARGUMENTS =
  "-c:v hevc_nvenc -preset p3 -tune hq -rc vbr -cq 24 -b:v 0 -spatial_aq 1 -temporal_aq 1 -aq-strength 8 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart";

const DEFAULT_NVENC_ARGUMENTS = (preset: number) =>
  DEFAULT_OPTIMIZED_ARGUMENTS.replace("-preset p3", `-preset p${preset}`);

const LEGACY_NVENC_ARGUMENTS = (preset: number) =>
  LEGACY_DEFAULT_OPTIMIZED_ARGUMENTS.replace("-preset p3", `-preset p${preset}`);

const BUILT_IN_PRESETS = {
  "hevc-nvenc-p1": { argumentsText: DEFAULT_NVENC_ARGUMENTS(1), presetNumber: 1 },
  "hevc-nvenc-p2": { argumentsText: DEFAULT_NVENC_ARGUMENTS(2), presetNumber: 2 },
  "hevc-nvenc-p3": { argumentsText: DEFAULT_NVENC_ARGUMENTS(3), presetNumber: 3 },
  "hevc-nvenc-p4": { argumentsText: DEFAULT_NVENC_ARGUMENTS(4), presetNumber: 4 },
  "hevc-nvenc-p5": { argumentsText: DEFAULT_NVENC_ARGUMENTS(5), presetNumber: 5 },
  "hevc-nvenc-p6": { argumentsText: DEFAULT_NVENC_ARGUMENTS(6), presetNumber: 6 },
  "hevc-nvenc-p7": { argumentsText: DEFAULT_NVENC_ARGUMENTS(7), presetNumber: 7 },
} satisfies Record<string, { argumentsText: string; presetNumber: number }>;

export type BuiltInPresetId = keyof typeof BUILT_IN_PRESETS;

interface BuiltInPreset {
  argumentsText: string;
  customName?: string;
  id: BuiltInPresetId;
  kind: "builtIn";
}

interface CustomPreset {
  argumentsText: string;
  description?: string;
  id: string;
  kind: "custom";
  name: string;
}

type ExportPreset = BuiltInPreset | CustomPreset;

interface ExportPresetState {
  argumentsText: string;
  nextPresetSequence: number;
  presets: ExportPreset[];
  selectedPresetId: string | null;
}

export type PresetNameError = "duplicate" | "required" | "tooLong";

interface PresetNameValidationInput {
  candidateName: string;
  existingNames: string[];
}

const DEFAULT_PRESET_ID: BuiltInPresetId = "hevc-nvenc-p3";

function isBuiltInPresetId(id: string): id is BuiltInPresetId {
  return Object.hasOwn(BUILT_IN_PRESETS, id);
}

const DEFAULT_PRESETS: BuiltInPreset[] = Object.keys(BUILT_IN_PRESETS).map((id) => ({
  id: id as BuiltInPresetId,
  kind: "builtIn",
  argumentsText: BUILT_IN_PRESETS[id as BuiltInPresetId].argumentsText,
}));

export const initialExportPresetState: ExportPresetState = {
  presets: DEFAULT_PRESETS,
  selectedPresetId: DEFAULT_PRESET_ID,
  argumentsText: BUILT_IN_PRESETS[DEFAULT_PRESET_ID].argumentsText,
  nextPresetSequence: 0,
};

function isExportPreset(value: unknown): value is ExportPreset {
  if (typeof value !== "object" || value === null) return false;
  const preset = value as Record<string, unknown>;
  if (typeof preset.id !== "string" || typeof preset.argumentsText !== "string") return false;

  if (preset.kind === "builtIn") {
    return (
      isBuiltInPresetId(preset.id) &&
      (preset.customName === undefined || typeof preset.customName === "string") &&
      !("name" in preset)
    );
  }

  return (
    preset.kind === "custom" &&
    !isBuiltInPresetId(preset.id) &&
    typeof preset.name === "string" &&
    (preset.description === undefined || typeof preset.description === "string")
  );
}

function isExportPresetState(value: unknown): value is ExportPresetState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  return (
    typeof state.argumentsText === "string" &&
    Array.isArray(state.presets) &&
    state.presets.every(isExportPreset) &&
    (state.selectedPresetId === null || typeof state.selectedPresetId === "string") &&
    typeof state.nextPresetSequence === "number" &&
    Number.isFinite(state.nextPresetSequence)
  );
}

function loadExportPresetState(): ExportPresetState {
  const stored = readStoredJson<unknown>(STORAGE_KEYS.exportPresets);
  if (!isExportPresetState(stored)) return initialExportPresetState;

  const presets = stored.presets.map(migrateLegacyNvencPreset);
  const selectedPresetId = presets.some((preset) => preset.id === stored.selectedPresetId)
    ? stored.selectedPresetId
    : (presets[0]?.id ?? null);

  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId);

  return {
    presets,
    selectedPresetId,
    argumentsText: selectedPreset?.argumentsText ?? stored.argumentsText,
    nextPresetSequence: stored.nextPresetSequence,
  };
}

function migrateLegacyNvencPreset(preset: ExportPreset): ExportPreset {
  if (preset.kind !== "builtIn") return preset;
  const presetNumber = BUILT_IN_PRESETS[preset.id].presetNumber;
  if (preset.argumentsText !== LEGACY_NVENC_ARGUMENTS(presetNumber)) return preset;
  return { ...preset, argumentsText: DEFAULT_NVENC_ARGUMENTS(presetNumber) };
}

function persistExportPresetState(state: ExportPresetState): void {
  writeStoredJson(STORAGE_KEYS.exportPresets, state);
}

function getPresetDisplayName(
  preset: ExportPreset,
  localizedBuiltInName: (id: BuiltInPresetId) => string,
): string {
  return preset.kind === "builtIn"
    ? (preset.customName ?? localizedBuiltInName(preset.id))
    : preset.name;
}

function presetNameError({
  candidateName,
  existingNames,
}: PresetNameValidationInput): PresetNameError | null {
  const normalized = candidateName.trim();
  if (!normalized) return "required";
  if (normalized.length > 64) return "tooLong";
  if (
    existingNames.some(
      (name) => name.localeCompare(normalized, undefined, { sensitivity: "accent" }) === 0,
    )
  ) {
    return "duplicate";
  }
  return null;
}

export {
  BUILT_IN_PRESETS,
  getPresetDisplayName,
  isBuiltInPresetId,
  loadExportPresetState,
  persistExportPresetState,
  presetNameError,
};

export type { BuiltInPreset, CustomPreset, ExportPreset, PresetNameValidationInput };
