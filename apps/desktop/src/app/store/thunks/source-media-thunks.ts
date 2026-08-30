import { importQueueItemActivated } from "@/app/store/actions/imported-queue-actions";
import {
  sourceCleared,
  sourceErrorReported,
  sourceFailed,
  sourceReady,
} from "@/app/store/actions/source-actions";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import { getReplacementImportedItem } from "@/app/store/lib/imported-queue";
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
  type importQueueItem,
  importQueueItemRemoved,
  importQueueItemsAdded,
  queueItemSnapshotUpdated,
  selectActiveQueueItem,
  selectImportQueueItems,
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
import { createEditorSnapshot, type EditorSnapshot } from "@/domain/editor-snapshot";
import type { SourceRef } from "@/domain/source";
import {
  activateSourcePath,
  checkMediaCapabilities,
  chooseSource as chooseSourceDialog,
  inspectMedia,
  prepareAudioPreviews,
  prepareProxyPreview,
  prepareSourcePreview,
  prepareWaveforms,
} from "@/lib/tauri/media";
import type { AppError, PreviewKind } from "@/lib/tauri/media.types";
import { normalizeAppError } from "@/lib/tauri/media.utils";

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

async function prepareSelectedSource(
  dispatch: AppDispatch,
  getState: () => RootState,
  source: SourceRef,
  loadToken: number,
  snapshot?: EditorSnapshot,
): Promise<EditorSnapshot | null> {
  let media;
  try {
    media = await inspectMedia(source.sourcePath);
  } catch (error: unknown) {
    const normalized = normalizeAppError(error);
    if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
      dispatch(sourceFailed({ loadToken, error: normalized }));
    }
    return null;
  }

  if (!isCurrentSource(getState(), source.sourcePath, loadToken)) return null;
  const readySnapshot = snapshot
    ? createEditorSnapshot({
        source,
        trim: snapshot.trim,
        crop: snapshot.crop,
        masterAudio: snapshot.audio.master,
        audioTracks: snapshot.audio.tracks,
        mergeAudio: snapshot.audio.mergeAudio,
      })
    : undefined;

  dispatch(sourceReady({ loadToken, media, snapshot: readySnapshot }));

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

  const previewPreparation = (async () => {
    try {
      const preview = await prepareSourcePreview(source.sourcePath);
      if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
        dispatch(previewReady({ preview }));
      }
    } catch (error: unknown) {
      const normalized = normalizeAppError(error);
      if (!isCurrentSource(getState(), source.sourcePath, loadToken)) return;
      dispatch(previewFailed({ error: normalized }));
    }
  })();

  await Promise.all([audioPreparation, previewPreparation]);
  if (!isCurrentSource(getState(), source.sourcePath, loadToken)) return null;
  return (
    readySnapshot ??
    createEditorSnapshot({
      source,
      trim: { kind: "full-source" },
      crop: null,
      masterAudio: selectMasterAudio(getState()),
      audioTracks: selectAudioTracks(getState()).map(({ enabled, streamIndex, volumePercent }) => ({
        enabled,
        streamIndex,
        volumePercent,
      })),
      mergeAudio: selectMergeAudio(getState()),
    })
  );
}

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
      media: state.source.media,
      snapshot: createEditorSnapshot({
        source,
        trim: { startMicros: trim.startMicros, endMicros: trim.endMicros },
        crop: selectCrop(state),
        masterAudio: selectMasterAudio(state),
        audioTracks: selectAudioTracks(state).map(({ enabled, streamIndex, volumePercent }) => ({
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
  (id: string, loadToken: number, snapshot: EditorSnapshot): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    const item = getState().export.queue.find(
      (candidate): candidate is importQueueItem =>
        candidate.id === id && candidate.status === "imported",
    );

    if (
      !item ||
      getState().export.activeItemId !== id ||
      getState().source.loadToken !== loadToken
    ) {
      return false;
    }

    const restorationId = queueRestoreSequence;
    let source: SourceRef;
    try {
      source = await activateSourcePath(item.snapshot.source.sourcePath);
    } catch (error: unknown) {
      if (restorationId !== queueRestoreSequence || getState().export.activeItemId !== id) {
        return false;
      }
      dispatch(sourceFailed({ loadToken, error: normalizeAppError(error) }));
      return false;
    }

    if (restorationId !== queueRestoreSequence || getState().export.activeItemId !== id) {
      return false;
    }

    const readySnapshot = await prepareSelectedSource(
      dispatch,
      getState,
      source,
      loadToken,
      snapshot,
    );

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

    if (readySnapshot) {
      dispatch(
        queueItemSnapshotUpdated({ id, media: state.source.media, snapshot: readySnapshot }),
      );
    }
    return true;
  };

export const activateImportedItemRequested =
  (item: importQueueItem): AppThunk<Promise<boolean>> =>
  async (dispatch) => {
    const loadToken = ++sourceLoadSequence;
    queueRestoreSequence += 1;
    dispatch(
      importQueueItemActivated({
        id: item.id,
        loadToken,
        media: item.media,
        snapshot: item.snapshot,
      }),
    );
    return dispatch(restoreActiveImportedItemRequested(item.id, loadToken, item.snapshot));
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

    dispatch(leaveActiveImportedItem());
    if (target) {
      void dispatch(activateImportedItemRequested(target));
    } else {
      queueRestoreSequence += 1;
      dispatch(sourceCleared());
      dispatch(activeQueueItemChanged(null));
    }
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
  const state = getState();
  const activeItem = selectActiveQueueItem(state);

  if (!activeItem || activeItem.status !== "imported") {
    if (!selectHasSource(state)) return;
    dispatch(sourceCleared());
    dispatch(nativeDialogStateChanged(false));
    return;
  }

  const importedItems = selectImportQueueItems(state);
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
