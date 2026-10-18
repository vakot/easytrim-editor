import { combineReducers, type UnknownAction } from "@reduxjs/toolkit";

import { sourceFailed, sourceReady } from "@/app/store/actions/source-actions";
import { achievementsReducer } from "@/app/store/slices/achievements-slice";
import { audioReducer } from "@/app/store/slices/audio-slice";
import { chaptersReducer } from "@/app/store/slices/chapters-slice";
import { cropReducer } from "@/app/store/slices/crop-slice";
import { editingInstancesReducer } from "@/app/store/slices/editing-instances-slice";
import { exportPresetsReducer } from "@/app/store/slices/export-presets-slice";
import { exportReducer } from "@/app/store/slices/export-slice";
import { importWorkflowReducer } from "@/app/store/slices/import-workflow-slice";
import { playbackControlsReducer } from "@/app/store/slices/playback-controls-slice";
import { preferencesReducer } from "@/app/store/slices/preferences-slice";
import { previewReducer } from "@/app/store/slices/preview-slice";
import { sceneDetectionReducer } from "@/app/store/slices/scene-detection-slice";
import { sourceReducer } from "@/app/store/slices/source-slice";
import { trimReducer } from "@/app/store/slices/trim-slice";
import { usageStatisticsReducer } from "@/app/store/slices/usage-statistics-slice";
import { workspaceHistoryReducer } from "@/app/store/slices/workspace-history-slice";

import { workspaceHistoryTransitionCommitted } from "./actions/workspace-history-actions";

const combinedReducer = combineReducers({
  achievements: achievementsReducer,
  audio: audioReducer,
  chapters: chaptersReducer,
  crop: cropReducer,
  editingInstances: editingInstancesReducer,
  export: exportReducer,
  exportPresets: exportPresetsReducer,
  importWorkflow: importWorkflowReducer,
  playbackControls: playbackControlsReducer,
  preferences: preferencesReducer,
  preview: previewReducer,
  sceneDetection: sceneDetectionReducer,
  source: sourceReducer,
  trim: trimReducer,
  usageStatistics: usageStatisticsReducer,
  workspaceHistory: workspaceHistoryReducer,
});

export type RootState = ReturnType<typeof combinedReducer>;

const workspaceReducer = (state: RootState | undefined, action: UnknownAction): RootState => {
  if (state && sourceReady.match(action) && state.source.loadToken !== action.payload.loadToken) {
    return state;
  }
  if (
    state &&
    sourceFailed.match(action) &&
    action.payload.loadToken !== undefined &&
    state.source.loadToken !== action.payload.loadToken
  ) {
    return state;
  }
  if (state && workspaceHistoryTransitionCommitted.match(action)) {
    return action.payload.actions.reduce(workspaceReducer, state);
  }
  return combinedReducer(state, action);
};

export { workspaceReducer };
