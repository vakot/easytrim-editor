import {
  exportLaunchFailed,
  optimizedExportDialogClosed,
  optimizedExportDialogOpened,
  optimizedExportPlanFailed,
  optimizedExportPlanReceived,
  optimizedExportPlanRequested,
  optimizedExportSettingsChanged,
  queueEntryAdded,
  queueFinishActionsAvailable,
  queuePaused,
  queueStarted,
  type ExportQueueItem,
  type ExportSettings,
} from "@/app/store/slices/export-slice";
import {
  selectAudioTracks,
  selectMasterAudio,
  selectMergeAudio,
} from "@/app/store/slices/audio-slice";
import { selectCrop, selectCropApplied, selectCropResolution } from "@/app/store/slices/crop-slice";
import {
  selectSourceMedia,
  selectSourceReady,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import type { AppThunk } from "./source-media-thunks";
import {
  chooseOutputPath,
  normalizeAppError,
  planOptimizedExport,
  reserveExportSource,
  type FastExportRequest,
  type OptimizedExportRequest,
} from "@/lib/tauri/media";
import { availableQueueFinishActions, type QueueFinishAction } from "@/lib/tauri/queue";
import { nativeDialogStateChanged } from "@/app/store/slices/import-workflow-slice";
import {
  cancelActiveExport,
  cancelAllQueuedExports,
  cancelQueuedExport,
  enqueueExport,
  setExportQueueExecutionEnabled,
} from "@/features/export/utils/export-queue";
import { outputDefaults } from "@/features/export/utils/export-options";
import { FULL_CROP } from "@/domain/crop";
import type { EditorSnapshot } from "@/domain/editor-snapshot";
import {
  audioMergeToggled,
  audioTrackToggled,
  audioTrackVolumeChanged,
  masterAudioToggled,
  masterVolumeChanged,
} from "@/app/store/slices/audio-slice";
import { cropChanged } from "@/app/store/slices/crop-slice";
import { trimChanged } from "@/app/store/slices/trim-slice";
import { importSourcePath } from "@/lib/tauri/media";
import { importSource } from "@/app/store/thunks/source-media-thunks";
import { sourceFailed } from "@/app/store/actions/source-actions";

let exportSequence = 0;
let optimizedPlanRequestSequence = 0;
let restoreSequence = 0;

export const loadQueueFinishActions = (): AppThunk => async (dispatch) => {
  try {
    const actions = await availableQueueFinishActions();
    dispatch(queueFinishActionsAvailable(actions.includes("nothing") ? actions : ["nothing"]));
  } catch {
    dispatch(queueFinishActionsAvailable(["exit", "nothing"]));
  }
};

export const startExportQueue = (): AppThunk => (dispatch, getState) => {
  if (!getState().export.queue.some((item) => item.status === "queued")) return;
  dispatch(queueStarted());
  setExportQueueExecutionEnabled(true, dispatch, getState);
};

export const pauseExportQueue = (): AppThunk => (dispatch, getState) => {
  dispatch(queuePaused());
  setExportQueueExecutionEnabled(false, dispatch, getState);
};

export const cancelActiveExportRequested = (): AppThunk => () => {
  cancelActiveExport();
};

export const cancelAllExportsRequested = (): AppThunk => () => {
  cancelAllQueuedExports();
};

export const cancelExportRequested =
  (id: string): AppThunk =>
  () => {
    cancelQueuedExport(id);
  };

export const openOptimizedExportDialog = (): AppThunk => async (dispatch, getState) => {
  const settings = getInitialSettings(getState());
  if (!settings) return;
  dispatch(optimizedExportDialogOpened(settings));
  await dispatch(refreshOptimizedExportPlan());
};

export const optimizedExportSettingsChangedRequested =
  (settings: ExportSettings): AppThunk =>
  async (dispatch) => {
    dispatch(optimizedExportSettingsChanged(settings));
    await dispatch(refreshOptimizedExportPlan());
  };

export const refreshOptimizedExportPlan = (): AppThunk => async (dispatch, getState) => {
  const request = getOptimizedRequest(getState());
  if (!request) return;
  const sourcePath = request.sourcePath;
  const requestId = ++optimizedPlanRequestSequence;
  dispatch(optimizedExportPlanRequested({ requestId }));
  try {
    const plan = await planOptimizedExport(request);
    if (currentSourcePath(getState()) === sourcePath) {
      dispatch(optimizedExportPlanReceived({ requestId, commandPreview: plan.commandPreview }));
    }
  } catch (error: unknown) {
    if (currentSourcePath(getState()) === sourcePath) {
      dispatch(optimizedExportPlanFailed({ requestId, error: normalizeAppError(error) }));
    }
  }
};

export const startFastCutRequested = (): AppThunk => (dispatch, getState) => {
  if (selectCropApplied(getState())) return;
  void startQueuedExport("fast", dispatch, getState);
};

export const startOptimizedExportRequested = (): AppThunk => (dispatch, getState) => {
  dispatch(optimizedExportDialogClosed());
  void startQueuedExport("optimized", dispatch, getState);
};

async function startQueuedExport(
  route: "fast" | "optimized",
  dispatch: Parameters<AppThunk>[0],
  getState: Parameters<AppThunk>[1],
) {
  const state = getState();
  const source = selectSourceSelection(state);
  const media = selectSourceMedia(state);
  const trim = selectTrim(state);
  const request = route === "fast" ? getFastRequest(state) : getOptimizedRequest(state);
  if (!source || !media || !trim || !request || !selectSourceReady(state)) return;

  dispatch(nativeDialogStateChanged(true));
  try {
    const defaults = outputDefaults(source.displayName);
    const output = await chooseOutputPath(defaults[route]);
    if (!output) return;
    await reserveExportSource(request.sourcePath);

    const snapshot: EditorSnapshot = {
      source: { ...source },
      trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
      crop: selectCropApplied(state) ? selectCrop(state) : null,
      audio: {
        master: selectMasterAudio(state),
        tracks: selectAudioTracks(state).map(({ streamIndex, enabled, volumePercent }) => ({
          streamIndex,
          enabled,
          volumePercent,
        })),
        mergeAudio: selectMergeAudio(state),
      },
    };
    const item: ExportQueueItem = {
      id: `export-${++exportSequence}`,
      snapshot,
      route,
      request,
      outputId: output.outputId,
      filename: output.displayName,
      path: output.displayPath,
      status: "queued",
      operationId: null,
      startedAt: null,
      durationMs: null,
      progressPercent: 0,
      totalFrames: getTotalFrames(request, media.video),
    };
    dispatch(queueEntryAdded(item));
    enqueueExport(item, dispatch, getState);
  } catch (error: unknown) {
    dispatch(exportLaunchFailed(normalizeAppError(error)));
  } finally {
    dispatch(nativeDialogStateChanged(false));
  }
}

function getInitialSettings(state: ReturnType<Parameters<AppThunk>[1]>): ExportSettings | null {
  const existing = state.export.optimizedSettings;
  if (existing) return existing;
  const resolution = selectCropResolution(state);
  return { resolution, frameRate: undefined };
}

function currentSourcePath(state: ReturnType<Parameters<AppThunk>[1]>): string | undefined {
  const source = selectSourceSelection(state);
  return source?.sourcePath;
}

function getFastRequest(state: ReturnType<Parameters<AppThunk>[1]>): FastExportRequest | null {
  const source = selectSourceSelection(state);
  const trim = selectTrim(state);
  if (!source || !trim) return null;
  return {
    sourcePath: source.sourcePath,
    trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
    audioTracks: selectedAudioTracks(state),
    mergeAudio: selectMergeAudio(state),
  };
}

function getOptimizedRequest(
  state: ReturnType<Parameters<AppThunk>[1]>,
): OptimizedExportRequest | null {
  const source = selectSourceSelection(state);
  const trim = selectTrim(state);
  const settings = getInitialSettings(state);
  const media = selectSourceMedia(state);
  if (!source || !trim || !settings || !media) return null;
  const argumentsText = state.exportPresets.argumentsText;
  return {
    sourcePath: source.sourcePath,
    trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
    audioTracks: selectedAudioTracks(state),
    mergeAudio: selectMergeAudio(state),
    resolution: settings.resolution,
    crop: selectCrop(state),
    frameRate: settings.frameRate
      ? { numerator: settings.frameRate.numerator, denominator: settings.frameRate.denominator }
      : undefined,
    arguments: argumentsText,
  };
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
    averageFrameRate?: { numerator: number; denominator: number };
    realFrameRate?: { numerator: number; denominator: number };
  },
) {
  const frameRate =
    "frameRate" in request && request.frameRate
      ? request.frameRate.numerator / request.frameRate.denominator
      : video.averageFrameRate
        ? video.averageFrameRate.numerator / video.averageFrameRate.denominator
        : video.realFrameRate
          ? video.realFrameRate.numerator / video.realFrameRate.denominator
          : undefined;
  if (!frameRate || frameRate <= 0) return undefined;
  return Math.max(
    1,
    Math.round(((request.trim.endMicros - request.trim.startMicros) / 1_000_000) * frameRate),
  );
}

