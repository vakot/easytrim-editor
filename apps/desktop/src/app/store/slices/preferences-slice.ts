import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { DEFAULT_PREFERENCES, type PreferenceKey, type Preferences } from "@/app/preferences";

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
    preferencesReset: (state) => {
      Object.assign(state, DEFAULT_PREFERENCES);
    },
  },
});

export const { preferenceChanged, preferencesReset } = preferencesSlice.actions;
export const preferencesReducer = preferencesSlice.reducer;

export const selectPreferences = (state: RootState): Preferences => state.preferences;
export const selectMergeAudioEnabledDefault = (state: RootState): boolean =>
  selectPreferences(state).mergeAudioEnabledDefault;
export const selectAutoStartQueueEnabled = (state: RootState): boolean =>
  selectPreferences(state).autoStartQueueEnabled;
export const selectDeleteSourceOnRenderFinish = (state: RootState): boolean =>
  selectPreferences(state).deleteSourceOnRenderFinish;
