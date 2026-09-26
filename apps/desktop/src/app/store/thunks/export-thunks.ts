import {
  cancelAndRequeueExport,
  cancelQueuedExport,
  enqueueExport,
  setExportQueueExecutionEnabled,
} from "@/app/store/integration/export-queue-runtime";
import { outputDefaults } from "@/app/store/lib/export-defaults";
import {
  selectAudioTracks,
  selectMasterAudio,
  selectMergeAudio,
} from "@/app/store/slices/audio-slice";
import {
  selectCrop,
  selectCropApplied,
  selectCropResolution,
  selectFlipHorizontal,
  selectFlipVertical,
  selectRotationDegrees,
  selectTransformApplied,
} from "@/app/store/slices/crop-slice";
import {
  editingInstanceExportAttemptQueued,
  editingInstanceOptimizedSettingsChanged,
  selectActiveEditingInstance,
  selectActiveInstanceId,
  selectEditingInstanceById,
} from "@/app/store/slices/editing-instances-slice";
import {
  exportLaunchFailed,
  optimizedExportDialogClosed,
  optimizedExportDialogOpened,
  optimizedExportPlanFailed,
  optimizedExportPlanReceived,
  optimizedExportPlanRequested,
  queueFinishActionsAvailable,
} from "@/app/store/slices/export-slice";
import { nativeDialogStateChanged } from "@/app/store/slices/import-workflow-slice";
import {
  selectSourceMedia,
  selectSourceReady,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import type { ExportRoute, ExportSettings } from "@/domain/editing-instance";
import { createExportAttempt } from "@/domain/editing-instance";
import { createEditorSnapshot } from "@/domain/editor-snapshot";
import { normalizeTransformForExport } from "@/domain/rotation";
import { normalizeSourceKey } from "@/domain/source";
import { diagnostics } from "@/lib/diagnostics";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";
import {
  chooseOutputPath,
  planOptimizedExport,
  releaseExportSource,
  reserveExportSource,
} from "@/lib/tauri/media";
import type { FastExportRequest, OptimizedExportRequest } from "@/lib/tauri/media.types";
import { normalizeAppError } from "@/lib/tauri/media.utils";
import { availableQueueFinishActions } from "@/lib/tauri/queue";

import type { AppThunk } from "./source-media-thunks";
import { commitActiveEditingInstanceDraft } from "./source-media-thunks";

let optimizedPlanRequestSequence = 0;
let exportAttemptSequence = 0;
let latestExportAddedAt = 0;

function nextTimestamp() {
  latestExportAddedAt = Math.max(Date.now(), latestExportAddedAt + 1);
  return latestExportAddedAt;
}

function nextAttemptId() {
  return `attempt-${++exportAttemptSequence}`;
}

const loadQueueFinishActions = (): AppThunk => async (dispatch) => {
  try {
    const actions = await availableQueueFinishActions();
    dispatch(queueFinishActionsAvailable(actions.includes("nothing") ? actions : ["nothing"]));
  } catch {
    dispatch(queueFinishActionsAvailable(["exit", "nothing"]));
  }
};

const startSourceExportQueue =
  (instanceId: string): AppThunk =>
  (dispatch, getState) => {
    diagnostics.action("export.queue.start.requested", {
      id: `source-list.start.${instanceId}`,
      type: "button",
    });
    setExportQueueExecutionEnabled(true, dispatch, getState, instanceId);
  };

const startExportQueue = (): AppThunk => (dispatch, getState) => {
  setExportQueueExecutionEnabled(true, dispatch, getState);
};

const cancelExportAttemptRequested =
  ({ attemptId, instanceId }: { attemptId: string; instanceId: string }): AppThunk =>
  async (_dispatch, getState) => {
    await cancelQueuedExport(instanceId, attemptId, getState);
  };

const requeueExportAttemptRequested =
  ({ attemptId, instanceId }: { attemptId: string; instanceId: string }): AppThunk =>
  async (_dispatch, getState) => {
    await cancelAndRequeueExport(instanceId, attemptId, getState);
  };

const openOptimizedExportDialog =
  (origin: DiagnosticOrigin = { id: "optimized", type: "button" }): AppThunk =>
  async (dispatch, getState) => {
    const settings = getInitialSettings(getState());
    if (!settings) return;
    dispatch(optimizedExportDialogOpened());
    await dispatch(refreshOptimizedExportPlan());
    diagnostics.action("export.dialog.opened", origin);
  };

const optimizedExportSettingsChangedRequested =
  (settings: ExportSettings): AppThunk =>
  async (dispatch, getState) => {
    const instanceId = selectActiveInstanceId(getState());
    if (!instanceId) return;
    dispatch(editingInstanceOptimizedSettingsChanged({ id: instanceId, settings }));
    await dispatch(refreshOptimizedExportPlan());
  };

const refreshOptimizedExportPlan = (): AppThunk => async (dispatch, getState) => {
  const request = getOptimizedRequest(getState());
  const instanceId = selectActiveInstanceId(getState());
  if (!request || !instanceId) return;
  const requestId = ++optimizedPlanRequestSequence;
  const sourcePath = normalizeSourceKey(request.sourcePath);
  dispatch(optimizedExportPlanRequested({ requestId }));
  try {
    const plan = await planOptimizedExport(request);
    if (
      selectActiveInstanceId(getState()) === instanceId &&
      currentSourceKey(getState()) === sourcePath
    ) {
      dispatch(optimizedExportPlanReceived({ requestId, commandPreview: plan.commandPreview }));
    }
  } catch (error: unknown) {
    if (
      selectActiveInstanceId(getState()) === instanceId &&
      currentSourceKey(getState()) === sourcePath
    ) {
      dispatch(optimizedExportPlanFailed({ requestId, error: normalizeAppError(error) }));
    }
  }
};

const startFastCutRequested =
  (origin: DiagnosticOrigin = { id: "fast-cut", type: "button" }): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    if (selectCropApplied(getState()) || selectTransformApplied(getState())) return;
    await startEditingInstanceExport("fast", dispatch, getState, origin);
  };

