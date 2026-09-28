import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  DEFAULT_LAYOUT_DENSITY,
  isLayoutDensity,
  type LayoutDensity,
} from "@/app/layout/lib/layout-density";
import {
  type ActivityFeedView,
  DEFAULT_PLAYBACK_VOLUME_PERCENT,
  DEFAULT_PREFERENCES,
  DEFAULT_UI_SCALE_PERCENT,
  MAX_UI_SCALE_PERCENT,
  MIN_UI_SCALE_PERCENT,
  type PreferenceKey,
  type Preferences,
  UI_SCALE_STEP_PERCENT,
} from "@/app/preferences";
import { queueSettingsReset } from "@/app/store/actions/queue-actions";
import {
  type CustomPrimaryColor,
  isCustomPrimaryColor,
  type PrimaryColor,
  type PrimaryColorKey,
  type ThemePreference,
} from "@/app/theme/theme";

import type { RootState } from "../store";

type PreferencesState = Preferences;

const createInitialState = (): PreferencesState => ({
  ...DEFAULT_PREFERENCES,
});

const preferencesSlice = createSlice({
  name: "preferences",
  initialState: createInitialState,
  reducers: {
    preferenceChanged: (state, action: PayloadAction<{ enabled: boolean; key: PreferenceKey }>) => {
      state[action.payload.key] = action.payload.enabled;
    },
    playbackVolumeChanged: (state, action: PayloadAction<number>) => {
      const volumePercent = Number.isFinite(action.payload)
        ? Math.max(0, Math.min(100, action.payload))
        : DEFAULT_PLAYBACK_VOLUME_PERCENT;

      state.playbackVolumePercent = volumePercent;
      if (volumePercent > 0) state.lastAudiblePlaybackVolumePercent = volumePercent;
    },
    playbackVolumeToggled: (state) => {
      state.playbackVolumePercent =
        state.playbackVolumePercent > 0 ? 0 : state.lastAudiblePlaybackVolumePercent;
    },
    activityFeedViewChanged: (state, action: PayloadAction<ActivityFeedView>) => {
      state.activityFeedView = action.payload;
    },
    layoutDensityChanged: (state, action: PayloadAction<LayoutDensity>) => {
      state.layoutDensity = action.payload;
    },
    uiScaleIncreased: (state) => {
      state.uiScalePercent = Math.min(
        MAX_UI_SCALE_PERCENT,
        state.uiScalePercent + UI_SCALE_STEP_PERCENT,
      );
    },
    uiScaleDecreased: (state) => {
      state.uiScalePercent = Math.max(
        MIN_UI_SCALE_PERCENT,
        state.uiScalePercent - UI_SCALE_STEP_PERCENT,
      );
    },
    uiScalingReset: (state) => {
      state.uiScalePercent = DEFAULT_UI_SCALE_PERCENT;
    },
    layoutReset: (state) => {
      state.activityFeedView = DEFAULT_PREFERENCES.activityFeedView;
      state.layoutDensity = DEFAULT_PREFERENCES.layoutDensity;
    },
    viewSettingsReset: (state) => {
      state.theme = DEFAULT_PREFERENCES.theme;
      state.primaryColor = DEFAULT_PREFERENCES.primaryColor;
      state.customPrimaryColor = DEFAULT_PREFERENCES.customPrimaryColor;
    },
    themePreferenceChanged: (state, action: PayloadAction<ThemePreference>) => {
      state.theme = action.payload;
    },
    primaryColorChanged: (state, action: PayloadAction<PrimaryColor>) => {
      state.primaryColor = action.payload;
      if (isCustomPrimaryColor(action.payload)) {
        state.customPrimaryColor = action.payload;
      }
    },
    customPrimaryColorChanged: (state, action: PayloadAction<CustomPrimaryColor>) => {
      state.customPrimaryColor = action.payload;
      state.primaryColor = action.payload;
    },
    changelogVersionSeen: (state, action: PayloadAction<string>) => {
      state.lastSeenChangelogVersion = action.payload;
    },
    preferencesReset: (state) => {
      const activityFeedView = state.activityFeedView;
      const layoutDensity = state.layoutDensity;
      const lastSeenChangelogVersion = state.lastSeenChangelogVersion;
      const theme = state.theme;
      const primaryColor = state.primaryColor;
      const customPrimaryColor = state.customPrimaryColor;
      const deleteSourceOnRenderFinish = state.deleteSourceOnRenderFinish;
      Object.assign(state, DEFAULT_PREFERENCES);
      state.activityFeedView = activityFeedView;
      state.layoutDensity = layoutDensity;
      state.lastSeenChangelogVersion = lastSeenChangelogVersion;
      state.theme = theme;
      state.primaryColor = primaryColor;
      state.customPrimaryColor = customPrimaryColor;
      state.deleteSourceOnRenderFinish = deleteSourceOnRenderFinish;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(queueSettingsReset, (state) => {
      state.deleteSourceOnRenderFinish = DEFAULT_PREFERENCES.deleteSourceOnRenderFinish;
    });
  },
});

const {
  activityFeedViewChanged,
  changelogVersionSeen,
  customPrimaryColorChanged,
  layoutDensityChanged,
  layoutReset,
  playbackVolumeChanged,
  playbackVolumeToggled,
  preferenceChanged,
  preferencesReset,
  primaryColorChanged,
  themePreferenceChanged,
  uiScaleDecreased,
  uiScaleIncreased,
  uiScalingReset,
  viewSettingsReset,
} = preferencesSlice.actions;

const preferencesReducer = preferencesSlice.reducer;

const selectPreferences = (state: RootState): Preferences => state.preferences;
const selectPlaybackVolumePercent = (state: RootState): number =>
  selectPreferences(state).playbackVolumePercent;

const selectMergeAudioEnabledDefault = (state: RootState): boolean =>
  selectPreferences(state).mergeAudioEnabledDefault;

const selectLoopPlaybackEnabledDefault = (state: RootState): boolean =>
  selectPreferences(state).loopPlaybackEnabledDefault;

const selectSegmentPlaybackEnabledDefault = (state: RootState): boolean =>
  selectPreferences(state).segmentPlaybackEnabledDefault;

const selectAutoStartQueueEnabled = (state: RootState): boolean =>
  selectPreferences(state).autoStartQueueEnabled;

const selectDeleteSourceOnRenderFinish = (state: RootState): boolean =>
  selectPreferences(state).deleteSourceOnRenderFinish;

const selectActivityFeedView = (state: RootState): ActivityFeedView => {
  const activityFeedView = selectPreferences(state).activityFeedView;
  return activityFeedView === "compact" || activityFeedView === "branch"
    ? activityFeedView
    : "default";
};

const selectLayoutDensity = (state: RootState): LayoutDensity => {
  const layoutDensity = selectPreferences(state).layoutDensity;
  return isLayoutDensity(layoutDensity) ? layoutDensity : DEFAULT_LAYOUT_DENSITY;
};

const selectThemePreference = (state: RootState): ThemePreference => selectPreferences(state).theme;
const selectUiScalePercent = (state: RootState): number => {
  const uiScalePercent = selectPreferences(state).uiScalePercent;
  return Number.isFinite(uiScalePercent) &&
    uiScalePercent >= MIN_UI_SCALE_PERCENT &&
    uiScalePercent <= MAX_UI_SCALE_PERCENT &&
    (uiScalePercent - MIN_UI_SCALE_PERCENT) % UI_SCALE_STEP_PERCENT === 0
    ? uiScalePercent
    : DEFAULT_UI_SCALE_PERCENT;
};

const selectPrimaryColor = (state: RootState): PrimaryColor =>
  selectPreferences(state).primaryColor;

const selectPrimaryColorKey = (state: RootState): PrimaryColorKey => {
  const primaryColor = selectPrimaryColor(state);
  return isCustomPrimaryColor(primaryColor) ? "custom" : primaryColor;
};

const selectCustomPrimaryColor = (state: RootState): CustomPrimaryColor =>
  selectPreferences(state).customPrimaryColor;

const selectLastSeenChangelogVersion = (state: RootState): string | null =>
  selectPreferences(state).lastSeenChangelogVersion;

export {
  activityFeedViewChanged,
  changelogVersionSeen,
  customPrimaryColorChanged,
  layoutDensityChanged,
  layoutReset,
  playbackVolumeChanged,
  playbackVolumeToggled,
  preferenceChanged,
  preferencesReducer,
  preferencesReset,
  primaryColorChanged,
  selectActivityFeedView,
  selectAutoStartQueueEnabled,
  selectCustomPrimaryColor,
  selectDeleteSourceOnRenderFinish,
  selectLastSeenChangelogVersion,
  selectLayoutDensity,
  selectLoopPlaybackEnabledDefault,
  selectMergeAudioEnabledDefault,
  selectPlaybackVolumePercent,
  selectPreferences,
  selectPrimaryColor,
  selectPrimaryColorKey,
  selectSegmentPlaybackEnabledDefault,
  selectThemePreference,
  selectUiScalePercent,
  themePreferenceChanged,
  uiScaleDecreased,
  uiScaleIncreased,
  uiScalingReset,
  viewSettingsReset,
};
