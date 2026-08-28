import { importQueueItemActivationRequested } from "@/app/store/actions/imported-queue-actions";
import {
  sourceCleared,
  sourceErrorReported,
  sourceFailed,
  sourceReady,
  sourceSelected,
} from "@/app/store/actions/source-actions";
import { applyEditorSnapshot, createDefaultEditorSnapshot } from "@/app/store/editor-snapshot";
import {
  audioPreviewsLoading,
  audioPreviewsReady,
  audioPreviewsUnavailable,
  selectAudioTracks,
  selectMasterAudio,
  selectMergeAudio,
  waveformReady,
  waveformsFailed,
  waveformsLoading,
} from "@/app/store/slices/audio-slice";
import { selectCrop } from "@/app/store/slices/crop-slice";
import {
  activeQueueItemChanged,
  importQueueItemRemoved,
  importQueueItemsAdded,
  queueItemSnapshotUpdated,
  selectActiveQueueItem,
  selectimportQueueItems,
  type importQueueItem,
} from "@/app/store/slices/export-slice";
import {
  dropListenerErrorCleared,
  nativeDialogStateChanged,
  sourceChoiceFinished,
  sourceChoiceStarted,
} from "@/app/store/slices/import-workflow-slice";
import { selectMergeAudioEnabledDefault } from "@/app/store/slices/preferences-slice";
import { previewFailed, previewLoading, previewReady } from "@/app/store/slices/preview-slice";
import {
  capabilitiesFailed,
  capabilitiesReady,
  selectHasSource,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import type { AppDispatch, RootState } from "@/app/store/store";
import { createEditorSnapshot } from "@/domain/editor-snapshot";
import type { SourceRef } from "@/domain/source";
import { getReplacementImportedItem } from "@/features/import-source/utils/imported-queue";
import {
  activateSourcePath,
  checkMediaCapabilities,
  chooseSource as chooseSourceDialog,
  inspectMedia,
  normalizeAppError,
  prepareAudioPreviews,
  prepareProxyPreview,
  prepareSourcePreview,
  prepareWaveforms,
  type AppError,
  type PreviewKind,
} from "@/lib/tauri/media";

export type AppThunk<ReturnValue = void | Promise<unknown>> = (
  dispatch: AppDispatch,
  getState: () => RootState,
) => ReturnValue;

let waveformJobSequence = 0;
let sourceLoadSequence = 0;
let importedItemSequence = 0;
let queueRestoreSequence = 0;

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

export const ingestSources =
  (sources: SourceRef[]): AppThunk =>
  (dispatch, getState) => {
    if (sources.length === 0) return;

    const mergeAudio = selectMergeAudioEnabledDefault(getState());
    const items: importQueueItem[] = sources.map((source) => ({
      id: `import-${++importedItemSequence}`,
      status: "imported",
      origin: "source-import",
      snapshot: createDefaultEditorSnapshot(source, mergeAudio),
    }));

    dispatch(dropListenerErrorCleared());
    dispatch(importQueueItemsAdded(items));
    dispatch(navigateToImportedItem(items[0]!.id));
  };

export const activateSource =
  (source: SourceRef, mergeAudio?: boolean): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    const selectedMergeAudio = mergeAudio ?? getState().preferences.mergeAudioEnabledDefault;
    const loadToken = ++sourceLoadSequence;
    dispatch(sourceSelected({ source, mergeAudio: selectedMergeAudio, loadToken }));

    let media;
    try {
      media = await inspectMedia(source.sourcePath);
    } catch (error: unknown) {
      const normalized = normalizeAppError(error);
      if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
        dispatch(sourceFailed({ loadToken, error: normalized }));
      }
      return false;
    }

    if (!isCurrentSource(getState(), source.sourcePath, loadToken)) return false;
    dispatch(sourceReady({ loadToken, media }));

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
    return true;
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
    dispatch(importQueueItemRemoved(activeItem.id));
  }
};

export const restoreActiveImportedItemRequested =
  (id: string): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    const item = getState().export.queue.find(
      (candidate): candidate is importQueueItem =>
        candidate.id === id && candidate.status === "imported",
    );
    if (!item || getState().export.activeItemId !== id) return false;

    const restorationId = queueRestoreSequence;
    let source: SourceRef;
    try {
      source = await activateSourcePath(item.snapshot.source.sourcePath);
    } catch (error: unknown) {
      if (restorationId !== queueRestoreSequence || getState().export.activeItemId !== id) {
        return false;
      }
      dispatch(sourceErrorReported(normalizeAppError(error)));
      return false;
    }

    if (restorationId !== queueRestoreSequence || getState().export.activeItemId !== id) {
      return false;
    }

    await dispatch(activateSource(source, item.snapshot.audio.mergeAudio));
    if (restorationId !== queueRestoreSequence || getState().export.activeItemId !== id) {
      return false;
    }

    const state = getState();
    if (
      state.source.status !== "ready" ||
      state.source.source?.sourcePath !== item.snapshot.source.sourcePath ||
      !state.source.media
    ) {
      dispatch(
        sourceErrorReported(
          state.source.error ?? {
            code: "source_restore_failed",
            message: "The selected source could not be restored.",
          },
        ),
      );
      return false;
    }

    applyEditorSnapshot(dispatch, getState, item.snapshot);
    return true;
  };

export const navigateToImportedItem =
  (id: string | null): AppThunk<boolean> =>
  (dispatch, getState) => {
    const state = getState();
    const target = id
      ? state.export.queue.find(
          (candidate): candidate is importQueueItem =>
            candidate.id === id && candidate.status === "imported",
        )
      : null;
    if (id !== null && !target) return false;
    if (state.export.activeItemId === id && (id !== null || !selectHasSource(state))) return false;

    queueRestoreSequence += 1;
    dispatch(leaveActiveImportedItem());
    dispatch(sourceCleared());
    dispatch(activeQueueItemChanged(id));
    if (id !== null) dispatch(importQueueItemActivationRequested({ id }));
    return true;
  };

export const chooseSourceRequested = (): AppThunk => async (dispatch, getState) => {
  if (getState().importWorkflow.isChoosingSource || getState().importWorkflow.isNativeDialogOpen) {
    return;
  }

  dispatch(sourceChoiceStarted());
  let sources: SourceRef[] = [];
  let pickerError: AppError | null = null;

  try {
    sources = await chooseSourceDialog();
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

  if (sources.length > 0) {
    dispatch(ingestSources(sources));
  }
};

export const closeActiveImportedItemRequested = (): AppThunk => (dispatch, getState) => {
  queueRestoreSequence += 1;
  const state = getState();
  const activeItem = selectActiveQueueItem(state);

  if (!activeItem || activeItem.status !== "imported") {
    if (!selectHasSource(state)) return;
    dispatch(sourceCleared());
    dispatch(nativeDialogStateChanged(false));
    return;
  }

  const importedItems = selectimportQueueItems(state);
  const activeIndex = importedItems.findIndex((item) => item.id === activeItem.id);
  const replacementItem = getReplacementImportedItem(importedItems, activeIndex);

  dispatch(importQueueItemRemoved(activeItem.id));
  dispatch(navigateToImportedItem(replacementItem?.id ?? null));
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
