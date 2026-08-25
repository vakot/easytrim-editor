import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  DEFAULT_TOOL_DEFAULTS,
  loadToolDefaults,
  type ToolDefaultKey,
  type ToolDefaults,
} from "@/app/tool-settings";
import type { RootState } from "@/app/store";

export interface PreferencesState {
  toolDefaults: ToolDefaults;
}

const createInitialState = (): PreferencesState => ({
  toolDefaults: loadToolDefaults(),
});

const preferencesSlice = createSlice({
  name: "preferences",
  initialState: createInitialState,
  reducers: {
    toolDefaultChanged: (
      state,
      action: PayloadAction<{ key: ToolDefaultKey; enabled: boolean }>,
    ) => {
      state.toolDefaults[action.payload.key] = action.payload.enabled;
    },
    toolDefaultsReset: (state) => {
      state.toolDefaults = { ...DEFAULT_TOOL_DEFAULTS };
    },
  },
});

export const { toolDefaultChanged, toolDefaultsReset } = preferencesSlice.actions;
export const preferencesReducer = preferencesSlice.reducer;

export const selectPreferences = (state: RootState): PreferencesState => state.preferences;
export const selectToolDefaults = (state: RootState): ToolDefaults =>
  selectPreferences(state).toolDefaults;
export const selectSafeTrimFollowingDefault = (state: RootState): boolean =>
  selectToolDefaults(state).safeTrimFollowingEnabled;
export const selectLoopPlaybackDefault = (state: RootState): boolean =>
  selectToolDefaults(state).loopPlaybackEnabled;
export const selectSegmentPlaybackDefault = (state: RootState): boolean =>
  selectToolDefaults(state).segmentPlaybackEnabled;
export const selectMergeAudioDefault = (state: RootState): boolean =>
  selectToolDefaults(state).mergeAudioEnabled;
