import {
  capabilitiesFailed,
  capabilitiesReady,
  selectHasSource,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import {
  sourceCleared,
  sourceErrorReported,
  sourceFailed,
  sourceReady,
  sourceSelected,
} from "@/app/store/actions/source-actions";
import {
  audioPreviewsLoading,
  audioPreviewsReady,
  audioPreviewsUnavailable,
  waveformReady,
  waveformsFailed,
  waveformsLoading,
} from "@/app/store/slices/audio-slice";
import { previewFailed, previewLoading, previewReady } from "@/app/store/slices/preview-slice";
import {
  dropListenerErrorCleared,
  nativeDialogStateChanged,
  sourceChoiceFinished,
  sourceChoiceStarted,
} from "@/app/store/slices/import-workflow-slice";
import {
  activeQueueItemChanged,
  importedQueueItemAdded,
  importedQueueItemRemoved,
  queueItemSnapshotUpdated,
  selectActiveQueueItem,
  selectImportedQueueItems,
  type ImportedQueueItem,
} from "@/app/store/slices/export-slice";
import {
  checkMediaCapabilities,
  chooseSource as chooseSourceDialog,
  inspectMedia,
  importSourcePath,
  normalizeAppError,
  prepareAudioPreviews,
  prepareProxyPreview,
  prepareSourcePreview,
  prepareWaveforms,
  type AppError,
  type PreviewKind,
} from "@/lib/tauri/media";
import type { SourceRef } from "@/domain/source";
import { createEditorSnapshot } from "@/domain/editor-snapshot";
import {
  selectAudioTracks,
  selectMasterAudio,
  selectMergeAudio,
} from "@/app/store/slices/audio-slice";
import { selectCrop } from "@/app/store/slices/crop-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import type { AppDispatch, RootState } from "@/app/store/store";
import { applyEditorSnapshot } from "@/app/store/editor-snapshot";

export type AppThunk<ReturnValue = void | Promise<unknown>> = (
  dispatch: AppDispatch,
  getState: () => RootState,
) => ReturnValue;

let waveformJobSequence = 0;
let sourceLoadSequence = 0;
let importedItemSequence = 0;
let queueRestoreSequence = 0;

type ImportedItemRestoreResult =
  { status: "succeeded" } | { status: "failed"; error: AppError } | { status: "stale" };

export interface ImportSourceOptions {
  registerQueueItem?: boolean;
  activeItemId?: string | null;
  captureCurrentDraft?: boolean;
  leaveActiveItem?: boolean;
}

function isCurrentSource(state: RootState, sourcePath: string, loadToken: number): boolean {
  return (
    selectSourceSelection(state)?.sourcePath === sourcePath && state.source.loadToken === loadToken
  );
}

function isSourceInspectionError(error: AppError): boolean {
  return ["probe_failed", "unsupported_media", "io_failed", "source_replaced"].includes(error.code);
}

export const checkMediaCapabilitiesRequested = (): AppThunk => async (dispatch) => {
  try {
    dispatch(capabilitiesReady(await checkMediaCapabilities()));
  } catch (error: unknown) {
    dispatch(capabilitiesFailed(normalizeAppError(error)));
  }
};

export const importSource =
  (source: SourceRef, mergeAudio?: boolean, options: ImportSourceOptions = {}): AppThunk =>
  async (dispatch, getState) => {
    const registerQueueItem = options.registerQueueItem ?? true;
    const captureCurrentDraft = options.captureCurrentDraft ?? registerQueueItem;
    const leaveActiveItem =
      options.leaveActiveItem ?? (registerQueueItem && options.activeItemId === undefined);
    if (leaveActiveItem) dispatch(leaveActiveImportedItem());
    else if (captureCurrentDraft) captureActiveQueueItemDraft(dispatch, getState);

    const selectedMergeAudio = mergeAudio ?? getState().preferences.mergeAudioEnabledDefault;
    const loadToken = ++sourceLoadSequence;
    dispatch(dropListenerErrorCleared());
    dispatch(sourceSelected({ source, mergeAudio: selectedMergeAudio, loadToken }));

    let media;
    try {
      media = await inspectMedia(source.sourcePath);
    } catch (error: unknown) {
      const normalized = normalizeAppError(error);
      if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
        dispatch(sourceFailed({ loadToken, error: normalized }));
      }
      return;
    }

    if (!isCurrentSource(getState(), source.sourcePath, loadToken)) return;
    dispatch(sourceReady({ loadToken, media }));
    if (options.activeItemId !== undefined) {
      dispatch(activeQueueItemChanged(options.activeItemId));
    }

    if (registerQueueItem) {
      const state = getState();
      const trim = selectTrim(state);
      if (trim) {
        const item: ImportedQueueItem = {
          id: `import-${++importedItemSequence}`,
          status: "imported",
          origin: "source-import",
          snapshot: createEditorSnapshot({
            source,
            trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
            crop: selectCrop(state),
            masterAudio: selectMasterAudio(state),
            audioTracks: selectAudioTracks(state).map(
              ({ streamIndex, enabled, volumePercent }) => ({
                streamIndex,
                enabled,
                volumePercent,
              }),
            ),
            mergeAudio: selectMergeAudio(state),
          }),
        };
        dispatch(importedQueueItemAdded(item));
      }
    }

    const audioStreamIndexes = media.audioStreams.map((stream) => stream.streamIndex);
    const audioPreparation =
      audioStreamIndexes.length <= 1
        ? Promise.resolve().then(() => {
            if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
              dispatch(audioPreviewsReady({ previews: [] }));
            }
          })
        : (async () => {
            dispatch(audioPreviewsLoading());
            try {
              const previews = await prepareAudioPreviews(source.sourcePath, audioStreamIndexes);
              if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
                dispatch(audioPreviewsReady({ previews }));
              }
            } catch (error: unknown) {
              if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
                dispatch(
                  audioPreviewsUnavailable({
                    error: normalizeAppError(error),
                  }),
                );
              }
            }
          })();

    dispatch(previewLoading({ kind: "source" }));
    const previewPreparation = (async () => {
      try {
        const preview = await prepareSourcePreview(source.sourcePath);
        if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
          dispatch(previewReady({ preview }));
        }
      } catch (error: unknown) {
        const normalized = normalizeAppError(error);
        if (!isCurrentSource(getState(), source.sourcePath, loadToken)) return;
        dispatch(
          isSourceInspectionError(normalized)
            ? sourceFailed({ loadToken, error: normalized })
            : previewFailed({ error: normalized }),
        );
      }
    })();

    await Promise.all([audioPreparation, previewPreparation]);
  };