const startOptimizedExportRequested =
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
  if (instance.draftAvailable === false || state.importWorkflow.isNativeDialogOpen) return;

  const snapshot = createEditorSnapshot({
    source,
    trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
    crop: selectCropApplied(state) ? selectCrop(state) : null,
    flipHorizontal: selectFlipHorizontal(state),
    flipVertical: selectFlipVertical(state),
    rotation: selectRotationDegrees(state),
    masterAudio: selectMasterAudio(state),
    audioTracks: selectAudioTracks(state).map(({ enabled, streamIndex, volumePercent }) => ({
      enabled,
      streamIndex,
      volumePercent,
    })),
    mergeAudio: selectMergeAudio(state),
  });

  // Persist the working draft at the export boundary, while the attempt keeps
  // its own immutable snapshot for the remainder of the export lifecycle.
  dispatch(commitActiveEditingInstanceDraft());

  const attemptId = nextAttemptId();
  dispatch(nativeDialogStateChanged(true));
  try {
    const output = await chooseOutputPath(outputDefaults(source.displayName)[route]);
    if (!output) return;
    if (
      selectActiveInstanceId(getState()) !== instance.id ||
      currentSourceKey(getState()) !== normalizeSourceKey(source.sourcePath) ||
      !selectSourceReady(getState())
    )
      return;
    await reserveExportSource(request.sourcePath);
    let released = false;
    const releaseIfNeeded = async () => {
      if (released) return;
      released = true;
      await releaseExportSource(request.sourcePath).catch(() => undefined);
    };

    if (
      selectActiveInstanceId(getState()) !== instance.id ||
      currentSourceKey(getState()) !== normalizeSourceKey(source.sourcePath)
    ) {
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
    const current = selectEditingInstanceById(getState(), instance.id)?.exportAttempts.find(
      (candidate) => candidate.id === attemptId,
    );

    if (current) {
      if (!enqueueExport(instance.id, current, dispatch, getState)) await releaseIfNeeded();
    } else await releaseIfNeeded();
    void origin;
  } catch (error: unknown) {
    dispatch(exportLaunchFailed(normalizeAppError(error)));
  } finally {
    dispatch(nativeDialogStateChanged(false));
  }
}

