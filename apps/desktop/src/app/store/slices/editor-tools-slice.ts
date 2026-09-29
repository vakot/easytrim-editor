import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { DEFAULT_PREFERENCES, type Preferences } from "@/app/preferences";
import type { RootState } from "@/app/store/store";
import type { AudioActivityRange } from "@/domain/media";

type EditorToolsState = {
  audioActivityDetection?: {
    error: string | null;
    mixKey: string;
    ranges?: AudioActivityRange[];
    sourceKey: string;
    status: "failed" | "loading" | "ready";
  };
  audioActivityMarkersEnabled?: boolean;
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
    audioActivityMarkersToggled: (state) => {
      state.audioActivityMarkersEnabled = !(state.audioActivityMarkersEnabled ?? true);
    },
    audioActivityDetectionStarted: (
      state,
      action: PayloadAction<{ mixKey: string; sourceKey: string }>,
    ) => {
      state.audioActivityDetection = { ...action.payload, error: null, status: "loading" };
    },
    audioActivityDetectionFailed: (
      state,
      action: PayloadAction<{ error: string | null; mixKey: string; sourceKey: string }>,
    ) => {
      state.audioActivityDetection = { ...action.payload, status: "failed" };
    },
    audioActivityDetectionFinished: (
      state,
      action: PayloadAction<{ mixKey: string; ranges: AudioActivityRange[]; sourceKey: string }>,
    ) => {
      state.audioActivityDetection = { ...action.payload, error: null, status: "ready" };
    },
  },
});

const {
  audioActivityDetectionFailed,
  audioActivityDetectionFinished,
  audioActivityDetectionStarted,
  audioActivityMarkersToggled,
  editorToolsInitialized,
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

const selectAudioActivityDetectionOperation = (
  state: RootState,
): EditorToolsState["audioActivityDetection"] => selectEditorTools(state).audioActivityDetection;

const selectAudioActivityMarkersEnabled = (state: RootState): boolean =>
  selectEditorTools(state).audioActivityMarkersEnabled ?? true;

export {
  audioActivityDetectionFailed,
  audioActivityDetectionFinished,
  audioActivityDetectionStarted,
  audioActivityMarkersToggled,
  createEditorToolsStateFromPreferences,
  editorToolsInitialized,
  editorToolsReducer,
  loopPlaybackToggled,
  sceneDetectionFailed,
  sceneDetectionFinished,
  sceneDetectionStarted,
  sceneMarkersToggled,
  segmentPlaybackToggled,
  selectAudioActivityDetectionOperation,
  selectAudioActivityMarkersEnabled,
  selectEditorTools,
  selectLoopPlaybackEnabled,
  selectSceneDetectionOperation,
  selectSceneMarkersEnabled,
  selectSegmentPlaybackEnabled,
};
