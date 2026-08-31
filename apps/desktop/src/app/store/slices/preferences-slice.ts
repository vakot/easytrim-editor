import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  type ActivityFeedView,
  DEFAULT_PREFERENCES,
  type PreferenceKey,
  type Preferences,
} from "@/app/preferences";

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
    preferencesReset: (state) => {
      Object.assign(state, DEFAULT_PREFERENCES);
    },
  },
});

export const { activityFeedViewChanged, preferenceChanged, preferencesReset } =
  preferencesSlice.actions;
export const preferencesReducer = preferencesSlice.reducer;

export const selectPreferences = (state: RootState): Preferences => state.preferences;
export const selectMergeAudioEnabledDefault = (state: RootState): boolean =>
  selectPreferences(state).mergeAudioEnabledDefault;
export const selectAutoStartQueueEnabled = (state: RootState): boolean =>
  selectPreferences(state).autoStartQueueEnabled;
export const selectDeleteSourceOnRenderFinish = (state: RootState): boolean =>
  selectPreferences(state).deleteSourceOnRenderFinish;
export const selectActivityFeedView = (state: RootState): ActivityFeedView => {
  const activityFeedView = selectPreferences(state).activityFeedView;
  return activityFeedView === "compact" ? "compact" : "default";
};
