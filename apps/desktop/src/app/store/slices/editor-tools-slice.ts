import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { DEFAULT_PREFERENCES, type Preferences } from "@/app/preferences";
import type { RootState } from "@/app/store/store";
import { DEFAULT_PLAYBACK_SPEED, type PlaybackSpeed } from "@/domain/playback-speed";

type EditorToolsState = {
  loopPlaybackEnabled: boolean;
  playbackSpeed: PlaybackSpeed;
  segmentPlaybackEnabled: boolean;
  snapPlaybackEnabled: boolean;
};

const createInitialState = (): EditorToolsState =>
  createEditorToolsStateFromPreferences(DEFAULT_PREFERENCES);

export function createEditorToolsStateFromPreferences(defaults: Preferences): EditorToolsState {
  return {
    snapPlaybackEnabled: defaults.snapPlaybackEnabledDefault,
    loopPlaybackEnabled: defaults.loopPlaybackEnabledDefault,
    segmentPlaybackEnabled: defaults.segmentPlaybackEnabledDefault,
    playbackSpeed: DEFAULT_PLAYBACK_SPEED,
  };
}

const editorToolsSlice = createSlice({
  name: "editorTools",
  initialState: createInitialState,
  reducers: {
    editorToolsInitialized: (_state, action: PayloadAction<EditorToolsState>) => action.payload,
    editorToolsReset: (_state, action: PayloadAction<EditorToolsState>) => action.payload,
    snapPlaybackToggled: (state) => {
      state.snapPlaybackEnabled = !state.snapPlaybackEnabled;
    },
    snapPlaybackChanged: (state, action: PayloadAction<boolean>) => {
      state.snapPlaybackEnabled = action.payload;
    },
    loopPlaybackToggled: (state) => {
      state.loopPlaybackEnabled = !state.loopPlaybackEnabled;
    },
    segmentPlaybackToggled: (state) => {
      state.segmentPlaybackEnabled = !state.segmentPlaybackEnabled;
    },
    playbackSpeedChanged: (state, action: PayloadAction<PlaybackSpeed>) => {
      state.playbackSpeed = action.payload;
    },
  },
});

export const {
  editorToolsInitialized,
  editorToolsReset,
  loopPlaybackToggled,
  playbackSpeedChanged,
  segmentPlaybackToggled,
  snapPlaybackChanged,
  snapPlaybackToggled,
} = editorToolsSlice.actions;
export const editorToolsReducer = editorToolsSlice.reducer;

export const selectEditorTools = (state: RootState): EditorToolsState => state.editorTools;
export const selectSnapPlaybackEnabled = (state: RootState): boolean =>
  selectEditorTools(state).snapPlaybackEnabled;
export const selectLoopPlaybackEnabled = (state: RootState): boolean =>
  selectEditorTools(state).loopPlaybackEnabled;
export const selectSegmentPlaybackEnabled = (state: RootState): boolean =>
  selectEditorTools(state).segmentPlaybackEnabled;
export const selectPlaybackSpeed = (state: RootState): PlaybackSpeed =>
  selectEditorTools(state).playbackSpeed;
