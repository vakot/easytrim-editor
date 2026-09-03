import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import {
  sourceCleared,
  sourceErrorReported,
  sourceFailed,
  sourceReady,
} from "@/app/store/actions/source-actions";
import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  cancelInstanceExports,
  hasActiveExportForSource,
} from "@/app/store/integration/export-queue-runtime";
import { getReplacementEditingInstance } from "@/app/store/lib/editing-instances";
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
  activeEditingInstanceChanged,
  editingInstanceClosed,
  editingInstancesAdded,
  editingInstanceSnapshotUpdated,
  editingInstancesSourceAvailabilityChanged,
  selectActiveEditingInstance,
  selectActiveInstanceId,
  selectEditingInstanceById,
  selectEditingInstances,
  selectInstanceIdsBySourceKey,
} from "@/app/store/slices/editing-instances-slice";
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
import type { EditingInstance } from "@/domain/editing-instance";
import { createEditorSnapshot, type EditorSnapshot } from "@/domain/editor-snapshot";
import type { SourceRef } from "@/domain/source";
import { normalizeSourceKey } from "@/domain/source";
import { type DiagnosticOperation, diagnostics } from "@/lib/diagnostics";
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
  restoreSourceFromTrash,
} from "@/lib/tauri/media";
import type {
  AppError,
  MediaInfo,
  PreviewKind,
  SourceImportResult,
  SourcePickerMode,
} from "@/lib/tauri/media.types";
import { normalizeAppError } from "@/lib/tauri/media.utils";

export type AppThunk<ReturnValue = void | Promise<unknown>> = (
  dispatch: AppDispatch,
  getState: () => RootState,
) => ReturnValue;

let waveformJobSequence = 0;
let sourceLoadSequence = 0;
let editingInstanceSequence = 0;
let queueRestoreSequence = 0;