function captureActiveQueueItemDraft(
  dispatch: Parameters<AppThunk>[0],
  getState: Parameters<AppThunk>[1],
) {
  const state = getState();
  const activeItem = selectActiveQueueItem(state);
  const source = selectSourceSelection(state);
  const trim = selectTrim(state);
  if (!activeItem || !source || !trim || !state.source.media) return;

  dispatch(
    queueItemSnapshotUpdated({
      id: activeItem.id,
      snapshot: createEditorSnapshot({
        source,
        trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
        crop: selectCrop(state),
        masterAudio: selectMasterAudio(state),
        audioTracks: selectAudioTracks(state).map(({ streamIndex, enabled, volumePercent }) => ({
          streamIndex,
          enabled,
          volumePercent,
        })),
        mergeAudio: selectMergeAudio(state),
      }),
    }),
  );
}

export const leaveActiveImportedItem = (): AppThunk => (dispatch, getState) => {
  const activeItem = selectActiveQueueItem(getState());
  if (!activeItem || activeItem.status !== "imported") return;

  if (activeItem.origin === "source-import") {
    captureActiveQueueItemDraft(dispatch, getState);
  } else {
    dispatch(importedQueueItemRemoved(activeItem.id));
  }
};

async function restoreImportedQueueItem(
  item: ImportedQueueItem,
  dispatch: Parameters<AppThunk>[0],
  getState: Parameters<AppThunk>[1],
  restorationId: number,
): Promise<ImportedItemRestoreResult> {
  let source: SourceRef;
  try {
    source = await importSourcePath(item.snapshot.source.sourcePath);
  } catch (error: unknown) {
    return restorationId === queueRestoreSequence
      ? { status: "failed", error: normalizeAppError(error) }
      : { status: "stale" };
  }

  if (restorationId !== queueRestoreSequence) return { status: "stale" };

  await dispatch(
    importSource(source, item.snapshot.audio.mergeAudio, {
      registerQueueItem: false,
      captureCurrentDraft: false,
      leaveActiveItem: false,
    }),
  );
  if (restorationId !== queueRestoreSequence) return { status: "stale" };

  const state = getState();
  if (
    state.source.status !== "ready" ||
    state.source.source?.sourcePath !== item.snapshot.source.sourcePath ||
    !state.source.media
  ) {
    return {
      status: "failed",
      error:
        state.source.error ??
        ({
          code: "source_restore_failed",
          message: "The selected source could not be restored.",
        } satisfies AppError),
    };
  }

  applyEditorSnapshot(dispatch, getState, item.snapshot);
  dispatch(activeQueueItemChanged(item.id));
  return { status: "succeeded" };
}

