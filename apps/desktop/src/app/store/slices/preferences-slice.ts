import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { type RootState } from "../store";
import { DEFAULT_TOOL_DEFAULTS, type ToolDefaultKey, type ToolDefaults } from "@/app/tool-settings";

export interface PreferencesState {
  toolDefaults: ToolDefaults;
}

const createInitialState = (): PreferencesState => ({
  toolDefaults: { ...DEFAULT_TOOL_DEFAULTS },
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

export const selectToolDefaults = (state: RootState): ToolDefaults =>
  state.preferences.toolDefaults;
export const selectSnapPlaybackDefault = (state: RootState): boolean =>
  selectToolDefaults(state).snapPlaybackEnabled;
export const selectLoopPlaybackDefault = (state: RootState): boolean =>
  selectToolDefaults(state).loopPlaybackEnabled;
export const selectSegmentPlaybackDefault = (state: RootState): boolean =>
  selectToolDefaults(state).segmentPlaybackEnabled;
export const selectMergeAudioDefault = (state: RootState): boolean =>
  selectToolDefaults(state).mergeAudioEnabled;
export const selectAutoStartQueueEnabled = (state: RootState): boolean =>
  selectToolDefaults(state).autoStartQueueEnabled;
