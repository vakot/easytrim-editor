import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { DEFAULT_PREFERENCES, type Preferences } from "@/app/preferences";
import type { RootState } from "@/app/store/store";

type EditorToolsState = {
  loopPlaybackEnabled: boolean;
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
  },
});

const {
  editorToolsInitialized,
  editorToolsReset,
  loopPlaybackToggled,
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

export {
  createEditorToolsStateFromPreferences,
  editorToolsInitialized,
  editorToolsReducer,
  editorToolsReset,
  loopPlaybackToggled,
  segmentPlaybackToggled,
  selectEditorTools,
  selectLoopPlaybackEnabled,
  selectSegmentPlaybackEnabled,
  selectSnapPlaybackEnabled,
  snapPlaybackChanged,
  snapPlaybackToggled,
};
