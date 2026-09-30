import { toast } from "sonner";

import {
  cancelAndRequeueExport,
  cancelQueuedExport,
  commitQueuedExportEdit,
  enqueueExport,
  releaseQueuedExportEdit,
  reserveQueuedExportEdit,
  retryFailedExport,
  setExportQueueExecutionEnabled,
} from "@/app/store/integration/export-queue-runtime";
import { outputDefaults } from "@/app/store/lib/export-defaults";
import { selectAudioTracks, selectMergeAudio } from "@/app/store/slices/audio-slice";
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
  queueEditFinished,
  queueEditStarted,
  queueFinishActionsAvailable,
  selectQueueEdit,
} from "@/app/store/slices/export-slice";
import { nativeDialogStateChanged } from "@/app/store/slices/import-workflow-slice";
import {
  selectSourceMedia,
  selectSourceReady,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { selectedAudioTracks } from "@/domain/audio-export";
import { audioTrackLoudnessInputsKey } from "@/domain/audio-processing";
import type { ExportRoute, ExportSettings } from "@/domain/editing-instance";
import { createExportAttempt } from "@/domain/editing-instance";
import type { EditorSnapshot } from "@/domain/editor-snapshot";
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

import { analyzeTrackLoudness } from "./audio-track-thunks";
import type { AppThunk } from "./source-media-thunks";
import {
  activateEditingInstanceRequested,
  commitActiveEditingInstanceDraft,
} from "./source-media-thunks";

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

const retryExportAttemptRequested =
  ({ attemptId, instanceId }: { attemptId: string; instanceId: string }): AppThunk =>
  async (dispatch, getState) => {
    const attempt = selectEditingInstanceById(getState(), instanceId)?.exportAttempts.find(
      (candidate) => candidate.id === attemptId,
    );

    if (attempt?.state.status === "failed") {
      const instance = selectEditingInstanceById(getState(), instanceId);
      if (!instance) return;
      if (!instance.media) {
        if (!(await dispatch(activateEditingInstanceRequested(instance)))) return;
      }
      await retryFailedExport(instanceId, attemptId, dispatch, getState);
    } else {
      await cancelAndRequeueExport(instanceId, attemptId, getState);
    }
  };

const editExportAttemptRequested =
  ({ attemptId, instanceId }: { attemptId: string; instanceId: string }): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    if (getState().importWorkflow.isNativeDialogOpen) return;
    if (!reserveQueuedExportEdit(instanceId, attemptId, dispatch, getState)) return;
    try {
      const instance = selectEditingInstanceById(getState(), instanceId);
      const attempt = instance?.exportAttempts.find((candidate) => candidate.id === attemptId);
      if (!instance || !attempt || attempt.state.status !== "queued") return;

      if (attempt.route === "fast") {
        dispatch(queueEditStarted({ attemptId, instanceId, route: "fast" }));
        await finishQueuedExportEdit(dispatch, getState);
        return;
      }

      if (instance.draftAvailable === false || instance.sourceAvailability !== "available") return;
      dispatch(commitActiveEditingInstanceDraft());
      const optimizedRequest = attempt.request as OptimizedExportRequest;
      dispatch(
        editingInstanceOptimizedSettingsChanged({
          id: instanceId,
          settings: {
            frameRate: optimizedRequest.frameRate,
            resolution: optimizedRequest.resolution,
          },
        }),
      );
      const currentInstance = selectEditingInstanceById(getState(), instanceId);
      if (!currentInstance) return;
      const restored = await dispatch(
        activateEditingInstanceRequested({
          ...currentInstance,
          optimizedArguments: optimizedRequest.arguments,
          snapshot: attempt.snapshot,
        }),
      );

      if (!restored) return;
      dispatch(queueEditStarted({ attemptId, instanceId, route: "optimized" }));
      dispatch(optimizedExportDialogOpened());
      await dispatch(refreshOptimizedExportPlan());
    } catch (error: unknown) {
      const normalized = normalizeAppError(error);
      diagnostics.error("export.queue.edit.failed", normalized, { snapshotId: instanceId });
      toast.error(normalized.message);
    } finally {
      if (selectQueueEdit(getState())?.attemptId !== attemptId) {
        releaseQueuedExportEdit(attemptId, dispatch, getState);
      }
    }
  };