export type { QueueFinishAction };

export const restoreExportQueueItemRequested =
  (id: string): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    const item = getState().export.queue.find((candidate) => candidate.id === id);
    if (!item) return false;
    const restorationId = ++restoreSequence;

    try {
      const source = await importSourcePath(item.snapshot.source.sourcePath);
      if (restorationId !== restoreSequence) return false;
      await dispatch(importSource(source, item.snapshot.audio.mergeAudio));
      const state = getState();
      if (
        restorationId !== restoreSequence ||
        currentSourcePath(state) !== item.snapshot.source.sourcePath ||
        !state.source.media
      ) {
        return false;
      }
      applyEditorSnapshot(dispatch, getState, item.snapshot);
      return true;
    } catch (error: unknown) {
      if (restorationId === restoreSequence) {
        dispatch(sourceFailed({ error: normalizeAppError(error) }));
      }
      return false;
    }
  };

function applyEditorSnapshot(
  dispatch: Parameters<AppThunk>[0],
  getState: Parameters<AppThunk>[1],
  snapshot: EditorSnapshot,
) {
  const media = selectSourceMedia(getState());
  if (!media) return;
  dispatch(
    trimChanged({
      trim: { ...snapshot.trim, sourceDurationMicros: media.durationMicros },
    }),
  );
  const crop = snapshot.crop ?? FULL_CROP;
  dispatch(
    cropChanged({
      crop,
      resolution: { width: media.video.width, height: media.video.height },
    }),
  );

  const master = selectMasterAudio(getState());
  dispatch(masterVolumeChanged({ volumePercent: snapshot.audio.master.volumePercent }));
  if (master.enabled !== snapshot.audio.master.enabled) {
    dispatch(masterAudioToggled());
  }
  for (const track of snapshot.audio.tracks) {
    dispatch(
      audioTrackVolumeChanged({
        streamIndex: track.streamIndex,
        volumePercent: track.volumePercent,
      }),
    );
    const current = selectAudioTracks(getState()).find(
      (candidate) => candidate.streamIndex === track.streamIndex,
    );
    if (current && current.enabled !== track.enabled) {
      dispatch(audioTrackToggled({ streamIndex: track.streamIndex }));
    }
  }
  if (selectMergeAudio(getState()) !== snapshot.audio.mergeAudio) {
    dispatch(audioMergeToggled());
  }
}
