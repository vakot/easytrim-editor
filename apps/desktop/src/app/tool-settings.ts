export interface ToolDefaults {
  safeTrimFollowingEnabled: boolean;
  loopPlaybackEnabled: boolean;
  segmentPlaybackEnabled: boolean;
  mergeAudioEnabled: boolean;
}

export type ToolDefaultKey = keyof ToolDefaults;

export const DEFAULT_TOOL_DEFAULTS: ToolDefaults = {
  safeTrimFollowingEnabled: true,
  loopPlaybackEnabled: true,
  segmentPlaybackEnabled: true,
  mergeAudioEnabled: false,
};

interface StoredPreferences {
  toolDefaults?: Partial<Record<ToolDefaultKey, unknown>>;
}

export function loadToolDefaults(): ToolDefaults {
  const stored = readStoredJson<StoredPreferences>(STORAGE_KEYS.preferences)?.toolDefaults;
  return {
    safeTrimFollowingEnabled: readBoolean(
      stored?.safeTrimFollowingEnabled,
      DEFAULT_TOOL_DEFAULTS.safeTrimFollowingEnabled,
    ),
    loopPlaybackEnabled: readBoolean(
      stored?.loopPlaybackEnabled,
      DEFAULT_TOOL_DEFAULTS.loopPlaybackEnabled,
    ),
    segmentPlaybackEnabled: readBoolean(
      stored?.segmentPlaybackEnabled,
      DEFAULT_TOOL_DEFAULTS.segmentPlaybackEnabled,
    ),
    mergeAudioEnabled: readBoolean(
      stored?.mergeAudioEnabled,
      DEFAULT_TOOL_DEFAULTS.mergeAudioEnabled,
    ),
  };
}

export function persistToolDefaults(toolDefaults: ToolDefaults): void {
  const stored = readStoredJson<Record<string, unknown>>(STORAGE_KEYS.preferences) ?? {};
  writeStoredJson(STORAGE_KEYS.preferences, { ...stored, toolDefaults });
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
import { STORAGE_KEYS, readStoredJson, writeStoredJson } from "@/lib/storage";
