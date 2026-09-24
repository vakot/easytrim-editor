import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  DEFAULT_LAYOUT_DENSITY,
  isLayoutDensity,
  type LayoutDensity,
} from "@/app/layout/lib/layout-density";
import {
  type ActivityFeedView,
  DEFAULT_PREFERENCES,
  type PreferenceKey,
  type Preferences,
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
    activityFeedViewChanged: (state, action: PayloadAction<ActivityFeedView>) => {
      state.activityFeedView = action.payload;
    },
    layoutDensityChanged: (state, action: PayloadAction<LayoutDensity>) => {
      state.layoutDensity = action.payload;
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
  preferenceChanged,
  preferencesReset,
  primaryColorChanged,
  themePreferenceChanged,
  viewSettingsReset,
} = preferencesSlice.actions;

const preferencesReducer = preferencesSlice.reducer;

const selectPreferences = (state: RootState): Preferences => state.preferences;
const selectMergeAudioEnabledDefault = (state: RootState): boolean =>
  selectPreferences(state).mergeAudioEnabledDefault;

const selectSnapPlaybackEnabledDefault = (state: RootState): boolean =>
  selectPreferences(state).snapPlaybackEnabledDefault;

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
  selectPreferences,
  selectPrimaryColor,
  selectPrimaryColorKey,
  selectSegmentPlaybackEnabledDefault,
  selectSnapPlaybackEnabledDefault,
  selectThemePreference,
  themePreferenceChanged,
  viewSettingsReset,
};
