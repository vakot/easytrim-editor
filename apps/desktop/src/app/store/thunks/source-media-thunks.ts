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
import { diagnostics } from "@/lib/diagnostics";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";
import {
  activateSourcePath,
  checkMediaCapabilities,
  chooseSource as chooseSourceDialog,
  inspectMedia,
  moveSourceToTrash,
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
  const operation = diagnostics.startOperation("media.capabilities", {
    origin: { type: "system" },
  });

  try {
    const capabilities = await checkMediaCapabilities();
    dispatch(capabilitiesReady(capabilities));
    operation.complete({
      ffmpeg: capabilities.ffmpeg.available,
      ffprobe: capabilities.ffprobe.available,
    });
  } catch (error: unknown) {
    const normalized = normalizeAppError(error);
    operation.fail(normalized);
    dispatch(capabilitiesFailed(normalized));
  }
};

export const ingestSources =
  (sources: SourceRef[], origin: DiagnosticOrigin = { type: "internal" }): AppThunk =>
  (dispatch, getState) => {
    diagnostics.action("source.import.requested", origin, { sourceCount: sources.length });
    if (sources.length === 0) {
      diagnostics.event("source.import.ignored", {
        data: { reason: "empty_selection" },
        origin,
        result: "ignored",
      });
      return;
    }

    const mergeAudio = selectMergeAudioEnabledDefault(getState());
    const items: importQueueItem[] = sources.map((source) => ({
      id: `import-${++importedItemSequence}`,
      status: "imported",
      origin: "source-import",
      snapshot: createDefaultEditorSnapshot(source, mergeAudio),
    }));

    dispatch(dropListenerErrorCleared());
    dispatch(importQueueItemsAdded(items));
    dispatch(navigateToImportedItem(items[0]!.id, origin));
  };

