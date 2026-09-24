import { DEFAULT_LAYOUT_DENSITY, type LayoutDensity } from "@/app/layout/lib/layout-density";
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
  lastSeenChangelogVersion: string | null;
  layoutDensity: LayoutDensity;
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
  layoutDensity: DEFAULT_LAYOUT_DENSITY,
  theme: "system",
  primaryColor: DEFAULT_PRIMARY_COLOR,
  customPrimaryColor: DEFAULT_CUSTOM_PRIMARY_COLOR,
  lastSeenChangelogVersion: null,
};

export type { Preferences };
