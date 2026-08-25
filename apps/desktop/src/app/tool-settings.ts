export interface ToolDefaults {
  snapPlaybackEnabled: boolean;
  loopPlaybackEnabled: boolean;
  segmentPlaybackEnabled: boolean;
  autoStartQueueEnabled: boolean;
  mergeAudioEnabled: boolean;
}

export type ToolDefaultKey = keyof ToolDefaults;

export const DEFAULT_TOOL_DEFAULTS: ToolDefaults = {
  snapPlaybackEnabled: true,
  loopPlaybackEnabled: true,
  segmentPlaybackEnabled: true,
  autoStartQueueEnabled: true,
  mergeAudioEnabled: false,
};