async function prepareSelectedSource(
  dispatch: AppDispatch,
  getState: () => RootState,
  source: SourceRef,
  loadToken: number,
  snapshot?: EditorSnapshot,
): Promise<EditorSnapshot | null> {
  const operation = diagnostics.startOperation("source.prepare", {
    data: { displayName: source.displayName },
    origin: { type: "internal" },
  });

  const probeOperation = operation.child("ffprobe.inspect", {
    data: { displayName: source.displayName },
  });

  let media;
  try {
    media = await inspectMedia(source.sourcePath);
    probeOperation.complete({ audioStreamCount: media.audioStreams.length });
  } catch (error: unknown) {
    const normalized = normalizeAppError(error);
    probeOperation.fail(normalized);
    operation.fail(normalized);
    if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
      dispatch(sourceFailed({ loadToken, error: normalized }));
    }
    return null;
  }

  if (!isCurrentSource(getState(), source.sourcePath, loadToken)) {
    operation.cancel({ reason: "source_replaced" });
    return null;
  }
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
  let preparationFailed = false;
  const audioOperation = operation.child("audio.preview", {
    data: { streamCount: audioStreamIndexes.length },
  });

  const audioPreparation =
    audioStreamIndexes.length <= 1
      ? Promise.resolve().then(() => {
          if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
            dispatch(audioPreviewsReady({ previews: [] }));
            audioOperation.complete({ previewCount: 0 });
          } else {
            audioOperation.cancel({ reason: "source_replaced" });
          }
        })
      : (async () => {
          dispatch(audioPreviewsLoading());
          try {
            const previews = await prepareAudioPreviews(source.sourcePath, audioStreamIndexes);
            if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
              dispatch(audioPreviewsReady({ previews }));
              audioOperation.complete({ previewCount: previews.length });
            } else {
              audioOperation.cancel({ reason: "source_replaced" });
            }
          } catch (error: unknown) {
            preparationFailed = true;
            audioOperation.fail(error);
            if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
              dispatch(
                audioPreviewsUnavailable({
                  error: normalizeAppError(error),
                }),
              );
            }
          }
        })();

  const previewOperation = operation.child("preview.prepare", {
    data: { kind: "source" },
  });

  const previewPreparation = (async () => {
    try {
      const preview = await prepareSourcePreview(source.sourcePath);
      if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
        dispatch(previewReady({ preview }));
        previewOperation.complete({ kind: preview.kind });
      } else {
        previewOperation.cancel({ reason: "source_replaced" });
      }
    } catch (error: unknown) {
      const normalized = normalizeAppError(error);
      preparationFailed = true;
      previewOperation.fail(normalized);
      if (!isCurrentSource(getState(), source.sourcePath, loadToken)) return;
      dispatch(previewFailed({ error: normalized }));
    }
  })();

  await Promise.all([audioPreparation, previewPreparation]);
  if (!isCurrentSource(getState(), source.sourcePath, loadToken)) {
    operation.cancel({ reason: "source_replaced" });
    return null;
  }
  if (preparationFailed) {
    operation.fail({
      code: "source_prepare_failed",
      message: "One or more media previews failed to prepare.",
    });
    return null;
  }
  const result =
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
    });

  operation.complete({ audioStreamCount: audioStreamIndexes.length });
  return result;
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
  (id: string | null, origin: DiagnosticOrigin = { type: "internal" }): AppThunk<boolean> =>
  (dispatch, getState) => {
    diagnostics.action("snapshot.select.requested", origin, id ? { snapshotId: id } : undefined);
    const state = getState();
    const target = id
      ? state.export.queue.find(
          (candidate): candidate is importQueueItem =>
            candidate.id === id && candidate.status === "imported",
        )
      : null;

    if (id !== null && !target) {
      diagnostics.event("snapshot.select.ignored", {
        data: { reason: "snapshot_not_found", snapshotId: id },
        origin,
        result: "ignored",
      });
      return false;
    }
    if (state.export.activeItemId === id && (id !== null || !selectHasSource(state))) {
      diagnostics.event("snapshot.select.ignored", {
        data: { reason: "already_active", ...(id ? { snapshotId: id } : {}) },
        origin,
        result: "ignored",
      });
      return false;
    }

    dispatch(leaveActiveImportedItem());
    const operation = diagnostics.startOperation("snapshot.switch", {
      origin,
      snapshotId: id ?? undefined,
    });

    if (target) {
      void dispatch(activateImportedItemRequested(target)).then(
        (restored) => {
          if (restored) operation.complete({ itemId: target.id });
          else
            operation.fail(new Error("Snapshot restoration did not complete."), {
              itemId: target.id,
            });
        },
        (error: unknown) => operation.fail(error, { itemId: target.id }),
      );
    } else {
      queueRestoreSequence += 1;
      dispatch(sourceCleared());
      dispatch(activeQueueItemChanged(null));
      operation.complete({ reason: "cleared" });
    }
    return true;
  };

export const chooseSourceRequested =
  (origin: DiagnosticOrigin = { type: "internal" }): AppThunk =>
  async (dispatch, getState) => {
    diagnostics.action("source.open.requested", origin);
    if (
      getState().importWorkflow.isChoosingSource ||
      getState().importWorkflow.isNativeDialogOpen
    ) {
      diagnostics.event("source.open.ignored", {
        data: { reason: "native_dialog_active" },
        origin,
        result: "ignored",
      });
      return;
    }

    const operation = diagnostics.startOperation("source.open", { origin });
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
      operation.fail(pickerError);
      dispatch(sourceFailed({ error: pickerError }));
      return;
    }

    if (sources.length > 0) {
      dispatch(ingestSources(sources, origin));
      operation.complete({ sourceCount: sources.length });
    } else {
      operation.cancel({ reason: "picker_cancelled" });
    }
  };

