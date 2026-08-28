import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { DEFAULT_PREFERENCES, type PreferenceKey, type Preferences } from "@/app/preferences";

import type { RootState } from "../store";

export type PreferencesState = Preferences;

const createInitialState = (): PreferencesState => ({
  ...DEFAULT_PREFERENCES,
});

const preferencesSlice = createSlice({
  name: "preferences",
  initialState: createInitialState,
  reducers: {
    preferenceChanged: (state, action: PayloadAction<{ key: PreferenceKey; enabled: boolean }>) => {
      state[action.payload.key] = action.payload.enabled;
    },
    preferencesReset: (state) => {
      Object.assign(state, DEFAULT_PREFERENCES);
    },
  },
});

export const { preferenceChanged, preferencesReset } = preferencesSlice.actions;
export const preferencesReducer = preferencesSlice.reducer;

export const selectPreferences = (state: RootState): Preferences => state.preferences;
export const selectSnapPlaybackEnabledDefault = (state: RootState): boolean =>
  selectPreferences(state).snapPlaybackEnabledDefault;
export const selectLoopPlaybackEnabledDefault = (state: RootState): boolean =>
  selectPreferences(state).loopPlaybackEnabledDefault;
export const selectSegmentPlaybackEnabledDefault = (state: RootState): boolean =>
  selectPreferences(state).segmentPlaybackEnabledDefault;
export const selectMergeAudioEnabledDefault = (state: RootState): boolean =>
  selectPreferences(state).mergeAudioEnabledDefault;
export const selectAutoStartQueueEnabled = (state: RootState): boolean =>
  selectPreferences(state).autoStartQueueEnabled;
