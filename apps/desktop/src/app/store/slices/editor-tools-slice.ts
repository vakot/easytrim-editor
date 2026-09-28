import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { DEFAULT_PREFERENCES, type Preferences } from "@/app/preferences";
import type { RootState } from "@/app/store/store";
import type { SilenceRange } from "@/lib/tauri/media.types";

type EditorToolsState = {
  loopPlaybackEnabled: boolean;
  sceneDetection?: {
    error: string | null;
    sourceKey: string;
    status: "failed" | "loading";
  };
  sceneMarkersEnabled?: boolean;
  segmentPlaybackEnabled: boolean;
  silenceDetection?: {
    error: string | null;
    mixKey: string;
    ranges?: SilenceRange[];
    sourceKey: string;
    status: "failed" | "loading" | "ready";
  };
  silenceMarkersEnabled?: boolean;
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
    silenceMarkersToggled: (state) => {
      state.silenceMarkersEnabled = !(state.silenceMarkersEnabled ?? true);
    },
    silenceDetectionStarted: (
      state,
      action: PayloadAction<{ mixKey: string; sourceKey: string }>,
    ) => {
      state.silenceDetection = { ...action.payload, error: null, status: "loading" };
    },
    silenceDetectionFailed: (
      state,
      action: PayloadAction<{ error: string | null; mixKey: string; sourceKey: string }>,
    ) => {
      state.silenceDetection = { ...action.payload, status: "failed" };
    },
    silenceDetectionFinished: (
      state,
      action: PayloadAction<{ mixKey: string; ranges: SilenceRange[]; sourceKey: string }>,
    ) => {
      state.silenceDetection = { ...action.payload, error: null, status: "ready" };
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
  silenceDetectionFailed,
  silenceDetectionFinished,
  silenceDetectionStarted,
  silenceMarkersToggled,
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

const selectSilenceDetectionOperation = (state: RootState): EditorToolsState["silenceDetection"] =>
  selectEditorTools(state).silenceDetection;

const selectSilenceMarkersEnabled = (state: RootState): boolean =>
  selectEditorTools(state).silenceMarkersEnabled ?? true;

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
  selectSilenceDetectionOperation,
  selectSilenceMarkersEnabled,
  silenceDetectionFailed,
  silenceDetectionFinished,
  silenceDetectionStarted,
  silenceMarkersToggled,
};
