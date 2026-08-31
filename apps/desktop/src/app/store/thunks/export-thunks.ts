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
  exportSourceRestored,
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
import { diagnostics } from "@/lib/diagnostics";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";
import {
  chooseOutputPath,
  planOptimizedExport,
  releaseExportSource,
  reserveExportSource,
  restoreSourceFromTrash,
} from "@/lib/tauri/media";
import type { FastExportRequest, OptimizedExportRequest } from "@/lib/tauri/media.types";
import { normalizeAppError } from "@/lib/tauri/media.utils";
import { availableQueueFinishActions } from "@/lib/tauri/queue";

import type { AppThunk } from "./source-media-thunks";

let optimizedPlanRequestSequence = 0;
let historyForkSequence = 0;
let latestExportAddedAt = 0;

function nextExportAddedAt(): number {
  latestExportAddedAt = Math.max(Date.now(), latestExportAddedAt + 1);
  return latestExportAddedAt;
}

export const loadQueueFinishActions = (): AppThunk => async (dispatch) => {
  const operation = diagnostics.startOperation("queue.finish-actions", {
    origin: { type: "system" },
  });

  try {
    const actions = await availableQueueFinishActions();
    dispatch(queueFinishActionsAvailable(actions.includes("nothing") ? actions : ["nothing"]));
    operation.complete({ actionCount: actions.length });
  } catch {
    dispatch(queueFinishActionsAvailable(["exit", "nothing"]));
    operation.complete({ fallback: true });
  }
};

export const startExportQueue =
  (origin: DiagnosticOrigin = { type: "internal" }): AppThunk =>
  (dispatch, getState) => {
    diagnostics.action("export.queue.start.requested", origin);
    if (!getState().export.queue.some((item) => item.status === "queued")) {
      diagnostics.event("export.queue.start.ignored", {
        data: { reason: "no_queued_exports" },
        origin,
        result: "ignored",
      });
      return;
    }
    dispatch(queueStarted());
    setExportQueueExecutionEnabled(true, dispatch, getState);
  };

export const pauseExportQueue =
  (origin: DiagnosticOrigin = { type: "internal" }): AppThunk =>
  (dispatch, getState) => {
    diagnostics.action("export.queue.pause.requested", origin);
    dispatch(queuePaused());
    setExportQueueExecutionEnabled(false, dispatch, getState);
  };

export const cancelActiveExportRequested = (): AppThunk => (_dispatch, getState) => {
  diagnostics.action("export.cancel.requested", { id: "active", type: "button" });
  cancelActiveExport(getState);
};

export const cancelAllExportsRequested = (): AppThunk => (_dispatch, getState) => {
  diagnostics.action("export.cancel.requested", { id: "all", type: "menu" });
  cancelAllQueuedExports(getState);
};

export const cancelExportRequested =
  (id: string): AppThunk =>
  (_dispatch, getState) => {
    diagnostics.action(
      "export.cancel.requested",
      { id: "queue-item", type: "button" },
      { itemId: id },
    );
    cancelQueuedExport(id, getState);
  };

export const openOptimizedExportDialog =
  (origin: DiagnosticOrigin = { id: "optimized", type: "button" }): AppThunk =>
  async (dispatch, getState) => {
    diagnostics.action("export.dialog.opened", origin);
    const settings = getInitialSettings(getState());
    if (!settings) {
      diagnostics.event("export.dialog.ignored", {
        data: { reason: "source_not_ready" },
        origin,
        result: "ignored",
      });
      return;
    }
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
  if (!request) {
    diagnostics.event("export.plan.ignored", {
      data: { reason: "source_not_ready" },
      origin: { type: "internal" },
      result: "ignored",
    });
    return;
  }
  const sourcePath = request.sourcePath;
  const requestId = ++optimizedPlanRequestSequence;
  const operation = diagnostics.startOperation("export.plan", {
    data: { requestId },
    origin: { type: "internal" },
  });

  dispatch(optimizedExportPlanRequested({ requestId }));
  try {
    const plan = await planOptimizedExport(request);
    if (currentSourcePath(getState()) === sourcePath) {
      dispatch(optimizedExportPlanReceived({ requestId, commandPreview: plan.commandPreview }));
      operation.complete();
    } else {
      operation.cancel({ reason: "source_replaced" });
    }
  } catch (error: unknown) {
    operation.fail(error);
    if (currentSourcePath(getState()) === sourcePath) {
      dispatch(optimizedExportPlanFailed({ requestId, error: normalizeAppError(error) }));
    }
  }
};