const cancelQueuedExportEditRequested = (): AppThunk => (dispatch, getState) => {
  const queueEdit = selectQueueEdit(getState());
  if (!queueEdit) return;
  dispatch(optimizedExportDialogClosed());
  dispatch(queueEditFinished());
  releaseQueuedExportEdit(queueEdit.attemptId, dispatch, getState);
};

async function finishQueuedExportEdit(
  dispatch: Parameters<AppThunk>[0],
  getState: Parameters<AppThunk>[1],
) {
  const queueEdit = selectQueueEdit(getState());
  if (!queueEdit) return;
  const { attemptId, instanceId, route } = queueEdit;
  const attempt = selectEditingInstanceById(getState(), instanceId)?.exportAttempts.find(
    (candidate) => candidate.id === attemptId,
  );

  if (!attempt || attempt.state.status !== "queued") {
    dispatch(cancelQueuedExportEditRequested());
    return;
  }

  dispatch(optimizedExportDialogClosed());
  dispatch(nativeDialogStateChanged(true));
  try {
    const output = await chooseOutputPath(attempt.output.displayName);
    if (!output) return;

    let request = attempt.request;
    let snapshot: EditorSnapshot = attempt.snapshot;
    if (route === "optimized") {
      if (selectActiveInstanceId(getState()) !== instanceId || !selectSourceReady(getState()))
        return;
      const updatedRequest = getOptimizedRequest(getState());
      const updatedSnapshot = getCurrentExportSnapshot(getState());
      if (!updatedRequest || !updatedSnapshot) return;
      if (
        normalizeSourceKey(updatedRequest.sourcePath) !==
        normalizeSourceKey(attempt.request.sourcePath)
      )
        return;
      snapshot = updatedSnapshot;
      request = updatedRequest;
    }

    commitQueuedExportEdit(instanceId, attemptId, output, request, snapshot, dispatch, getState);
  } catch (error: unknown) {
    const normalized = normalizeAppError(error);
    diagnostics.error("export.queue.edit.failed", normalized, { snapshotId: instanceId });
    toast.error(normalized.message);
  } finally {
    dispatch(nativeDialogStateChanged(false));
    dispatch(queueEditFinished());
    releaseQueuedExportEdit(attemptId, dispatch, getState);
  }
}

const openOptimizedExportDialog =
  (origin: DiagnosticOrigin = { id: "optimized", type: "button" }): AppThunk =>
  async (dispatch, getState) => {
    const settings = getInitialSettings(getState());
    if (!settings) return;
    dispatch(optimizedExportDialogOpened());
    await dispatch(refreshOptimizedExportPlan());
    diagnostics.action("export.dialog.opened", origin);
  };

