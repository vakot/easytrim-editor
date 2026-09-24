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
      const lastSeenChangelogVersion = state.lastSeenChangelogVersion;
      Object.assign(state, DEFAULT_PREFERENCES);
      state.lastSeenChangelogVersion = lastSeenChangelogVersion;
    },
  },
});

const {
  activityFeedViewChanged,
  changelogVersionSeen,
  customPrimaryColorChanged,
  layoutDensityChanged,
  preferenceChanged,
  preferencesReset,
  primaryColorChanged,
  themePreferenceChanged,
} = preferencesSlice.actions;

const preferencesReducer = preferencesSlice.reducer;

const selectPreferences = (state: RootState): Preferences => state.preferences;
const selectMergeAudioEnabledDefault = (state: RootState): boolean =>
  selectPreferences(state).mergeAudioEnabledDefault;

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
  selectMergeAudioEnabledDefault,
  selectPreferences,
  selectPrimaryColor,
  selectPrimaryColorKey,
  selectThemePreference,
  themePreferenceChanged,
};
