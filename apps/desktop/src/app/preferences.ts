import { DEFAULT_LAYOUT_DENSITY, type LayoutDensity } from "@/app/layout/lib/layout-density";
import { DEFAULT_PRIMARY_COLOR, type PrimaryColor, type ThemePreference } from "@/app/theme/theme";

export type ActivityFeedView = "default" | "compact" | "branch";
export const DEFAULT_PLAYBACK_VOLUME_PERCENT = 100;
export const DEFAULT_UI_SCALE_PERCENT = 100;
export const MAX_UI_SCALE_PERCENT = 200;
export const MIN_UI_SCALE_PERCENT = 50;
export const UI_SCALE_STEP_PERCENT = 25;

interface Preferences {
  activityFeedView: ActivityFeedView;
  autoStartQueueEnabled: boolean;
  deleteSourceOnRenderFinish: boolean;
  lastAudiblePlaybackVolumePercent: number;
  lastSeenChangelogVersion: string | null;
  layoutDensity: LayoutDensity;
  loopPlaybackEnabledDefault: boolean;
  mergeAudioEnabledDefault: boolean;
  playbackVolumePercent: number;
  primaryColor: PrimaryColor;
  segmentPlaybackEnabledDefault: boolean;
  theme: ThemePreference;
  uiScalePercent: number;
}

export type PreferenceKey = {
  [Key in keyof Preferences]: Preferences[Key] extends boolean ? Key : never;
}[keyof Preferences];

export const DEFAULT_PREFERENCES: Preferences = {
  activityFeedView: "default",
  loopPlaybackEnabledDefault: true,
  segmentPlaybackEnabledDefault: true,
  autoStartQueueEnabled: true,
  deleteSourceOnRenderFinish: false,
  mergeAudioEnabledDefault: false,
  layoutDensity: DEFAULT_LAYOUT_DENSITY,
  theme: "system",
  uiScalePercent: DEFAULT_UI_SCALE_PERCENT,
  primaryColor: DEFAULT_PRIMARY_COLOR,
  lastAudiblePlaybackVolumePercent: DEFAULT_PLAYBACK_VOLUME_PERCENT,
  playbackVolumePercent: DEFAULT_PLAYBACK_VOLUME_PERCENT,
  lastSeenChangelogVersion: null,
};

export type { Preferences };
