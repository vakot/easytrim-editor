export interface Preferences {
  snapPlaybackEnabledDefault: boolean;
  loopPlaybackEnabledDefault: boolean;
  segmentPlaybackEnabledDefault: boolean;
  autoStartQueueEnabled: boolean;
  mergeAudioEnabledDefault: boolean;
}

export type PreferenceKey = keyof Preferences;

export const DEFAULT_PREFERENCES: Preferences = {
  snapPlaybackEnabledDefault: true,
  loopPlaybackEnabledDefault: true,
  segmentPlaybackEnabledDefault: true,
  autoStartQueueEnabled: true,
  mergeAudioEnabledDefault: false,
};
