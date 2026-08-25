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