export const switchImportedQueueItemRequested =
  (id: string): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    const item = getState().export.queue.find(
      (candidate): candidate is ImportedQueueItem =>
        candidate.id === id && candidate.status === "imported",
    );
    if (!item || getState().export.activeItemId === id) return false;
    const restorationId = ++queueRestoreSequence;
    const previousActiveItem = selectActiveQueueItem(getState());
    const rollbackItemId =
      previousActiveItem?.status === "imported" && previousActiveItem.origin === "source-import"
        ? previousActiveItem.id
        : null;

    dispatch(leaveActiveImportedItem());
    const targetResult = await restoreImportedQueueItem(item, dispatch, getState, restorationId);
    if (targetResult.status === "succeeded") return true;
    if (targetResult.status === "stale") return false;

    const rollbackItem = rollbackItemId
      ? getState().export.queue.find(
          (candidate): candidate is ImportedQueueItem =>
            candidate.id === rollbackItemId &&
            candidate.status === "imported" &&
            candidate.origin === "source-import",
        )
      : undefined;
    if (rollbackItem) {
      const rollbackResult = await restoreImportedQueueItem(
        rollbackItem,
        dispatch,
        getState,
        restorationId,
      );
      if (rollbackResult.status === "stale") return false;
      if (rollbackResult.status === "failed") {
        dispatch(
          sourceErrorReported({
            ...targetResult.error,
            diagnostics: [
              targetResult.error.diagnostics,
              `Rollback failed (${rollbackResult.error.code}): ${rollbackResult.error.message}`,
            ]
              .filter(Boolean)
              .join("\n"),
          }),
        );
        return false;
      }
    }
    dispatch(sourceErrorReported(targetResult.error));
    return false;
  };

export const chooseSourceRequested = (): AppThunk => async (dispatch, getState) => {
  if (getState().importWorkflow.isChoosingSource || getState().importWorkflow.isNativeDialogOpen) {
    return;
  }

  dispatch(sourceChoiceStarted());
  let source: SourceRef | null = null;
  let pickerError: AppError | null = null;

  try {
    source = await chooseSourceDialog();
  } catch (error: unknown) {
    pickerError = normalizeAppError(error);
  } finally {
    // The native picker has resolved here. Import inspection and dependent media
    // preparation must not extend the native-dialog workflow state.
    dispatch(sourceChoiceFinished());
  }

  if (pickerError) {
    dispatch(sourceFailed({ error: pickerError }));
    return;
  }

  if (source) {
    await dispatch(importSource(source));
  }
};

export const closeActiveImportedItemRequested =
  (): AppThunk<Promise<void>> => async (dispatch, getState) => {
    const state = getState();
    const activeItem = selectActiveQueueItem(state);

    if (!activeItem || activeItem.status !== "imported") {
      if (!selectHasSource(state)) return;
      dispatch(sourceCleared());
      dispatch(nativeDialogStateChanged(false));
      return;
    }

    const importedItems = selectImportedQueueItems(state);
    const activeIndex = importedItems.findIndex((item) => item.id === activeItem.id);
    const replacementItem =
      importedItems[activeIndex + 1] ?? importedItems[activeIndex - 1] ?? null;
    const restorationId = ++queueRestoreSequence;

    dispatch(importedQueueItemRemoved(activeItem.id));
    if (!replacementItem) {
      dispatch(sourceCleared());
      dispatch(nativeDialogStateChanged(false));
      return;
    }

    dispatch(sourceCleared());
    const restoreResult = await restoreImportedQueueItem(
      replacementItem,
      dispatch,
      getState,
      restorationId,
    );
    if (restoreResult.status === "failed") dispatch(sourceErrorReported(restoreResult.error));
    dispatch(nativeDialogStateChanged(false));
  };

export const handlePreviewPlaybackError =
  (sourcePath: string, previewKind: PreviewKind): AppThunk =>
  async (dispatch, getState) => {
    const loadToken = getState().source.loadToken;
    if (!isCurrentSource(getState(), sourcePath, loadToken)) return;
    if (previewKind === "proxy") {
      dispatch(
        previewFailed({
          error: {
            code: "preview_playback_failed",
            message: "The compatible preview could not be played.",
          },
        }),
      );
      return;
    }

    dispatch(previewLoading({ kind: "proxy" }));
    try {
      const preview = await prepareProxyPreview(sourcePath);
      if (isCurrentSource(getState(), sourcePath, loadToken)) {
        dispatch(previewReady({ preview }));
      }
    } catch (error: unknown) {
      if (isCurrentSource(getState(), sourcePath, loadToken)) {
        dispatch(previewFailed({ error: normalizeAppError(error) }));
      }
    }
  };

export const prepareSourceWaveforms =
  (sourcePath: string, streamIndexes: number[], width: number): AppThunk<Promise<string | null>> =>
  async (dispatch, getState) => {
    const loadToken = getState().source.loadToken;
    if (streamIndexes.length === 0 || !isCurrentSource(getState(), sourcePath, loadToken))
      return null;

    const jobId = `waveform-${++waveformJobSequence}`;
    dispatch(waveformsLoading({ jobId, width, streamIndexes }));
    try {
      const results = await prepareWaveforms(sourcePath, jobId, streamIndexes, width);
      if (isCurrentSource(getState(), sourcePath, loadToken)) {
        results.forEach((result) => dispatch(waveformReady(result)));
      }
    } catch (error: unknown) {
      if (isCurrentSource(getState(), sourcePath, loadToken)) {
        dispatch(
          waveformsFailed({
            jobId,
            width,
            streamIndexes,
            error: normalizeAppError(error),
          }),
        );
      }
    }
    return jobId;
  };