function currentSourceKey(state: ReturnType<Parameters<AppThunk>[1]>) {
  return normalizeSourceKey(selectSourceSelection(state)?.sourcePath ?? "");
}

function getInitialSettings(state: ReturnType<Parameters<AppThunk>[1]>): ExportSettings | null {
  const instance = selectActiveEditingInstance(state);
  if (!instance) return null;
  return (
    instance.optimizedSettings ?? { resolution: selectCropResolution(state), frameRate: undefined }
  );
}

function getFastRequest(state: ReturnType<Parameters<AppThunk>[1]>): FastExportRequest | null {
  const source = selectSourceSelection(state);
  const trim = selectTrim(state);
  if (!source || !trim) return null;
  const transform = exportTransform(state);
  return {
    sourcePath: source.sourcePath,
    trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
    audioTracks: selectedAudioTracks(state),
    mergeAudio: selectMergeAudio(state),
    rotationDegrees: transform.rotationDegrees,
  };
}

function getOptimizedRequest(
  state: ReturnType<Parameters<AppThunk>[1]>,
): OptimizedExportRequest | null {
  const source = selectSourceSelection(state);
  const trim = selectTrim(state);
  const media = selectSourceMedia(state);
  const settings = getInitialSettings(state);
  if (!source || !trim || !media || !settings) return null;
  const transform = exportTransform(state);
  return {
    sourcePath: source.sourcePath,
    trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
    audioTracks: selectedAudioTracks(state),
    mergeAudio: selectMergeAudio(state),
    rotationDegrees: transform.rotationDegrees,
    resolution: settings.resolution,
    crop: selectCropApplied(state) ? transform.crop : undefined,
    flipHorizontal: transform.flipHorizontal,
    flipVertical: transform.flipVertical,
    frameRate: settings.frameRate
      ? { numerator: settings.frameRate.numerator, denominator: settings.frameRate.denominator }
      : undefined,
    arguments: state.exportPresets.argumentsText,
  };
}

function exportTransform(state: ReturnType<Parameters<AppThunk>[1]>) {
  return normalizeTransformForExport(
    selectCrop(state),
    selectRotationDegrees(state),
    selectFlipHorizontal(state),
    selectFlipVertical(state),
  );
}

function selectedAudioTracks(state: ReturnType<Parameters<AppThunk>[1]>) {
  const master = selectMasterAudio(state);
  const masterGain = master.enabled ? master.volumePercent / 50 : 0;
  return selectAudioTracks(state)
    .filter((track) => track.enabled && track.volumePercent > 0 && masterGain > 0)
    .map((track) => ({
      streamIndex: track.streamIndex,
      volumePercent: Math.min(200, Math.round(track.volumePercent * masterGain)),
    }))
    .filter((track) => track.volumePercent > 0);
}

function getTotalFrames(
  request: FastExportRequest | OptimizedExportRequest,
  video: {
    averageFrameRate?: { denominator: number; numerator: number };
    realFrameRate?: { denominator: number; numerator: number };
  },
) {
  const rate =
    "frameRate" in request && request.frameRate
      ? request.frameRate
      : (video.averageFrameRate ?? video.realFrameRate);

  if (!rate || rate.denominator <= 0) return undefined;
  return Math.max(
    1,
    Math.round(
      (((request.trim.endMicros - request.trim.startMicros) / 1_000_000) * rate.numerator) /
        rate.denominator,
    ),
  );
}

export {
  cancelExportAttemptRequested,
  loadQueueFinishActions,
  openOptimizedExportDialog,
  optimizedExportSettingsChangedRequested,
  refreshOptimizedExportPlan,
  requeueExportAttemptRequested,
  startExportQueue,
  startFastCutRequested,
  startOptimizedExportRequested,
  startSourceExportQueue,
};