const cancelOptimizedExportDialogRequested = (): AppThunk => (dispatch, getState) => {
  if (selectQueueEdit(getState())) {
    dispatch(cancelQueuedExportEditRequested());
  } else {
    dispatch(optimizedExportDialogClosed());
  }
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
  const initialState = getState();
  const initialInstance = selectActiveEditingInstance(initialState);
  const initialSource = selectSourceSelection(initialState);
  if (!initialInstance || !initialSource || !selectSourceReady(initialState)) return;
  const requestId = ++optimizedPlanRequestSequence;
  dispatch(optimizedExportPlanRequested({ requestId }));
  const analysis = await ensureLoudnessAnalysis(dispatch, getState, {
    instanceId: initialInstance.id,
    loadToken: initialState.source.loadToken,
    sourcePath: initialSource.sourcePath,
  });

  if (analysis.status === "failed") {
    dispatch(
      optimizedExportPlanFailed({
        requestId,
        error: {
          code: "loudness_analysis_required",
          message: "Analyze track loudness to continue.",
        },
      }),
    );
    return;
  }
  if (analysis.status !== "ready") return;
  const request = getOptimizedRequest(analysis.state);
  if (!request) return;
  const sourcePath = normalizeSourceKey(request.sourcePath);
  try {
    const plan = await planOptimizedExport(request);
    if (
      selectActiveInstanceId(getState()) === initialInstance.id &&
      currentSourceKey(getState()) === sourcePath
    ) {
      dispatch(optimizedExportPlanReceived({ requestId, commandPreview: plan.commandPreview }));
    }
  } catch (error: unknown) {
    if (
      selectActiveInstanceId(getState()) === initialInstance.id &&
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
    if (selectQueueEdit(getState())) {
      void finishQueuedExportEdit(dispatch, getState);
      return;
    }
    dispatch(optimizedExportDialogClosed());
    void startEditingInstanceExport("optimized", dispatch, getState, origin);
  };

async function startEditingInstanceExport(
  route: ExportRoute,
  dispatch: Parameters<AppThunk>[0],
  getState: Parameters<AppThunk>[1],
  origin: DiagnosticOrigin,
) {
  const initialState = getState();
  const initialInstance = selectActiveEditingInstance(initialState);
  const initialSource = selectSourceSelection(initialState);
  if (!initialInstance || !initialSource || !selectSourceReady(initialState)) return;
  if (initialInstance.draftAvailable === false || initialState.importWorkflow.isNativeDialogOpen)
    return;

  const analysis = await ensureLoudnessAnalysis(dispatch, getState, {
    instanceId: initialInstance.id,
    loadToken: initialState.source.loadToken,
    sourcePath: initialSource.sourcePath,
  });

  if (analysis.status === "failed") {
    dispatch(
      exportLaunchFailed({
        code: "loudness_analysis_required",
        message: "Analyze track loudness to continue.",
      }),
    );
    return;
  }
  if (analysis.status !== "ready") return;

  const currentState = analysis.state;
  const instance = selectActiveEditingInstance(currentState);
  const source = selectSourceSelection(currentState);
  const media = selectSourceMedia(currentState);
  const trim = selectTrim(currentState);
  if (
    !instance ||
    !source ||
    !media ||
    !trim ||
    !selectSourceReady(currentState) ||
    instance.id !== initialInstance.id ||
    normalizeSourceKey(source.sourcePath) !== normalizeSourceKey(initialSource.sourcePath) ||
    instance.draftAvailable === false ||
    currentState.importWorkflow.isNativeDialogOpen
  )
    return;

  const request =
    route === "fast" ? getFastRequest(currentState) : getOptimizedRequest(currentState);

  if (!request) return;

  const snapshot = getCurrentExportSnapshot(currentState);
  if (!snapshot) return;

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

function getCurrentExportSnapshot(state: ReturnType<Parameters<AppThunk>[1]>) {
  const source = selectSourceSelection(state);
  const trim = selectTrim(state);
  if (!source || !trim) return null;
  return createEditorSnapshot({
    source,
    trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
    crop: selectCropApplied(state) ? selectCrop(state) : null,
    flipHorizontal: selectFlipHorizontal(state),
    flipVertical: selectFlipVertical(state),
    rotation: selectRotationDegrees(state),
    audioTracks: selectAudioTracks(state).map(({ enabled, processing, streamIndex }) => ({
      enabled,
      streamIndex,
      processing: { ...processing },
    })),
    mergeAudio: selectMergeAudio(state),
  });
}

function currentSourceKey(state: ReturnType<Parameters<AppThunk>[1]>) {
  return normalizeSourceKey(selectSourceSelection(state)?.sourcePath ?? "");
}

function getInitialSettings(state: ReturnType<Parameters<AppThunk>[1]>): ExportSettings | null {
  const instance = selectActiveEditingInstance(state);
  if (!instance) return null;
  return (
    instance.optimizedSettings ?? {
      frameRate: undefined,
      resolution: selectCropResolution(state),
    }
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
    audioTracks: exportAudioTracks(state),
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
    audioTracks: exportAudioTracks(state),
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

function exportAudioTracks(state: ReturnType<Parameters<AppThunk>[1]>) {
  const trim = selectTrim(state);
  const tracks = selectAudioTracks(state);
  return selectedAudioTracks(tracks).map((selection) => {
    const track = tracks.find((candidate) => candidate.streamIndex === selection.streamIndex);
    if (!track) return selection;
    const cacheKey = trim
      ? audioTrackLoudnessInputsKey(selection.streamIndex, trim, selection.processing)
      : null;

    return {
      ...selection,
      ...(selection.processing.loudnessNormalization !== undefined &&
      cacheKey &&
      track.loudnessAnalysis.status === "ready" &&
      track.loudnessAnalysis.cacheKey === cacheKey
        ? { loudnessAnalysis: { ...track.loudnessAnalysis.value } }
        : {}),
    };
  });
}

async function ensureLoudnessAnalysis(
  dispatch: Parameters<AppThunk>[0],
  getState: Parameters<AppThunk>[1],
  context: { instanceId: string; loadToken: number; sourcePath: string },
): Promise<LoudnessAnalysisResult> {
  const maxPasses = 8;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    let state = getState();
    if (!isLoudnessAnalysisContextCurrent(state, context)) return { status: "context-changed" };
    const trim = selectTrim(state);
    if (!trim) return { status: "failed" };

    const missing = selectAudioTracks(state).filter((track) => {
      if (!track.enabled || track.processing.loudnessNormalization === undefined) return false;
      const cacheKey = audioTrackLoudnessInputsKey(track.streamIndex, trim, track.processing);
      return (
        track.loudnessAnalysis.status !== "ready" || track.loudnessAnalysis.cacheKey !== cacheKey
      );
    });

    if (missing.length === 0) return { state, status: "ready" };

    for (const pendingTrack of missing) {
      state = getState();
      if (!isLoudnessAnalysisContextCurrent(state, context)) return { status: "context-changed" };
      const currentTrim = selectTrim(state);
      const currentTrack = selectAudioTracks(state).find(
        (track) => track.streamIndex === pendingTrack.streamIndex,
      );

      if (
        !currentTrim ||
        !currentTrack?.enabled ||
        currentTrack.processing.loudnessNormalization === undefined
      ) {
        continue;
      }
      const cacheKey = audioTrackLoudnessInputsKey(
        currentTrack.streamIndex,
        currentTrim,
        currentTrack.processing,
      );

      if (
        currentTrack.loudnessAnalysis.status === "ready" &&
        currentTrack.loudnessAnalysis.cacheKey === cacheKey
      ) {
        continue;
      }
      if (
        currentTrack.loudnessAnalysis.status === "failed" &&
        currentTrack.loudnessAnalysis.cacheKey === cacheKey
      ) {
        return { status: "failed" };
      }

      await dispatch(analyzeTrackLoudness(currentTrack.streamIndex));
      state = getState();
      if (!isLoudnessAnalysisContextCurrent(state, context)) return { status: "context-changed" };
      const afterTrim = selectTrim(state);
      const afterTrack = selectAudioTracks(state).find(
        (track) => track.streamIndex === pendingTrack.streamIndex,
      );

      if (
        !afterTrim ||
        !afterTrack?.enabled ||
        afterTrack.processing.loudnessNormalization === undefined
      )
        continue;
      const afterCacheKey = audioTrackLoudnessInputsKey(
        afterTrack.streamIndex,
        afterTrim,
        afterTrack.processing,
      );

      if (
        afterTrack.loudnessAnalysis.status === "failed" &&
        afterTrack.loudnessAnalysis.cacheKey === afterCacheKey
      ) {
        return { status: "failed" };
      }
    }
  }

  const state = getState();
  if (!isLoudnessAnalysisContextCurrent(state, context)) return { status: "context-changed" };
  const trim = selectTrim(state);
  if (!trim) return { status: "failed" };
  const allAnalysesReady = selectAudioTracks(state).every((track) => {
    if (!track.enabled || track.processing.loudnessNormalization === undefined) return true;
    const cacheKey = audioTrackLoudnessInputsKey(track.streamIndex, trim, track.processing);
    return (
      track.loudnessAnalysis.status === "ready" && track.loudnessAnalysis.cacheKey === cacheKey
    );
  });

  return allAnalysesReady ? { state, status: "ready" } : { status: "failed" };
}

type LoudnessAnalysisResult =
  | { state: ReturnType<Parameters<AppThunk>[1]>; status: "ready" }
  | { status: "context-changed" | "failed" };

function isLoudnessAnalysisContextCurrent(
  state: ReturnType<Parameters<AppThunk>[1]>,
  context: { instanceId: string; loadToken: number; sourcePath: string },
): boolean {
  return (
    state.source.loadToken === context.loadToken &&
    selectSourceReady(state) &&
    selectActiveInstanceId(state) === context.instanceId &&
    currentSourceKey(state) === normalizeSourceKey(context.sourcePath)
  );
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
  cancelOptimizedExportDialogRequested,
  editExportAttemptRequested,
  loadQueueFinishActions,
  openOptimizedExportDialog,
  optimizedExportSettingsChangedRequested,
  refreshOptimizedExportPlan,
  retryExportAttemptRequested,
  startExportQueue,
  startFastCutRequested,
  startOptimizedExportRequested,
  startSourceExportQueue,
};