export const closeActiveImportedItemRequested =
  (origin: DiagnosticOrigin = { type: "internal" }): AppThunk =>
  (dispatch, getState) => {
    diagnostics.action("snapshot.close.requested", origin);
    const state = getState();
    const activeItem = selectActiveQueueItem(state);

    if (!activeItem || activeItem.status !== "imported") {
      if (!selectHasSource(state)) {
        diagnostics.event("snapshot.close.ignored", {
          data: { reason: "no_active_source" },
          origin,
          result: "ignored",
        });
        return;
      }
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

export const deleteActiveImportedItemRequested =
  (itemId?: string): AppThunk<Promise<AppError | null>> =>
  async (dispatch, getState) => {
    const state = getState();
    const item = itemId
      ? selectImportQueueItems(state).find((queueItem) => queueItem.id === itemId)
      : selectActiveQueueItem(state);

    if (!item || item.status !== "imported") {
      diagnostics.event("source.file.delete.ignored", {
        data: { reason: "no_active_source" },
        origin: { type: "button", id: "source.delete" },
        result: "ignored",
      });
      return null;
    }

    const sourcePath = item.snapshot.source.sourcePath;
    const operation = diagnostics.startOperation("source.file-delete", {
      data: { itemId: item.id, sourcePath },
      origin: { type: "button", id: "source.delete" },
      snapshotId: item.id,
    });

    try {
      await moveSourceToTrash(sourcePath);
    } catch (error: unknown) {
      const normalized = normalizeAppError(error);
      operation.fail(normalized, { itemId: item.id, sourcePath });
      dispatch(sourceErrorReported(normalized));
      return normalized;
    }

    if (selectActiveQueueItem(getState())?.id === item.id) {
      dispatch(closeActiveImportedItemRequested());
    } else {
      dispatch(importQueueItemRemoved(item.id));
    }
    operation.complete({ itemId: item.id, sourcePath });
    return null;
  };

export const handlePreviewPlaybackError =
  (sourcePath: string, previewKind: PreviewKind): AppThunk =>
  async (dispatch, getState) => {
    const loadToken = getState().source.loadToken;
    diagnostics.event("preview.playback.failed", {
      data: { kind: previewKind },
      origin: { type: "system" },
      result: "failed",
    });
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

    const operation = diagnostics.startOperation("preview.proxy", {
      data: { fallback: true },
      origin: { type: "system" },
    });

    dispatch(previewLoading({ kind: "proxy" }));
    try {
      const preview = await prepareProxyPreview(sourcePath);
      if (isCurrentSource(getState(), sourcePath, loadToken)) {
        dispatch(previewReady({ preview }));
        operation.complete({ kind: preview.kind });
      } else {
        operation.cancel({ reason: "source_replaced" });
      }
    } catch (error: unknown) {
      operation.fail(error);
      if (isCurrentSource(getState(), sourcePath, loadToken)) {
        dispatch(previewFailed({ error: normalizeAppError(error) }));
      }
    }
  };

export const prepareSourceWaveforms =
  (sourcePath: string, streamIndexes: number[], width: number): AppThunk<Promise<string | null>> =>
  async (dispatch, getState) => {
    const loadToken = getState().source.loadToken;
    diagnostics.action(
      "waveform.generate.requested",
      { type: "internal" },
      {
        streamCount: streamIndexes.length,
        width,
      },
    );
    if (streamIndexes.length === 0) {
      diagnostics.event("waveform.generate.ignored", {
        data: { reason: "no_audio_streams" },
        origin: { type: "internal" },
        result: "ignored",
      });
      return null;
    }
    if (!isCurrentSource(getState(), sourcePath, loadToken)) {
      diagnostics.event("waveform.generate.cancelled", {
        data: { reason: "source_replaced" },
        origin: { type: "internal" },
        result: "cancelled",
      });
      return null;
    }

    const jobId = `waveform-${++waveformJobSequence}`;
    const operation = diagnostics.startOperation("waveform.generate", {
      data: { streamCount: streamIndexes.length, width },
      origin: { type: "internal" },
    });

    dispatch(waveformsLoading({ jobId, width, streamIndexes }));
    try {
      const results = await prepareWaveforms(sourcePath, jobId, streamIndexes, width);
      if (isCurrentSource(getState(), sourcePath, loadToken)) {
        results.forEach((result) => dispatch(waveformReady(result)));
        operation.complete({ resultCount: results.length });
      } else {
        operation.cancel({ reason: "source_replaced" });
      }
    } catch (error: unknown) {
      operation.fail(error);
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
