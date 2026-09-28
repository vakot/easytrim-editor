import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { DEFAULT_PREFERENCES, type Preferences } from "@/app/preferences";
import type { RootState } from "@/app/store/store";

type EditorToolsState = {
  loopPlaybackEnabled: boolean;
  sceneDetection?: {
    error: string | null;
    sourceKey: string;
    status: "failed" | "loading";
  };
  sceneMarkersEnabled?: boolean;
  segmentPlaybackEnabled: boolean;
};

const createInitialState = (): EditorToolsState =>
  createEditorToolsStateFromPreferences(DEFAULT_PREFERENCES);

function createEditorToolsStateFromPreferences(defaults: Preferences): EditorToolsState {
  return {
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
    loopPlaybackToggled: (state) => {
      state.loopPlaybackEnabled = !state.loopPlaybackEnabled;
    },
    segmentPlaybackToggled: (state) => {
      state.segmentPlaybackEnabled = !state.segmentPlaybackEnabled;
    },
    sceneMarkersToggled: (state) => {
      state.sceneMarkersEnabled = !(state.sceneMarkersEnabled ?? true);
    },
    sceneDetectionStarted: (state, action: PayloadAction<string>) => {
      state.sceneDetection = {
        error: null,
        sourceKey: action.payload,
        status: "loading",
      };
    },
    sceneDetectionFailed: (
      state,
      action: PayloadAction<{ error: string | null; sourceKey: string }>,
    ) => {
      state.sceneDetection = { ...action.payload, status: "failed" };
    },
    sceneDetectionFinished: (state, action: PayloadAction<string>) => {
      if (state.sceneDetection?.sourceKey === action.payload) delete state.sceneDetection;
    },
  },
});

const {
  editorToolsInitialized,
  editorToolsReset,
  loopPlaybackToggled,
  sceneDetectionFailed,
  sceneDetectionFinished,
  sceneDetectionStarted,
  sceneMarkersToggled,
  segmentPlaybackToggled,
} = editorToolsSlice.actions;

const editorToolsReducer = editorToolsSlice.reducer;

const selectEditorTools = (state: RootState): EditorToolsState => state.editorTools;
const selectLoopPlaybackEnabled = (state: RootState): boolean =>
  selectEditorTools(state).loopPlaybackEnabled;

const selectSegmentPlaybackEnabled = (state: RootState): boolean =>
  selectEditorTools(state).segmentPlaybackEnabled;

const selectSceneMarkersEnabled = (state: RootState): boolean =>
  selectEditorTools(state).sceneMarkersEnabled ?? true;

const selectSceneDetectionOperation = (state: RootState): EditorToolsState["sceneDetection"] =>
  selectEditorTools(state).sceneDetection;

export {
  createEditorToolsStateFromPreferences,
  editorToolsInitialized,
  editorToolsReducer,
  editorToolsReset,
  loopPlaybackToggled,
  sceneDetectionFailed,
  sceneDetectionFinished,
  sceneDetectionStarted,
  sceneMarkersToggled,
  segmentPlaybackToggled,
  selectEditorTools,
  selectLoopPlaybackEnabled,
  selectSceneDetectionOperation,
  selectSceneMarkersEnabled,
  selectSegmentPlaybackEnabled,
};
