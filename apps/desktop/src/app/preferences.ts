import {
  type CustomPrimaryColor,
  DEFAULT_CUSTOM_PRIMARY_COLOR,
  DEFAULT_PRIMARY_COLOR,
  type PrimaryColor,
  type ThemePreference,
} from "@/app/theme/theme";

export type ActivityFeedView = "default" | "compact" | "branch";

interface Preferences {
  activityFeedView: ActivityFeedView;
  autoStartQueueEnabled: boolean;
  customPrimaryColor: CustomPrimaryColor;
  deleteSourceOnRenderFinish: boolean;
  loopPlaybackEnabledDefault: boolean;
  mergeAudioEnabledDefault: boolean;
  primaryColor: PrimaryColor;
  segmentPlaybackEnabledDefault: boolean;
  snapPlaybackEnabledDefault: boolean;
  theme: ThemePreference;
}

export type PreferenceKey = {
  [Key in keyof Preferences]: Preferences[Key] extends boolean ? Key : never;
}[keyof Preferences];

export const DEFAULT_PREFERENCES: Preferences = {
  activityFeedView: "default",
  snapPlaybackEnabledDefault: true,
  loopPlaybackEnabledDefault: true,
  segmentPlaybackEnabledDefault: true,
  autoStartQueueEnabled: true,
  deleteSourceOnRenderFinish: false,
  mergeAudioEnabledDefault: false,
  theme: "system",
  primaryColor: DEFAULT_PRIMARY_COLOR,
  customPrimaryColor: DEFAULT_CUSTOM_PRIMARY_COLOR,
};

export type { Preferences };
