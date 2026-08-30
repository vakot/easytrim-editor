export interface Preferences {
  autoStartQueueEnabled: boolean;
  deleteSourceOnRenderFinish: boolean;
  loopPlaybackEnabledDefault: boolean;
  mergeAudioEnabledDefault: boolean;
  segmentPlaybackEnabledDefault: boolean;
  snapPlaybackEnabledDefault: boolean;
}

export type PreferenceKey = keyof Preferences;

export const DEFAULT_PREFERENCES: Preferences = {
  snapPlaybackEnabledDefault: true,
  loopPlaybackEnabledDefault: true,
  segmentPlaybackEnabledDefault: true,
  autoStartQueueEnabled: true,
  deleteSourceOnRenderFinish: false,
  mergeAudioEnabledDefault: false,
};
