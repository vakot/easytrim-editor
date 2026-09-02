import {
  cancelActiveExport,
  cancelAllQueuedExports,
  cancelQueuedExport,
  enqueueExport,
  setExportQueueExecutionEnabled,
} from "@/app/store/integration/export-queue-runtime";
import { outputDefaults } from "@/app/store/lib/export-defaults";
import {
  editingInstanceExportAttemptQueued,
  editingInstanceExportHistoryCleared,
  editingInstanceOptimizedSettingsChanged,
  editingInstancesSourceAvailabilityChanged,
  selectActiveEditingInstance,
  selectActiveInstanceId,
  selectEditingInstanceById,
  selectEditingInstanceAttempts,
  selectHasProcessableExports,
} from "@/app/store/slices/editing-instances-slice";
import {
  exportLaunchFailed,
  optimizedExportDialogClosed,
  optimizedExportDialogOpened,
  optimizedExportPlanFailed,
  optimizedExportPlanReceived,
  optimizedExportPlanRequested,
  queueFinishActionsAvailable,
  queuePaused,
  queueStarted,
} from "@/app/store/slices/export-slice";
import { nativeDialogStateChanged } from "@/app/store/slices/import-workflow-slice";
import { selectAudioTracks, selectMasterAudio, selectMergeAudio } from "@/app/store/slices/audio-slice";
import { selectCrop, selectCropApplied, selectCropResolution } from "@/app/store/slices/crop-slice";
import { selectSourceMedia, selectSourceReady, selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import type { ExportRoute, ExportSettings } from "@/domain/editing-instance";
import { createExportAttempt } from "@/domain/editing-instance";
import { createEditorSnapshot } from "@/domain/editor-snapshot";
import { diagnostics } from "@/lib/diagnostics";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";
import { chooseOutputPath, planOptimizedExport, releaseExportSource, reserveExportSource, restoreSourceFromTrash } from "@/lib/tauri/media";
import type { FastExportRequest, OptimizedExportRequest } from "@/lib/tauri/media.types";
import { normalizeAppError } from "@/lib/tauri/media.utils";
import { availableQueueFinishActions } from "@/lib/tauri/queue";

import { navigateToEditingInstance } from "./source-media-thunks";
import type { AppThunk } from "./source-media-thunks";

let optimizedPlanRequestSequence = 0;
let exportAttemptSequence = 0;
let latestExportAddedAt = 0;

function nextTimestamp() {
  latestExportAddedAt = Math.max(Date.now(), latestExportAddedAt + 1);
  return latestExportAddedAt;
}

function nextAttemptId() { return `attempt-${++exportAttemptSequence}`; }

export const loadQueueFinishActions = (): AppThunk => async (dispatch) => {
  try {
    const actions = await availableQueueFinishActions();
    dispatch(queueFinishActionsAvailable(actions.includes("nothing") ? actions : ["nothing"]));
  } catch {
    dispatch(queueFinishActionsAvailable(["exit", "nothing"]));
  }
};

export const startExportQueue = (origin: DiagnosticOrigin = { type: "internal" }): AppThunk =>
  (dispatch, getState) => {
    diagnostics.action("export.queue.start.requested", origin);
    if (!selectHasProcessableExports(getState())) return;
    dispatch(queueStarted());
    setExportQueueExecutionEnabled(true, dispatch, getState);
  };

export const pauseExportQueue = (origin: DiagnosticOrigin = { type: "internal" }): AppThunk =>
  (dispatch, getState) => {
    diagnostics.action("export.queue.pause.requested", origin);
    dispatch(queuePaused());
    setExportQueueExecutionEnabled(false, dispatch, getState);
  };

export const cancelActiveExportRequested = (): AppThunk => (_dispatch, getState) => {
  void cancelActiveExport(getState);
};

export const cancelAllExportsRequested = (): AppThunk => (_dispatch, getState) => {
  void cancelAllQueuedExports(getState);
};

export const cancelExportRequested = (instanceId: string, attemptId: string): AppThunk =>
  (_dispatch, getState) => { void cancelQueuedExport(instanceId, attemptId, getState); };

export const clearExportHistoryRequested = (instanceId?: string): AppThunk => (dispatch) => {
  dispatch(editingInstanceExportHistoryCleared(instanceId));
};

export const openOptimizedExportDialog =
  (origin: DiagnosticOrigin = { id: "optimized", type: "button" }): AppThunk =>
  async (dispatch, getState) => {
    const settings = getInitialSettings(getState());
    if (!settings) return;
    dispatch(optimizedExportDialogOpened());
    await dispatch(refreshOptimizedExportPlan());
    diagnostics.action("export.dialog.opened", origin);
  };

export const optimizedExportSettingsChangedRequested = (settings: ExportSettings): AppThunk =>
  async (dispatch, getState) => {
    const instanceId = selectActiveInstanceId(getState());
    if (!instanceId) return;
    dispatch(editingInstanceOptimizedSettingsChanged({ id: instanceId, settings }));
    await dispatch(refreshOptimizedExportPlan());
  };

export const refreshOptimizedExportPlan = (): AppThunk => async (dispatch, getState) => {
  const request = getOptimizedRequest(getState());
  const instanceId = selectActiveInstanceId(getState());
  if (!request || !instanceId) return;
  const requestId = ++optimizedPlanRequestSequence;
  const sourcePath = request.sourcePath;
  dispatch(optimizedExportPlanRequested({ requestId }));
  try {
    const plan = await planOptimizedExport(request);
    if (selectActiveInstanceId(getState()) === instanceId && currentSourcePath(getState()) === sourcePath) {
      dispatch(optimizedExportPlanReceived({ requestId, commandPreview: plan.commandPreview }));
    }
  } catch (error: unknown) {
    if (selectActiveInstanceId(getState()) === instanceId && currentSourcePath(getState()) === sourcePath) {
      dispatch(optimizedExportPlanFailed({ requestId, error: normalizeAppError(error) }));
    }
  }
};

export const startFastCutRequested =
  (origin: DiagnosticOrigin = { id: "fast-cut", type: "button" }): AppThunk =>
  (dispatch, getState) => {
    if (selectCropApplied(getState())) return;
    void startEditingInstanceExport("fast", dispatch, getState, origin);
  };

export const startOptimizedExportRequested =
  (origin: DiagnosticOrigin = { id: "optimized", type: "button" }): AppThunk =>
  (dispatch, getState) => {
    dispatch(optimizedExportDialogClosed());
    void startEditingInstanceExport("optimized", dispatch, getState, origin);
  };

async function startEditingInstanceExport(
  route: ExportRoute,
  dispatch: Parameters<AppThunk>[0],
  getState: Parameters<AppThunk>[1],
  origin: DiagnosticOrigin,
) {
  const state = getState();
  const instance = selectActiveEditingInstance(state);
  const source = selectSourceSelection(state);
  const media = selectSourceMedia(state);
  const trim = selectTrim(state);
  const request = route === "fast" ? getFastRequest(state) : getOptimizedRequest(state);
  if (!instance || !source || !media || !trim || !request || !selectSourceReady(state)) return;
  if (instance.exportAttempts.some((attempt) => attempt.state.status === "queued" || attempt.state.status === "rendering")) return;

  const snapshot = createEditorSnapshot({
    source,
    trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
    crop: selectCropApplied(state) ? selectCrop(state) : null,
    masterAudio: selectMasterAudio(state),
    audioTracks: selectAudioTracks(state).map(({ enabled, streamIndex, volumePercent }) => ({ enabled, streamIndex, volumePercent })),
    mergeAudio: selectMergeAudio(state),
  });
  const attemptId = nextAttemptId();
  dispatch(nativeDialogStateChanged(true));
  try {
    const output = await chooseOutputPath(outputDefaults(source.displayName)[route]);
    if (!output) return;
    if (selectActiveInstanceId(getState()) !== instance.id || currentSourcePath(getState()) !== source.sourcePath || !selectSourceReady(getState())) return;
    await reserveExportSource(request.sourcePath);
    let released = false;
    const releaseIfNeeded = async () => {
      if (released) return;
      released = true;
      await releaseExportSource(request.sourcePath).catch(() => undefined);
    };
    if (selectActiveInstanceId(getState()) !== instance.id || currentSourcePath(getState()) !== source.sourcePath) {
      await releaseIfNeeded();
      return;
    }
    const attempt = createExportAttempt({
      capturedAt: nextTimestamp(),
      id: attemptId,
      output,
      request: structuredClone(request),
      route,
      snapshot,
      totalFrames: getTotalFrames(request, media.video),
    });
    dispatch(editingInstanceExportAttemptQueued({ id: instance.id, attempt }));
    const current = selectEditingInstanceAttempts(getState()).find(({ attempt: candidate }) => candidate.id === attemptId);
    if (current) enqueueExport(instance.id, current.attempt, dispatch, getState);
    else await releaseIfNeeded();
    void origin;
  } catch (error: unknown) {
    dispatch(exportLaunchFailed(normalizeAppError(error)));
  } finally {
    dispatch(nativeDialogStateChanged(false));
  }
}

function currentSourcePath(state: ReturnType<Parameters<AppThunk>[1]>) { return selectSourceSelection(state)?.sourcePath; }

function getInitialSettings(state: ReturnType<Parameters<AppThunk>[1]>): ExportSettings | null {
  const instance = selectActiveEditingInstance(state);
  if (!instance) return null;
  return instance.optimizedSettings ?? { resolution: selectCropResolution(state), frameRate: undefined };
}

function getFastRequest(state: ReturnType<Parameters<AppThunk>[1]>): FastExportRequest | null {
  const source = selectSourceSelection(state);
  const trim = selectTrim(state);
  if (!source || !trim) return null;
  return { sourcePath: source.sourcePath, trim: { startMicros: trim.startMicros, endMicros: trim.endMicros }, audioTracks: selectedAudioTracks(state), mergeAudio: selectMergeAudio(state) };
}

function getOptimizedRequest(state: ReturnType<Parameters<AppThunk>[1]>): OptimizedExportRequest | null {
  const source = selectSourceSelection(state);
  const trim = selectTrim(state);
  const media = selectSourceMedia(state);
  const settings = getInitialSettings(state);
  if (!source || !trim || !media || !settings) return null;
  return {
    sourcePath: source.sourcePath,
    trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
    audioTracks: selectedAudioTracks(state),
    mergeAudio: selectMergeAudio(state),
    resolution: settings.resolution,
    crop: selectCrop(state),
    frameRate: settings.frameRate ? { numerator: settings.frameRate.numerator, denominator: settings.frameRate.denominator } : undefined,
    arguments: state.exportPresets.argumentsText,
  };
}

function selectedAudioTracks(state: ReturnType<Parameters<AppThunk>[1]>) {
  const master = selectMasterAudio(state);
  const masterGain = master.enabled ? master.volumePercent / 50 : 0;
  return selectAudioTracks(state)
    .filter((track) => track.enabled && track.volumePercent > 0 && masterGain > 0)
    .map((track) => ({ streamIndex: track.streamIndex, volumePercent: Math.min(200, Math.round(track.volumePercent * masterGain)) }))
    .filter((track) => track.volumePercent > 0);
}

function getTotalFrames(request: FastExportRequest | OptimizedExportRequest, video: { averageFrameRate?: { denominator: number; numerator: number }; realFrameRate?: { denominator: number; numerator: number } }) {
  const rate = "frameRate" in request && request.frameRate ? request.frameRate : video.averageFrameRate ?? video.realFrameRate;
  if (!rate || rate.denominator <= 0) return undefined;
  return Math.max(1, Math.round(((request.trim.endMicros - request.trim.startMicros) / 1_000_000) * rate.numerator / rate.denominator));
}

export const restoreEditingInstanceRequested = (id: string): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    if (!selectEditingInstanceById(getState(), id)) return false;
    return dispatch(navigateToEditingInstance(id));
  };

export const restoreEditingInstanceSourceRequested =
  (request: { instanceId?: string; origin?: DiagnosticOrigin; sourcePath: string }): AppThunk<Promise<boolean>> =>
  async (dispatch) => {
    try {
      await restoreSourceFromTrash(request.sourcePath);
      dispatch(editingInstancesSourceAvailabilityChanged({ availability: "available", sourcePath: request.sourcePath }));
      return true;
    } catch {
      return false;
    }
  };
