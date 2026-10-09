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
  editingInstanceGifSettingsChanged,
  editingInstanceOptimizedSettingsChanged,
  selectActiveEditingInstance,
  selectActiveInstanceId,
  selectEditingInstanceById,
} from "@/app/store/slices/editing-instances-slice";
import {
  exportLaunchFailed,
  exportPlanFailed,
  exportPlanReceived,
  exportPlanRequested,
  gifExportDialogOpened,
  optimizedExportDialogClosed,
  optimizedExportDialogOpened,
  queueEditFinished,
  queueEditStarted,
  queueFinishActionsAvailable,
  selectExportDialogOpen,
  selectExportDialogRoute,
  selectQueueEdit,
} from "@/app/store/slices/export-slice";
import { nativeDialogStateChanged } from "@/app/store/slices/import-workflow-slice";
import {
  selectSourceMedia,
  selectSourceReady,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { selectedAudioMetadata, selectedAudioTracks } from "@/domain/audio-export";
import {
  audioTrackLoudnessInputsKey,
  serializeAudioTrackSettings,
} from "@/domain/audio-processing";
import type { ExportRoute, ExportSettings } from "@/domain/editing-instance";
import { createExportAttempt } from "@/domain/editing-instance";
import type { EditorSnapshot } from "@/domain/editor-snapshot";
import { createEditorSnapshot } from "@/domain/editor-snapshot";
import type { AudioExportRequest } from "@/domain/media";
import { normalizeTransformForExport } from "@/domain/rotation";
import { normalizeSourceKey } from "@/domain/source";
import { localizeAppError } from "@/i18n/app-errors";
import { i18n } from "@/i18n/config";
import { diagnostics } from "@/lib/diagnostics";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";
import {
  chooseAudioOutputPath,
  chooseGifOutputPath,
  chooseOutputPath,
  planGifExport,
  planOptimizedExport,
  releaseExportSource,
  reserveExportSource,
} from "@/lib/tauri/media";
import type {
  FastExportRequest,
  GifExportRequest,
  OptimizedExportRequest,
} from "@/lib/tauri/media.types";
import { normalizeAppError } from "@/lib/tauri/media.utils";
import { availableQueueFinishActions } from "@/lib/tauri/queue";

import { analyzeTrackLoudness } from "./audio-track-thunks";
import type { AppThunk } from "./source-media-thunks";
import {
  activateEditingInstanceRequested,
  commitActiveEditingInstanceDraft,
} from "./source-media-thunks";

let exportPlanRequestSequence = 0;
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
      if (attempt.route === "audio") return;

      if (instance.draftAvailable === false || instance.sourceAvailability !== "available") return;
      dispatch(commitActiveEditingInstanceDraft());
      const request = attempt.request as OptimizedExportRequest | GifExportRequest;
      const settingsAction = {
        id: instanceId,
        settings: {
          frameRate: request.frameRate,
          resolution: request.resolution,
        },
      };

      dispatch(
        attempt.route === "gif"
          ? editingInstanceGifSettingsChanged(settingsAction)
          : editingInstanceOptimizedSettingsChanged(settingsAction),
      );
      const currentInstance = selectEditingInstanceById(getState(), instanceId);
      if (!currentInstance) return;
      const restored = await dispatch(
        activateEditingInstanceRequested({
          ...currentInstance,
          ...(attempt.route === "optimized"
            ? { optimizedArguments: (request as OptimizedExportRequest).arguments }
            : {}),
          snapshot: attempt.snapshot,
        }),
      );

      if (!restored) return;
      dispatch(queueEditStarted({ attemptId, instanceId, route: attempt.route }));
      dispatch(attempt.route === "gif" ? gifExportDialogOpened() : optimizedExportDialogOpened());
      await dispatch(refreshExportPlan());
    } catch (error: unknown) {
      const normalized = normalizeAppError(error);
      diagnostics.error("export.queue.edit.failed", normalized, { snapshotId: instanceId });
      toast.error(localizeAppError(normalized, i18n.t));
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
    const output =
      route === "gif"
        ? await chooseGifOutputPath(attempt.output.displayName)
        : await chooseOutputPath(
            attempt.output.displayName,
            route === "fast" ? (attempt.request as FastExportRequest) : undefined,
          );

    if (!output) return;

    let request = attempt.request;
    let snapshot: EditorSnapshot = attempt.snapshot;
    if (route === "optimized" || route === "gif") {
      if (selectActiveInstanceId(getState()) !== instanceId || !selectSourceReady(getState()))
        return;
      const updatedRequest =
        route === "gif" ? getGifRequest(getState()) : getOptimizedRequest(getState());

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
    toast.error(localizeAppError(normalized, i18n.t));
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
    await dispatch(refreshExportPlan());
    diagnostics.action("export.dialog.opened", origin);
  };

const openGifExportDialog =
  (origin: DiagnosticOrigin = { id: "gif-export", type: "button" }): AppThunk =>
  async (dispatch, getState) => {
    if (!getInitialSettings(getState())) return;
    dispatch(gifExportDialogOpened());
    await dispatch(refreshExportPlan());
    diagnostics.action("export.dialog.opened", origin);
  };

const cancelOptimizedExportDialogRequested = (): AppThunk => (dispatch, getState) => {
  if (selectQueueEdit(getState())) {
    dispatch(cancelQueuedExportEditRequested());
  } else {
    dispatch(optimizedExportDialogClosed());
  }
};

const exportSettingsChangedRequested =
  (settings: ExportSettings): AppThunk =>
  async (dispatch, getState) => {
    const instanceId = selectActiveInstanceId(getState());
    if (!instanceId) return;
    dispatch(
      selectExportDialogRoute(getState()) === "gif"
        ? editingInstanceGifSettingsChanged({ id: instanceId, settings })
        : editingInstanceOptimizedSettingsChanged({ id: instanceId, settings }),
    );
    if (selectExportDialogOpen(getState())) await dispatch(refreshExportPlan());
  };

const refreshExportPlan = (): AppThunk => async (dispatch, getState) => {
  const initialState = getState();
  const route = selectExportDialogRoute(initialState);
  const initialInstance = selectActiveEditingInstance(initialState);
  const initialSource = selectSourceSelection(initialState);
  if (!initialInstance || !initialSource || !selectSourceReady(initialState)) return;
  const requestId = ++exportPlanRequestSequence;
  dispatch(exportPlanRequested({ requestId }));
  const analysis =
    route === "gif"
      ? { state: initialState, status: "ready" as const }
      : await ensureLoudnessAnalysis(dispatch, getState, {
          instanceId: initialInstance.id,
          loadToken: initialState.source.loadToken,
          sourcePath: initialSource.sourcePath,
        });

  if (analysis.status === "failed") {
    dispatch(
      exportPlanFailed({
        requestId,
        error: {
          code: "loudness_analysis_required",
          messageId: "export.analyzeTrackLoudnessToContinue",
        },
      }),
    );
    return;
  }
  if (analysis.status !== "ready") return;
  const request =
    route === "gif" ? getGifRequest(analysis.state) : getOptimizedRequest(analysis.state);

  if (!request) return;
  const sourcePath = normalizeSourceKey(request.sourcePath);
  try {
    const plan =
      route === "gif"
        ? await planGifExport(request as GifExportRequest)
        : await planOptimizedExport(request as OptimizedExportRequest);

    if (
      selectActiveInstanceId(getState()) === initialInstance.id &&
      currentSourceKey(getState()) === sourcePath &&
      selectExportDialogRoute(getState()) === route
    ) {
      dispatch(exportPlanReceived({ requestId, commandPreview: plan.commandPreview }));
    }
  } catch (error: unknown) {
    if (
      selectActiveInstanceId(getState()) === initialInstance.id &&
      currentSourceKey(getState()) === sourcePath &&
      selectExportDialogRoute(getState()) === route
    ) {
      dispatch(exportPlanFailed({ requestId, error: normalizeAppError(error) }));
    }
  }
};

const startFastExportRequested =
  (origin: DiagnosticOrigin = { id: "fast-export", type: "button" }): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    if (selectCropApplied(getState()) || selectTransformApplied(getState())) return;
    await startEditingInstanceExport("fast", dispatch, getState, origin);
  };

