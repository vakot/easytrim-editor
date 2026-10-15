import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  selectActiveEditingInstance,
  selectActiveSceneBoundariesMicros,
} from "@/app/store/slices/editing-instances-slice";
import { selectSourceLoadToken, selectSourceSelection } from "@/app/store/slices/source-slice";
import type { RootState } from "@/app/store/store";
import type { EditingInstanceId } from "@/domain/editing-instance";
import type { AppError } from "@/domain/media";
import { normalizeSourceKey } from "@/domain/source";

type SceneDetectionOperation = {
  error: AppError | null;
  instanceId: EditingInstanceId;
  loadToken: number;
  operationId: string;
  status: "failed" | "loading";
};

type SceneDetectionState = {
  markersVisible: boolean;
  operation: SceneDetectionOperation | null;
};

type SceneDetectionStatus =
  | { error: AppError | null; status: "failed"; }
  | { status: "idle" | "loading" | "ready" | "unavailable" };

const initialState: SceneDetectionState = {
  markersVisible: true,
  operation: null,
};

const sceneDetectionSlice = createSlice({
  name: "sceneDetection",
  initialState,
  reducers: {
    sceneDetectionStarted: (
      state,
      action: PayloadAction<{
        instanceId: EditingInstanceId;
        loadToken: number;
        operationId: string;
      }>,
    ) => {
      state.operation = { ...action.payload, error: null, status: "loading" };
    },
    sceneDetectionFinished: (state, action: PayloadAction<{ operationId: string }>) => {
      if (state.operation?.operationId === action.payload.operationId) state.operation = null;
    },
    sceneDetectionFailed: (
      state,
      action: PayloadAction<{ error: AppError | null; operationId: string }>,
    ) => {
      if (state.operation?.operationId !== action.payload.operationId) return;
      state.operation.error = action.payload.error;
      state.operation.status = "failed";
    },
    sceneMarkersToggled: (state) => {
      state.markersVisible = !state.markersVisible;
    },
  },
});

const { sceneDetectionFailed, sceneDetectionFinished, sceneDetectionStarted, sceneMarkersToggled } =
  sceneDetectionSlice.actions;

const sceneDetectionReducer = sceneDetectionSlice.reducer;

const NO_SCENE_BOUNDARIES: number[] = [];

const selectSceneDetectionOperation = (state: RootState): SceneDetectionOperation | null =>
  state.sceneDetection.operation;

const selectSceneMarkersVisible = (state: RootState): boolean =>
  state.sceneDetection.markersVisible;

/** Detection progress for the active instance; operations from another instance or load are stale. */
const selectSceneDetectionStatus = createSelector(
  [
    selectSceneDetectionOperation,
    selectActiveEditingInstance,
    selectSourceSelection,
    selectSourceLoadToken,
  ],
  (operation, instance, source, loadToken): SceneDetectionStatus => {
    if (
      !instance ||
      !source ||
      normalizeSourceKey(instance.snapshot.source.sourcePath) !==
        normalizeSourceKey(source.sourcePath)
    ) {
      return { status: "unavailable" };
    }
    if (operation?.instanceId === instance.id && operation.loadToken === loadToken) {
      return operation.status === "failed"
        ? { error: operation.error, status: "failed" }
        : { status: "loading" };
    }
    return instance.snapshot.sceneBoundariesMicros === undefined
      ? { status: "idle" }
      : { status: "ready" };
  },
);

const selectVisibleSceneBoundariesMicros = createSelector(
  [selectSceneMarkersVisible, selectActiveSceneBoundariesMicros],
  (visible, boundariesMicros) => (visible ? boundariesMicros : NO_SCENE_BOUNDARIES),
);

export {
  sceneDetectionFailed,
  sceneDetectionFinished,
  sceneDetectionReducer,
  sceneDetectionStarted,
  sceneMarkersToggled,
  selectSceneDetectionOperation,
  selectSceneDetectionStatus,
  selectSceneMarkersVisible,
  selectVisibleSceneBoundariesMicros,
};
