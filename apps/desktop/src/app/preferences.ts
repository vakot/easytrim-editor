export type ActivityFeedView = "default" | "compact";

export interface Preferences {
  activityFeedView: ActivityFeedView;
  autoStartQueueEnabled: boolean;
  deleteSourceOnRenderFinish: boolean;
  loopPlaybackEnabledDefault: boolean;
  mergeAudioEnabledDefault: boolean;
  segmentPlaybackEnabledDefault: boolean;
  snapPlaybackEnabledDefault: boolean;
}

export type PreferenceKey = Exclude<keyof Preferences, "activityFeedView">;

export const DEFAULT_PREFERENCES: Preferences = {
  activityFeedView: "default",
  snapPlaybackEnabledDefault: true,
  loopPlaybackEnabledDefault: true,
  segmentPlaybackEnabledDefault: true,
  autoStartQueueEnabled: true,
  deleteSourceOnRenderFinish: false,
  mergeAudioEnabledDefault: false,
};