function isCurrentSource(state: RootState, sourcePath: string, loadToken: number): boolean {
  const activeInstance = selectActiveEditingInstance(state);
  const activeInstanceMatchesSource =
    activeInstance &&
    normalizeSourceKey(activeInstance.snapshot.source.sourcePath) ===
      normalizeSourceKey(sourcePath);

  return (
    normalizeSourceKey(selectSourceSelection(state)?.sourcePath ?? "") ===
      normalizeSourceKey(sourcePath) &&
    state.source.loadToken === loadToken &&
    (!activeInstanceMatchesSource || activeInstance.sourceAvailability === "available")
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
  (
    input: SourceImportResult | SourceRef[],
    origin: DiagnosticOrigin = { type: "internal" },
    importOperation?: DiagnosticOperation,
  ): AppThunk =>
  (dispatch, getState) => {
    const result = normalizeSourceImportResult(input);
    const operation = importOperation ?? diagnostics.startOperation("source.import", { origin });
    operation.event("source.import.requested", {
      data: importResultData(result),
      origin,
    });

    if (result.sources.length === 0) {
      operation.complete(importResultData(result));
      dispatch(dropListenerErrorCleared());
      return;
    }

    const mergeAudio = selectMergeAudioEnabledDefault(getState());
    const instances: EditingInstance[] = result.sources.map((source) => ({
      exportAttempts: [],
      id: `instance-${++editingInstanceSequence}`,
      origin: "source-import",
      snapshot: createDefaultEditorSnapshot(source, mergeAudio),
      sourceAvailability: "available",
    }));

    dispatch(dropListenerErrorCleared());
    dispatch(editingInstancesAdded(instances));
    dispatch(navigateToEditingInstance(instances[0]!.id, origin));
    operation.complete(importResultData(result));
  };

function normalizeSourceImportResult(input: SourceImportResult | SourceRef[]): SourceImportResult {
  if (Array.isArray(input)) {
    return {
      acceptedFileCount: input.length,
      directFileCount: input.length,
      discoveredFileCount: 0,
      folderCount: 0,
      readErrorCount: 0,
      recursive: false,
      skippedFileCount: 0,
      sources: input,
      truncated: false,
    };
  }
  return input;
}

function importResultData(result: SourceImportResult): Record<string, boolean | number | string> {
  return {
    acceptedFileCount: result.acceptedFileCount,
    directFileCount: result.directFileCount,
    discoveredFileCount: result.discoveredFileCount,
    folderCount: result.folderCount,
    readErrorCount: result.readErrorCount,
    recursive: result.recursive,
    skippedFileCount: result.skippedFileCount,
    truncated: result.truncated,
    ...(result.truncationReason ? { truncationReason: result.truncationReason } : {}),
  };
}

async function prepareSelectedSource(
  dispatch: AppDispatch,
  getState: () => RootState,
  source: SourceRef,
  loadToken: number,
  snapshot?: EditorSnapshot,
  cachedMedia?: MediaInfo,
): Promise<EditorSnapshot | null> {
  const operation = diagnostics.startOperation("source.prepare", {
    data: { displayName: source.displayName },
    origin: { type: "internal" },
  });

  let media = cachedMedia;
  if (!media) {
    const probeOperation = operation.child("ffprobe.inspect", {
      data: { displayName: source.displayName },
    });

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
      previewOperation.fail(normalized);
      if (!isCurrentSource(getState(), source.sourcePath, loadToken)) return;
      dispatch(previewFailed({ error: normalized }));
    }
  })();

  // Audio previews are optional. The direct video preview is the minimum
  // needed for activation; audio preparation continues without blocking it.
  await previewPreparation;
  if (!isCurrentSource(getState(), source.sourcePath, loadToken)) {
    operation.cancel({ reason: "source_replaced" });
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
  void audioPreparation;
  return result;
}

function captureActiveEditingInstanceDraft(
  dispatch: Parameters<AppThunk>[0],
  getState: Parameters<AppThunk>[1],
) {
  const state = getState();
  const activeInstance = selectActiveEditingInstance(state);
  const source = selectSourceSelection(state);
  const trim = selectTrim(state);
  if (!activeInstance || !source || !trim || !state.source.media) return;

  dispatch(
    editingInstanceSnapshotUpdated({
      id: activeInstance.id,
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

export const commitActiveEditingInstanceDraft = (): AppThunk => (dispatch, getState) => {
  captureActiveEditingInstanceDraft(dispatch, getState);
};

export const leaveActiveEditingInstance = (): AppThunk => (dispatch) => {
  dispatch(commitActiveEditingInstanceDraft());
};

export const restoreActiveEditingInstanceRequested =
  (id: string, loadToken: number, snapshot: EditorSnapshot): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    const instance = selectEditingInstanceById(getState(), id);

    if (
      !instance ||
      selectActiveInstanceId(getState()) !== id ||
      getState().source.loadToken !== loadToken
    ) {
      return false;
    }

    const restorationId = queueRestoreSequence;
    let source: SourceRef;
    try {
      source = await activateSourcePath(instance.snapshot.source.sourcePath, instance.media);
    } catch (error: unknown) {
      if (restorationId !== queueRestoreSequence || selectActiveInstanceId(getState()) !== id) {
        return false;
      }
      dispatch(sourceFailed({ loadToken, error: normalizeAppError(error) }));
      return false;
    }

    if (restorationId !== queueRestoreSequence || selectActiveInstanceId(getState()) !== id) {
      return false;
    }

    const readySnapshot = await prepareSelectedSource(
      dispatch,
      getState,
      source,
      loadToken,
      snapshot,
      instance.media,
    );

    if (restorationId !== queueRestoreSequence || selectActiveInstanceId(getState()) !== id) {
      return false;
    }

    const state = getState();
    if (
      state.source.status !== "ready" ||
      normalizeSourceKey(state.source.source?.sourcePath ?? "") !==
        normalizeSourceKey(instance.snapshot.source.sourcePath) ||
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
        editingInstanceSnapshotUpdated({ id, media: state.source.media, snapshot: readySnapshot }),
      );
    }
    return true;
  };

export const activateEditingInstanceRequested =
  (instance: EditingInstance): AppThunk<Promise<boolean>> =>
  async (dispatch) => {
    const loadToken = ++sourceLoadSequence;
    queueRestoreSequence += 1;
    dispatch(
      editingInstanceActivated({
        id: instance.id,
        loadToken,
        media: instance.media,
        snapshot: instance.snapshot,
      }),
    );
    return dispatch(
      restoreActiveEditingInstanceRequested(instance.id, loadToken, instance.snapshot),
    );
  };

export const navigateToEditingInstance =
  (id: string | null, origin: DiagnosticOrigin = { type: "internal" }): AppThunk<boolean> =>
  (dispatch, getState) => {
    diagnostics.action("snapshot.select.requested", origin, id ? { snapshotId: id } : undefined);
    const state = getState();
    const target = id ? selectEditingInstanceById(state, id) : null;

    if (id !== null && !target) {
      diagnostics.event("snapshot.select.ignored", {
        data: { reason: "snapshot_not_found", snapshotId: id },
        origin,
        result: "ignored",
      });
      return false;
    }
    if (selectActiveInstanceId(state) === id && (id !== null || !selectHasSource(state))) {
      diagnostics.event("snapshot.select.ignored", {
        data: { reason: "already_active", ...(id ? { snapshotId: id } : {}) },
        origin,
        result: "ignored",
      });
      return false;
    }

    dispatch(leaveActiveEditingInstance());
    const operation = diagnostics.startOperation("snapshot.switch", {
      origin,
      snapshotId: id ?? undefined,
    });

    if (target) {
      void dispatch(activateEditingInstanceRequested(target)).then(
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
      dispatch(activeEditingInstanceChanged(null));
      operation.complete({ reason: "cleared" });
    }
    return true;
  };

export const chooseSourceRequested =
  (
    origin: DiagnosticOrigin = { type: "internal" },
    pickerMode: SourcePickerMode = "files",
  ): AppThunk =>
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

    const operation = diagnostics.startOperation("source.import", { origin });
    dispatch(sourceChoiceStarted());
    let importResult: SourceImportResult | null = null;
    let pickerError: AppError | null = null;

    try {
      importResult = await chooseSourceDialog(pickerMode);
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

    if (importResult) {
      dispatch(ingestSources(importResult, origin, operation));
    } else {
      operation.cancel({ reason: "picker_cancelled" });
    }
  };

export const closeActiveEditingInstanceRequested =
  (request: DiagnosticOrigin | string = { type: "internal" }): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const origin =
      typeof request === "string"
        ? { id: "source.instance-close", type: "button" as const }
        : request;

    diagnostics.action("snapshot.close.requested", origin);
    const state = getState();
    const requestedId = typeof request === "string" ? request : undefined;
    const activeInstance = requestedId
      ? selectEditingInstanceById(state, requestedId)
      : selectActiveEditingInstance(state);

    if (!activeInstance) {
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

    if (activeInstance.id !== selectActiveInstanceId(state)) {
      await cancelInstanceExports(activeInstance.id, getState);
      dispatch(editingInstanceClosed(activeInstance.id));
      return;
    }

    dispatch(commitActiveEditingInstanceDraft());
    const instances = selectEditingInstances(getState());
    const activeIndex = instances.findIndex((instance) => instance.id === activeInstance.id);
    const replacement = getReplacementEditingInstance(instances, activeIndex);

    await cancelInstanceExports(activeInstance.id, getState);
    dispatch(sourceCleared());
    dispatch(editingInstanceClosed(activeInstance.id));
    dispatch(navigateToEditingInstance(replacement?.id ?? null));
    dispatch(nativeDialogStateChanged(false));
  };

export const closeEditingInstancesRequested =
  (ids: string[]): AppThunk<Promise<void>> =>
  async (dispatch) => {
    for (const id of ids) {
      await dispatch(closeActiveEditingInstanceRequested(id));
    }
  };

export const deleteActiveEditingInstanceSourceRequested =
  (itemId?: string): AppThunk<Promise<AppError | null>> =>
  async (dispatch, getState) => {
    const state = getState();
    const item = itemId
      ? selectEditingInstanceById(state, itemId)
      : selectActiveEditingInstance(state);

    if (!item) {
      diagnostics.event("source.file.delete.ignored", {
        data: { reason: "no_active_source" },
        origin: { type: "button", id: "source.delete" },
        result: "ignored",
      });
      return null;
    }

    const sourcePath = item.snapshot.source.sourcePath;
    const sourceKey = normalizeSourceKey(sourcePath);
    const sourceInstanceIds = selectInstanceIdsBySourceKey(state).get(sourceKey) ?? [];

    const hasActiveExport =
      hasActiveExportForSource(sourcePath, getState) ||
      sourceInstanceIds.some((id) => {
        const instance = state.editingInstances.entities[id];
        const attempt = instance?.exportAttempts.at(-1);
        return attempt?.state.status === "queued" || attempt?.state.status === "rendering";
      });

    if (hasActiveExport) {
      const error: AppError = {
        code: "source_in_use",
        message: "The source cannot be deleted while an export is queued or rendering.",
      };

      diagnostics.event("source.file.delete.ignored", {
        data: { itemId: item.id, reason: "active_export", sourcePath },
        origin: { type: "button", id: "source.delete" },
        result: "ignored",
      });
      dispatch(sourceErrorReported(error));
      return error;
    }

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

    dispatch(editingInstancesSourceAvailabilityChanged({ availability: "deleted", sourcePath }));
    operation.complete({ itemId: item.id, sourcePath });
    return null;
  };

export const restoreSourceFileRequested =
  (request: {
    itemId?: string;
    origin?: DiagnosticOrigin;
    sourcePath: string;
  }): AppThunk<Promise<boolean>> =>
  async (dispatch) => {
    const {
      itemId,
      origin = { id: "activity.restore-source", type: "button" },
      sourcePath,
    } = request;

    const operation = diagnostics.startOperation("source.file-restore", {
      data: { ...(itemId ? { itemId } : {}), sourcePath },
      origin,
      ...(itemId ? { snapshotId: itemId } : {}),
    });

    try {
      await restoreSourceFromTrash(sourcePath);
      dispatch(
        editingInstancesSourceAvailabilityChanged({ availability: "available", sourcePath }),
      );
      operation.complete({ ...(itemId ? { itemId } : {}), sourcePath });
      return true;
    } catch (error: unknown) {
      operation.fail(error, { ...(itemId ? { itemId } : {}), sourcePath });
      return false;
    }
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
