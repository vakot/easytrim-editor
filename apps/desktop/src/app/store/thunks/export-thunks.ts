import {
  cancelActiveExport,
  cancelAllQueuedExports,
  cancelQueuedExport,
  enqueueExport,
  setExportQueueExecutionEnabled,
} from "@/app/store/integration/export-queue-runtime";
import { outputDefaults } from "@/app/store/lib/export-defaults";
import { getReplacementImportedItem } from "@/app/store/lib/imported-queue";
import {
  selectAudioTracks,
  selectMasterAudio,
  selectMergeAudio,
} from "@/app/store/slices/audio-slice";
import { selectCrop, selectCropApplied, selectCropResolution } from "@/app/store/slices/crop-slice";
import {
  exportLaunchFailed,
  type ExportQueueItem,
  type ExportSettings,
  type importQueueItem,
  importQueueItemAdded,
  optimizedExportDialogClosed,
  optimizedExportDialogOpened,
  optimizedExportPlanFailed,
  optimizedExportPlanReceived,
  optimizedExportPlanRequested,
  optimizedExportSettingsChanged,
  queueFinishActionsAvailable,
  queueItemPromoted,
  type QueueItemPromotion,
  queuePaused,
  queueStarted,
  selectActiveItemId,
  selectActiveQueueItem,
  selectImportQueueItems,
} from "@/app/store/slices/export-slice";
import { nativeDialogStateChanged } from "@/app/store/slices/import-workflow-slice";
import {
  selectSourceMedia,
  selectSourceReady,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import {
  activateImportedItemRequested,
  leaveActiveImportedItem,
  navigateToImportedItem,
} from "@/app/store/thunks/source-media-thunks";
import { cloneEditorSnapshot, createEditorSnapshot } from "@/domain/editor-snapshot";
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

let optimizedPlanRequestSequence = 0;
let historyForkSequence = 0;

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

export const cancelActiveExportRequested = (): AppThunk => (_dispatch, getState) => {
  cancelActiveExport(getState);
};

export const cancelAllExportsRequested = (): AppThunk => (_dispatch, getState) => {
  cancelAllQueuedExports(getState);
};

export const cancelExportRequested =
  (id: string): AppThunk =>
  (_dispatch, getState) => {
    cancelQueuedExport(id, getState);
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

  const activeItem = selectActiveQueueItem(state);
  if (!activeItem || activeItem.status !== "imported") return;
  const importedItemId = activeItem.id;
  const snapshot = createEditorSnapshot({
    source,
    trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
    crop: selectCropApplied(state) ? selectCrop(state) : null,
    masterAudio: selectMasterAudio(state),
    audioTracks: selectAudioTracks(state).map(({ enabled, streamIndex, volumePercent }) => ({
      streamIndex,
      enabled,
      volumePercent,
    })),
    mergeAudio: selectMergeAudio(state),
  });

  dispatch(nativeDialogStateChanged(true));
  try {
    const defaults = outputDefaults(source.displayName);
    const output = await chooseOutputPath(defaults[route]);
    if (!output) return;

    if (!isCurrentExportContext(getState(), importedItemId, source.sourcePath)) return;
    await reserveExportSource(request.sourcePath);
    if (!isCurrentExportContext(getState(), importedItemId, source.sourcePath)) {
      await releaseExportSource(request.sourcePath).catch(() => undefined);
      return;
    }

    const currentImportedItems = selectImportQueueItems(getState());
    const replacementItem = getReplacementImportedItem(
      currentImportedItems,
      currentImportedItems.findIndex((item) => item.id === importedItemId),
    );

    const promotion: QueueItemPromotion = {
      id: importedItemId,
      media,
      snapshot,
      route,
      request,
      outputId: output.outputId,
      filename: output.displayName,
      path: output.displayPath,
      totalFrames: getTotalFrames(request, media.video),
    };

    dispatch(queueItemPromoted(promotion));
    const promoted = getState().export.queue.find(
      (item): item is ExportQueueItem => item.id === importedItemId && item.status !== "imported",
    );

    if (!promoted) return;
    enqueueExport(promoted, dispatch, getState);
    if (replacementItem) dispatch(navigateToImportedItem(replacementItem.id));
  } catch (error: unknown) {
    dispatch(exportLaunchFailed(normalizeAppError(error)));
  } finally {
    dispatch(nativeDialogStateChanged(false));
  }
}

function isCurrentExportContext(
  state: ReturnType<Parameters<AppThunk>[1]>,
  activeItemId: string | null,
  sourcePath: string,
) {
  return (
    selectActiveItemId(state) === activeItemId &&
    currentSourcePath(state) === sourcePath &&
    selectSourceReady(state)
  );
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
    averageFrameRate?: { denominator: number; numerator: number };
    realFrameRate?: { denominator: number; numerator: number };
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

export const restoreExportQueueItemRequested =
  (id: string): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    const item = getState().export.queue.find((candidate) => candidate.id === id);
    if (!item || item.status === "imported") return false;
    dispatch(leaveActiveImportedItem());
    const fork: importQueueItem = {
      id: `fork-${++historyForkSequence}`,
      status: "imported",
      origin: "history-fork",
      media: item.media,
      snapshot: cloneEditorSnapshot(item.snapshot),
    };

    dispatch(importQueueItemAdded(fork));
    return dispatch(activateImportedItemRequested(fork));
  };
