import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store/store";
import { DEFAULT_TOOL_DEFAULTS, type ToolDefaults } from "@/app/tool-settings";
import { DEFAULT_PLAYBACK_SPEED, type PlaybackSpeed } from "@/domain/playback-speed";

export type EditorToolsState = Pick<
  ToolDefaults,
  "snapPlaybackEnabled" | "loopPlaybackEnabled" | "segmentPlaybackEnabled"
> & {
  playbackSpeed: PlaybackSpeed;
};

const createInitialState = (): EditorToolsState =>
  createEditorToolsStateFromPreferences(DEFAULT_TOOL_DEFAULTS);

export function createEditorToolsStateFromPreferences(defaults: ToolDefaults): EditorToolsState {
  return {
    snapPlaybackEnabled: defaults.snapPlaybackEnabled,
    loopPlaybackEnabled: defaults.loopPlaybackEnabled,
    segmentPlaybackEnabled: defaults.segmentPlaybackEnabled,
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
    loopPlaybackChanged: (state, action: PayloadAction<boolean>) => {
      state.loopPlaybackEnabled = action.payload;
    },
    segmentPlaybackToggled: (state) => {
      state.segmentPlaybackEnabled = !state.segmentPlaybackEnabled;
    },
    segmentPlaybackChanged: (state, action: PayloadAction<boolean>) => {
      state.segmentPlaybackEnabled = action.payload;
    },
    playbackSpeedChanged: (state, action: PayloadAction<PlaybackSpeed>) => {
      state.playbackSpeed = action.payload;
    },
  },
});

export const {
  editorToolsInitialized,
  editorToolsReset,
  snapPlaybackToggled,
  snapPlaybackChanged,
  loopPlaybackToggled,
  loopPlaybackChanged,
  segmentPlaybackToggled,
  segmentPlaybackChanged,
  playbackSpeedChanged,
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
