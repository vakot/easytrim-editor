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

function createEditorToolsStateFromPreferences(defaults: Preferences): EditorToolsState {
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

const {
  editorToolsInitialized,
  editorToolsReset,
  loopPlaybackToggled,
  playbackSpeedChanged,
  segmentPlaybackToggled,
  snapPlaybackChanged,
  snapPlaybackToggled,
} = editorToolsSlice.actions;

const editorToolsReducer = editorToolsSlice.reducer;

const selectEditorTools = (state: RootState): EditorToolsState => state.editorTools;
const selectSnapPlaybackEnabled = (state: RootState): boolean =>
  selectEditorTools(state).snapPlaybackEnabled;

const selectLoopPlaybackEnabled = (state: RootState): boolean =>
  selectEditorTools(state).loopPlaybackEnabled;

const selectSegmentPlaybackEnabled = (state: RootState): boolean =>
  selectEditorTools(state).segmentPlaybackEnabled;

const selectPlaybackSpeed = (state: RootState): PlaybackSpeed =>
  selectEditorTools(state).playbackSpeed;

export {
  createEditorToolsStateFromPreferences,
  editorToolsInitialized,
  editorToolsReducer,
  editorToolsReset,
  loopPlaybackToggled,
  playbackSpeedChanged,
  segmentPlaybackToggled,
  selectEditorTools,
  selectLoopPlaybackEnabled,
  selectPlaybackSpeed,
  selectSegmentPlaybackEnabled,
  selectSnapPlaybackEnabled,
  snapPlaybackChanged,
  snapPlaybackToggled,
};