const startAudioExportRequested =
  (origin: DiagnosticOrigin = { id: "audio-export", type: "button" }): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    await startEditingInstanceExport("audio", dispatch, getState, origin);
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

const startGifExportRequested = (): AppThunk => (dispatch, getState) => {
  dispatch(optimizedExportDialogClosed());
  void startEditingInstanceExport("gif", dispatch, getState, {
    id: "toolbar.gif-export",
    type: "button",
  });
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

  const analysis =
    route === "gif"
      ? { state: initialState, status: "ready" as const }
      : await ensureLoudnessAnalysis(dispatch, getState, {
          instanceId: initialInstance.id,
          loadToken: initialState.source.loadToken,
          sourcePath: initialSource.sourcePath,
        });

  if (analysis.status === "failed") {
    dispatch(
      exportLaunchFailed({
        code: "loudness_analysis_required",
        messageId: "export.analyzeTrackLoudnessToContinue",
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

  const initialRequest =
    route === "fast"
      ? getFastRequest(currentState)
      : route === "audio"
        ? getAudioRequest(currentState, "m4a")
        : route === "gif"
          ? getGifRequest(currentState)
          : getOptimizedRequest(currentState);

  if (!initialRequest) return;
  let request: AudioExportRequest | FastExportRequest | GifExportRequest | OptimizedExportRequest =
    initialRequest;

  const snapshot = getCurrentExportSnapshot(currentState);
  if (!snapshot) return;

  // Persist the working draft at the export boundary, while the attempt keeps
  // its own immutable snapshot for the remainder of the export lifecycle.
  dispatch(commitActiveEditingInstanceDraft());

  const attemptId = nextAttemptId();
  dispatch(nativeDialogStateChanged(true));
  try {
    const output =
      route === "audio"
        ? await chooseAudioOutputPath(outputDefaults(source.displayName).audio)
        : route === "gif"
          ? await chooseGifOutputPath(outputDefaults(source.displayName).gif)
          : await chooseOutputPath(
              outputDefaults(source.displayName)[route],
              route === "fast" ? (request as FastExportRequest) : undefined,
            );

    if (!output) return;
    if (route === "audio") {
      const format = output.displayName.toLowerCase().endsWith(".wav") ? "wav" : "m4a";
      request = { ...(request as AudioExportRequest), format };
    }
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
      totalFrames:
        route === "audio"
          ? undefined
          : getTotalFrames(request as FastExportRequest | OptimizedExportRequest, media.video),
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
    audioTracks: selectAudioTracks(state).map(serializeAudioTrackSettings),
    mergeAudio: selectMergeAudio(state),
  });
}

function currentSourceKey(state: ReturnType<Parameters<AppThunk>[1]>) {
  return normalizeSourceKey(selectSourceSelection(state)?.sourcePath ?? "");
}

function getInitialSettings(
  state: ReturnType<Parameters<AppThunk>[1]>,
  route: "gif" | "optimized" = "optimized",
): ExportSettings | null {
  const instance = selectActiveEditingInstance(state);
  if (!instance) return null;
  return (
    (route === "gif" ? instance.gifSettings : instance.optimizedSettings) ?? {
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
    audioMetadata: selectedAudioMetadata(selectAudioTracks(state)),
    mergeAudio: selectMergeAudio(state),
    stripMetadata: state.preferences.stripMetadataOnExport,
    rotationDegrees: transform.rotationDegrees,
  };
}

function getAudioRequest(
  state: ReturnType<Parameters<AppThunk>[1]>,
  format: AudioExportRequest["format"],
): AudioExportRequest | null {
  const source = selectSourceSelection(state);
  const trim = selectTrim(state);
  if (!source || !trim) return null;
  return {
    sourcePath: source.sourcePath,
    trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
    audioTracks: exportAudioTracks(state),
    audioMetadata: selectedAudioMetadata(selectAudioTracks(state)),
    mergeAudio: selectMergeAudio(state),
    stripMetadata: state.preferences.stripMetadataOnExport,
    format,
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
    audioMetadata: selectedAudioMetadata(selectAudioTracks(state)),
    mergeAudio: selectMergeAudio(state),
    stripMetadata: state.preferences.stripMetadataOnExport,
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

function getGifRequest(state: ReturnType<Parameters<AppThunk>[1]>): GifExportRequest | null {
  const source = selectSourceSelection(state);
  const trim = selectTrim(state);
  const settings = getInitialSettings(state, "gif");
  if (!source || !trim || !settings) return null;
  const transform = exportTransform(state);
  return {
    sourcePath: source.sourcePath,
    trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
    audioTracks: [],
    mergeAudio: false,
    rotationDegrees: transform.rotationDegrees,
    crop: selectCropApplied(state) ? transform.crop : undefined,
    flipHorizontal: transform.flipHorizontal,
    flipVertical: transform.flipVertical,
    frameRate: settings.frameRate
      ? { numerator: settings.frameRate.numerator, denominator: settings.frameRate.denominator }
      : undefined,
    resolution: settings.resolution,
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
  const sourcePath = selectSourceSelection(state)?.sourcePath ?? "";
  const tracks = selectAudioTracks(state);
  return selectedAudioTracks(tracks).map((selection) => {
    const track = tracks.find((candidate) => candidate.streamIndex === selection.streamIndex);
    if (!track) return selection;
    const cacheKey = trim
      ? audioTrackLoudnessInputsKey(sourcePath, selection.streamIndex, trim, selection.processing)
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
    const sourcePath = selectSourceSelection(state)?.sourcePath ?? "";

    const missing = selectAudioTracks(state).filter((track) => {
      if (!track.enabled || track.processing.loudnessNormalization === undefined) return false;
      const cacheKey = audioTrackLoudnessInputsKey(
        sourcePath,
        track.streamIndex,
        trim,
        track.processing,
      );

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
        selectSourceSelection(state)?.sourcePath ?? "",
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
        selectSourceSelection(state)?.sourcePath ?? "",
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
  const sourcePath = selectSourceSelection(state)?.sourcePath ?? "";
  const allAnalysesReady = selectAudioTracks(state).every((track) => {
    if (!track.enabled || track.processing.loudnessNormalization === undefined) return true;
    const cacheKey = audioTrackLoudnessInputsKey(
      sourcePath,
      track.streamIndex,
      trim,
      track.processing,
    );

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
  request: FastExportRequest | GifExportRequest | OptimizedExportRequest,
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
  exportSettingsChangedRequested,
  loadQueueFinishActions,
  openGifExportDialog,
  openOptimizedExportDialog,
  refreshExportPlan,
  retryExportAttemptRequested,
  startAudioExportRequested,
  startExportQueue,
  startFastExportRequested,
  startGifExportRequested,
  startOptimizedExportRequested,
  startSourceExportQueue,
};