export const startFastCutRequested =
  (origin: DiagnosticOrigin = { id: "fast-cut", type: "button" }): AppThunk =>
  (dispatch, getState) => {
    diagnostics.action("export.request.start", origin, { route: "fast" });
    if (selectCropApplied(getState())) {
      diagnostics.event("export.request.ignored", {
        data: { reason: "crop_requires_optimized_route", route: "fast" },
        origin,
        result: "ignored",
      });
      return;
    }
    void startQueuedExport("fast", dispatch, getState, origin);
  };

export const startOptimizedExportRequested =
  (origin: DiagnosticOrigin = { id: "optimized", type: "button" }): AppThunk =>
  (dispatch, getState) => {
    diagnostics.action("export.request.start", origin, { route: "optimized" });
    dispatch(optimizedExportDialogClosed());
    void startQueuedExport("optimized", dispatch, getState, origin);
  };

async function startQueuedExport(
  route: "fast" | "optimized",
  dispatch: Parameters<AppThunk>[0],
  getState: Parameters<AppThunk>[1],
  origin: DiagnosticOrigin,
) {
  const state = getState();
  const source = selectSourceSelection(state);
  const media = selectSourceMedia(state);
  const trim = selectTrim(state);
  const request = route === "fast" ? getFastRequest(state) : getOptimizedRequest(state);
  if (!source || !media || !trim || !request || !selectSourceReady(state)) {
    diagnostics.event("export.request.ignored", {
      data: { reason: "source_not_ready", route },
      origin,
      result: "ignored",
    });
    return;
  }

  const activeItem = selectActiveQueueItem(state);
  if (!activeItem || activeItem.status !== "imported") {
    diagnostics.event("export.request.ignored", {
      data: { reason: "active_item_not_imported", route },
      origin,
      result: "ignored",
    });
    return;
  }
  const operation = diagnostics.startOperation("export.prepare", {
    data: { route, snapshotId: activeItem.id },
    origin,
    snapshotId: activeItem.id,
  });

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
    if (!output) {
      operation.cancel({ reason: "output_picker_cancelled" });
      return;
    }

    if (!isCurrentExportContext(getState(), importedItemId, source.sourcePath)) {
      operation.cancel({ reason: "source_replaced" });
      return;
    }
    await reserveExportSource(request.sourcePath);
    if (!isCurrentExportContext(getState(), importedItemId, source.sourcePath)) {
      await releaseExportSource(request.sourcePath).catch(() => undefined);
      operation.cancel({ reason: "source_replaced" });
      return;
    }

    const currentImportedItems = selectImportQueueItems(getState());
    const replacementItem = getReplacementImportedItem(
      currentImportedItems,
      currentImportedItems.findIndex((item) => item.id === importedItemId),
    );

    const promotion: QueueItemPromotion = {
      addedAt: nextExportAddedAt(),
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

    if (!promoted) {
      operation.fail(new Error("The export queue item could not be created."));
      return;
    }
    if (!replacementItem) dispatch(navigateToImportedItem(null));
    enqueueExport(promoted, dispatch, getState);
    operation.complete({ outputType: route, filename: output.displayName });
    if (replacementItem) dispatch(navigateToImportedItem(replacementItem.id));
  } catch (error: unknown) {
    const normalized = normalizeAppError(error);
    operation.fail(normalized);
    dispatch(exportLaunchFailed(normalized));
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

export const restoreExportSourceRequested =
  (id: string): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    const item = getState().export.queue.find((candidate) => candidate.id === id);
    if (!item || item.status !== "completed" || !item.sourceDeleted) return false;

    const sourcePath = item.snapshot.source.sourcePath;
    const operation = diagnostics.startOperation("source.file-restore", {
      data: { itemId: item.id, sourcePath },
      origin: { id: "export.restore-source", type: "button" },
      snapshotId: item.id,
    });

    try {
      await restoreSourceFromTrash(sourcePath);
      dispatch(exportSourceRestored({ id: item.id }));
      operation.complete({ itemId: item.id, sourcePath });
      return true;
    } catch (error: unknown) {
      operation.fail(error, { itemId: item.id, sourcePath });
      return false;
    }
  };
