import { editingInstanceActivated } from "@/app/store/actions/editing-instance-actions";
import {
  sourceCleared,
  sourceErrorReported,
  sourceFailed,
  sourceReady,
  sourceSelected,
} from "@/app/store/actions/source-actions";
import {
  createDefaultEditorSnapshot,
  createEditorSnapshotFromState,
} from "@/app/store/integration/editor-snapshot";
import {
  hasActiveExportForSource,
  withdrawPendingExport,
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
import {
  activeEditingInstanceChanged,
  editingInstanceClosed,
  editingInstanceExportAttemptRemoved,
  editingInstanceOptimizedSettingsChanged,
  editingInstancesAdded,
  editingInstancesClosed,
  editingInstanceSnapshotUpdated,
  editingInstancesSourceAvailabilityChanged,
  selectActiveEditingInstance,
  selectActiveInstanceId,
  selectEditingInstanceById,
  selectHasQueuedOrRenderingExportByInstanceId,
  selectImportedEditingInstances,
  selectInstanceIdsBySourceKey,
} from "@/app/store/slices/editing-instances-slice";
import { exportArgumentsChanged } from "@/app/store/slices/export-presets-slice";
import {
  dropListenerErrorCleared,
  nativeDialogStateChanged,
  sourceChoiceFinished,
  sourceChoiceStarted,
} from "@/app/store/slices/import-workflow-slice";
import { selectMergeAudioEnabledDefault } from "@/app/store/slices/preferences-slice";
import {
  importedThumbnailFailed,
  importedThumbnailLoading,
  importedThumbnailReady,
  importedThumbnailRemoved,
  previewFailed,
  previewLoading,
  previewReady,
  selectImportedSourceThumbnails,
} from "@/app/store/slices/preview-slice";
import {
  capabilitiesChecking,
  capabilitiesFailed,
  capabilitiesReady,
  selectHasSource,
  selectSourceSelection,
} from "@/app/store/slices/source-slice";
import type { AppDispatch, RootState } from "@/app/store/store";
import type { EditingInstance } from "@/domain/editing-instance";
import { createEditorSnapshot, type EditorSnapshot } from "@/domain/editor-snapshot";
import type { SourceRef } from "@/domain/source";
import { normalizeSourceKey } from "@/domain/source";
import { type DiagnosticOperation, diagnostics } from "@/lib/diagnostics";
import type { DiagnosticOrigin, DiagnosticValue } from "@/lib/tauri/diagnostics.types";
import {
  activateSourcePath,
  checkMediaCapabilities,
  chooseSource as chooseSourceDialog,
  inspectMedia,
  moveSourceToTrash,
  prepareAudioPreviews,
  prepareImportedSourceThumbnail,
  prepareProxyPreview,
  prepareSourcePreview,
  prepareWaveforms,
  releaseImportedSourceThumbnail,
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
let queueRestoreSequence = 0;
let foregroundSourcePreparationCount = 0;

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

const checkMediaCapabilitiesRequested =
  (origin: DiagnosticOrigin = { type: "system" }): AppThunk =>
  async (dispatch) => {
    dispatch(capabilitiesChecking());
    const operation = diagnostics.startOperation("media.capabilities", {
      origin,
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

const ingestSources =
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
    const importedAtMicros = Date.now() * 1_000;
    const instances: EditingInstance[] = result.sources.map((source) => ({
      exportAttempts: [],
      id: crypto.randomUUID(),
      importedAtMicros,
      origin: "source-import",
      snapshot: createDefaultEditorSnapshot(source, mergeAudio),
      sourceAvailability: "available",
    }));

    dispatch(dropListenerErrorCleared());
    dispatch(editingInstancesAdded(instances));
    dispatch(navigateToEditingInstance(instances[0]!.id, origin));
    operation.complete(importResultData(result));
  };

export const IMPORTED_THUMBNAIL_POOL_LIMIT = 64;
const THUMBNAIL_CONCURRENCY = 2;
const thumbnailQueue: Array<{ instanceId: string; sourcePath: string }> = [];
const thumbnailRequestsInFlight = new Set<string>();
const activeThumbnailRequests = new Set<string>();
const thumbnailDemand = new Set<string>();
const thumbnailLastUsed = new Map<string, number>();
let activeThumbnailRequestCount = 0;
let thumbnailAccessSequence = 0;

function touchThumbnail(instanceId: string) {
  thumbnailLastUsed.set(instanceId, ++thumbnailAccessSequence);
}

function releaseThumbnailToken(mediaToken: number) {
  void releaseImportedSourceThumbnail(mediaToken).catch(() => {
    // Runtime cleanup must not surface an IPC release failure to the SourceList.
  });
}

function removeThumbnailFromRuntime(
  instanceId: string,
  dispatch: AppDispatch,
  getState: () => RootState,
) {
  const current = selectImportedSourceThumbnails(getState())[instanceId];
  dispatch(importedThumbnailRemoved({ instanceId }));
  thumbnailLastUsed.delete(instanceId);
  if (current?.status === "ready") releaseThumbnailToken(current.value.mediaToken);
}

function ensureThumbnailPoolRoom(dispatch: AppDispatch, getState: () => RootState) {
  const importedThumbnails = selectImportedSourceThumbnails(getState());
  const readyIds = Object.entries(importedThumbnails)
    .filter(([, thumbnail]) => thumbnail.status === "ready")
    .map(([instanceId]) => instanceId);

  if (readyIds.length < IMPORTED_THUMBNAIL_POOL_LIMIT) return true;

  const evictionCandidate = readyIds
    .filter((instanceId) => !thumbnailDemand.has(instanceId))
    .sort((left, right) => (thumbnailLastUsed.get(left) ?? 0) - (thumbnailLastUsed.get(right) ?? 0))[0];

  if (!evictionCandidate) return false;

  removeThumbnailFromRuntime(evictionCandidate, dispatch, getState);
  return true;
}

const releaseImportedSourceThumbnailDemand =
  (instanceId: string): AppThunk<void> =>
  (dispatch, getState) => {
    thumbnailDemand.delete(instanceId);
    if (!activeThumbnailRequests.has(instanceId)) {
      const queueIndex = thumbnailQueue.findIndex((request) => request.instanceId === instanceId);
      if (queueIndex >= 0) {
        thumbnailQueue.splice(queueIndex, 1);
        thumbnailRequestsInFlight.delete(instanceId);
      }

      const thumbnail = selectImportedSourceThumbnails(getState())[instanceId];
      if (thumbnail?.status === "loading" || thumbnail?.status === "failed") {
        removeThumbnailFromRuntime(instanceId, dispatch, getState);
      }
    }
  };

const releaseImportedSourceThumbnailForInstance =
  (instanceId: string): AppThunk<void> =>
  (dispatch, getState) => {
    thumbnailDemand.delete(instanceId);
    const queueIndex = thumbnailQueue.findIndex((request) => request.instanceId === instanceId);
    if (queueIndex >= 0) thumbnailQueue.splice(queueIndex, 1);
    if (!activeThumbnailRequests.has(instanceId)) thumbnailRequestsInFlight.delete(instanceId);
    removeThumbnailFromRuntime(instanceId, dispatch, getState);
  };

function drainThumbnailQueue(dispatch: AppDispatch, getState: () => RootState) {
  if (foregroundSourcePreparationCount > 0) return;

  while (activeThumbnailRequestCount < THUMBNAIL_CONCURRENCY && thumbnailQueue.length > 0) {
    const request = thumbnailQueue.shift();
    if (!request) return;

    const current = selectEditingInstanceById(getState(), request.instanceId);
    if (
      !current ||
      current.sourceAvailability !== "available" ||
      !thumbnailDemand.has(request.instanceId) ||
      normalizeSourceKey(current.snapshot.source.sourcePath) !==
        normalizeSourceKey(request.sourcePath) ||
      selectImportedSourceThumbnails(getState())[request.instanceId]?.status !== "loading"
    ) {
      thumbnailRequestsInFlight.delete(request.instanceId);
      continue;
    }

    activeThumbnailRequestCount += 1;
    activeThumbnailRequests.add(request.instanceId);
    void prepareImportedSourceThumbnail(request.sourcePath)
      .then((thumbnail) => {
        const latest = selectEditingInstanceById(getState(), request.instanceId);
        if (
          latest &&
          latest.sourceAvailability === "available" &&
          normalizeSourceKey(latest.snapshot.source.sourcePath) ===
            normalizeSourceKey(request.sourcePath) &&
          selectImportedSourceThumbnails(getState())[request.instanceId]?.status === "loading"
        ) {
          if (!ensureThumbnailPoolRoom(dispatch, getState)) {
            releaseThumbnailToken(thumbnail.mediaToken);
            removeThumbnailFromRuntime(request.instanceId, dispatch, getState);
            return;
          }
          dispatch(importedThumbnailReady({ instanceId: request.instanceId, thumbnail }));
          touchThumbnail(request.instanceId);
        } else {
          releaseThumbnailToken(thumbnail.mediaToken);
        }
      })
      .catch((error: unknown) => {
        const latest = selectEditingInstanceById(getState(), request.instanceId);
        if (
          thumbnailDemand.has(request.instanceId) &&
          latest &&
          latest.sourceAvailability === "available" &&
          normalizeSourceKey(latest.snapshot.source.sourcePath) ===
            normalizeSourceKey(request.sourcePath) &&
          selectImportedSourceThumbnails(getState())[request.instanceId]?.status === "loading"
        ) {
          dispatch(
            importedThumbnailFailed({
              error: normalizeAppError(error),
              instanceId: request.instanceId,
            }),
          );
        } else {
          removeThumbnailFromRuntime(request.instanceId, dispatch, getState);
        }
      })
      .finally(() => {
        activeThumbnailRequestCount -= 1;
        activeThumbnailRequests.delete(request.instanceId);
        thumbnailRequestsInFlight.delete(request.instanceId);
        drainThumbnailQueue(dispatch, getState);
      });
  }
}

function beginForegroundSourcePreparation(
  dispatch: AppDispatch,
  getState: () => RootState,
): () => void {
  foregroundSourcePreparationCount += 1;
  let isFinished = false;

  return () => {
    if (isFinished) return;
    isFinished = true;
    foregroundSourcePreparationCount = Math.max(0, foregroundSourcePreparationCount - 1);
    if (foregroundSourcePreparationCount > 0) return;

    drainThumbnailQueue(dispatch, getState);
  };
}

const prepareImportedSourceThumbnailsRequested =
  (instances: EditingInstance[]): AppThunk<void> =>
  (dispatch, getState) => {
    const importedThumbnails = selectImportedSourceThumbnails(getState());
    for (const instance of instances) {
      const current = selectEditingInstanceById(getState(), instance.id);
      if (
        !current ||
        current.sourceAvailability !== "available"
      )
        continue;

      thumbnailDemand.add(instance.id);

      const currentThumbnail = importedThumbnails[instance.id];
      if (currentThumbnail?.status === "ready") {
        touchThumbnail(instance.id);
        continue;
      }
      if (currentThumbnail !== undefined || thumbnailRequestsInFlight.has(instance.id)) continue;

      const sourcePath = instance.snapshot.source.sourcePath;
      if (normalizeSourceKey(current.snapshot.source.sourcePath) !== normalizeSourceKey(sourcePath))
        continue;

      if (!ensureThumbnailPoolRoom(dispatch, getState)) continue;

      thumbnailRequestsInFlight.add(instance.id);
      dispatch(importedThumbnailLoading({ instanceId: instance.id }));
      thumbnailQueue.push({ instanceId: instance.id, sourcePath });
    }

    drainThumbnailQueue(dispatch, getState);
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

function importResultData(result: SourceImportResult): Record<string, DiagnosticValue> {
  return {
    acceptedFileCount: result.acceptedFileCount,
    directFileCount: result.directFileCount,
    discoveredFileCount: result.discoveredFileCount,
    folderCount: result.folderCount,
    readErrorCount: result.readErrorCount,
    recursive: result.recursive,
    skippedFileCount: result.skippedFileCount,
    sourcePaths: result.sources.map((source) => source.sourcePath),
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
        flipHorizontal: snapshot.flipHorizontal,
        flipVertical: snapshot.flipVertical,
        rotation: snapshot.rotation,
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

  const prepareAudio = async () => {
    if (audioStreamIndexes.length <= 1) {
      if (isCurrentSource(getState(), source.sourcePath, loadToken)) {
        dispatch(audioPreviewsReady({ previews: [] }));
        audioOperation.complete({ previewCount: 0 });
      } else {
        audioOperation.cancel({ reason: "source_replaced" });
      }
      return;
    }

    if (!isCurrentSource(getState(), source.sourcePath, loadToken)) {
      audioOperation.cancel({ reason: "source_replaced" });
      return;
    }

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
  };

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

  // Audio previews are optional and can require a full-source demux. Start them
  // only after the direct video preview is available so large sources do not
  // compete with initial video playback.
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
      rotation: 0,
      masterAudio: selectMasterAudio(getState()),
      audioTracks: selectAudioTracks(getState()).map(({ enabled, streamIndex, volumePercent }) => ({
        enabled,
        streamIndex,
        volumePercent,
      })),
      mergeAudio: selectMergeAudio(getState()),
    });

  operation.complete({ audioStreamCount: audioStreamIndexes.length });
  void prepareAudio();
  return result;
}

function captureActiveEditingInstanceDraft(
  dispatch: Parameters<AppThunk>[0],
  getState: Parameters<AppThunk>[1],
) {
  const state = getState();
  const activeInstance = selectActiveEditingInstance(state);
  const source = selectSourceSelection(state);
  if (!activeInstance || !source || !state.source.media) return;
  const snapshot = createEditorSnapshotFromState(state, source);
  if (!snapshot) return;

  dispatch(
    editingInstanceSnapshotUpdated({
      id: activeInstance.id,
      optimizedArguments: state.exportPresets.argumentsText,
      media: state.source.media,
      snapshot,
    }),
  );
}

const commitActiveEditingInstanceDraft = (): AppThunk => (dispatch, getState) => {
  captureActiveEditingInstanceDraft(dispatch, getState);
};

const leaveActiveEditingInstance = (): AppThunk => (dispatch) => {
  dispatch(commitActiveEditingInstanceDraft());
};

const restoreActiveEditingInstanceRequested =
  (id: string, loadToken: number, snapshot: EditorSnapshot): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    const finishForegroundPreparation = beginForegroundSourcePreparation(dispatch, getState);
    try {
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
          editingInstanceSnapshotUpdated({
            id,
            media: state.source.media,
            snapshot: readySnapshot,
          }),
        );
      }
      return true;
    } finally {
      finishForegroundPreparation();
    }
  };

const activateEditingInstanceRequested =
  (instance: EditingInstance, requestedLoadToken?: number): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    if (selectEditingInstanceById(getState(), instance.id)?.draftAvailable === false) return false;
    if (instance.optimizedArguments !== undefined)
      dispatch(exportArgumentsChanged(instance.optimizedArguments));
    const loadToken = requestedLoadToken ?? ++sourceLoadSequence;
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

const navigateToEditingInstance =
  (id: string | null, origin: DiagnosticOrigin = { type: "internal" }): AppThunk<boolean> =>
  (dispatch, getState) => {
    diagnostics.action("snapshot.select.requested", origin, id ? { snapshotId: id } : undefined);
    const state = getState();
    const target = id ? selectEditingInstanceById(state, id) : null;

    if (id !== null && (!target || target.draftAvailable === false)) {
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

    const operation = diagnostics.startOperation("snapshot.switch", {
      origin,
      snapshotId: id ?? undefined,
    });

    if (target) {
      dispatch(commitActiveEditingInstanceDraft());
      const loadToken = ++sourceLoadSequence;
      queueRestoreSequence += 1;
      dispatch(activeEditingInstanceChanged(target.id));
      dispatch(sourceSelected({ loadToken, source: target.snapshot.source }));

      // Publish the urgent active/loading state first. Source preparation and
      // the full activation reducer path can then run after the browser paints
      // the selection response.
      window.setTimeout(() => {
        if (selectActiveInstanceId(getState()) !== target.id) {
          operation.cancel({ reason: "source_replaced" });
          return;
        }

        void dispatch(activateEditingInstanceRequested(target, loadToken)).then(
          (restored) => {
            if (restored) operation.complete({ itemId: target.id });
            else
              operation.fail(new Error("Snapshot restoration did not complete."), {
                itemId: target.id,
              });
          },
          (error: unknown) => operation.fail(error, { itemId: target.id }),
        );
      }, 0);
    } else {
      dispatch(leaveActiveEditingInstance());
      queueRestoreSequence += 1;
      dispatch(sourceCleared());
      dispatch(activeEditingInstanceChanged(null));
      operation.complete({ reason: "cleared" });
    }
    return true;
  };

const restoreExportAttemptRequested =
  ({
    attemptId,
    instanceId,
  }: {
    attemptId: string;
    instanceId: string;
  }): AppThunk<Promise<boolean>> =>
  async (dispatch, getState) => {
    const instance = selectEditingInstanceById(getState(), instanceId);
    const attempt = instance?.exportAttempts.find(({ id }) => id === attemptId);
    if (
      !instance ||
      !attempt ||
      attempt.state.status === "rendering" ||
      instance.sourceAvailability !== "available"
    )
      return false;
    if (
      attempt.state.status === "queued" &&
      !withdrawPendingExport(instanceId, attemptId, getState)
    )
      return false;
    dispatch(commitActiveEditingInstanceDraft());
    if (attempt.state.status === "queued") {
      dispatch(editingInstanceExportAttemptRemoved({ id: instanceId, attemptId }));
    }
    dispatch(
      editingInstanceSnapshotUpdated({
        id: instanceId,
        ...("resolution" in attempt.request
          ? { optimizedArguments: attempt.request.arguments }
          : {}),
        snapshot: attempt.snapshot,
      }),
    );
    if ("resolution" in attempt.request) {
      dispatch(
        editingInstanceOptimizedSettingsChanged({
          id: instanceId,
          settings: {
            frameRate: attempt.request.frameRate,
            resolution: attempt.request.resolution,
          },
        }),
      );
    }
    const restored = selectEditingInstanceById(getState(), instanceId);
    return restored ? dispatch(activateEditingInstanceRequested(restored)) : false;
  };

const chooseSourceRequested =
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

const closeActiveEditingInstanceRequested =
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
      reportClosedSources([activeInstance], origin);
      dispatch(editingInstanceClosed(activeInstance.id));
      return;
    }

    reportClosedSources([activeInstance], origin);
    dispatch(commitActiveEditingInstanceDraft());
    const instances = selectImportedEditingInstances(getState());
    const activeIndex = instances.findIndex((instance) => instance.id === activeInstance.id);
    const replacement = getReplacementEditingInstance(instances, activeIndex);

    dispatch(editingInstanceClosed(activeInstance.id));
    if (replacement) {
      // A replacement activation resets source-bound domains and keeps the
      // existing panel footprint alive while its metadata is restored. Do not
      // publish an empty source between the two instances, or resizable panels
      // will treat the close as a real clear and lose their boundaries.
      dispatch(navigateToEditingInstance(replacement.id));
    } else {
      dispatch(sourceCleared());
    }
    dispatch(nativeDialogStateChanged(false));
  };

const closeEditingInstancesRequested =
  (ids: string[]): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const state = getState();
    const idsToClose = [...new Set(ids)].filter((id) => selectEditingInstanceById(state, id));
    if (idsToClose.length === 0) return;

    reportClosedSources(
      idsToClose.map((id) => selectEditingInstanceById(state, id)).filter(isEditingInstance),
      { id: "source.close", type: "button" },
    );

    const closingIds = new Set(idsToClose);
    const activeInstanceId = selectActiveInstanceId(state);
    const activeInstanceWillClose = activeInstanceId !== null && closingIds.has(activeInstanceId);

    const instances = selectImportedEditingInstances(state);
    const activeIndex = activeInstanceId
      ? instances.findIndex((instance) => instance.id === activeInstanceId)
      : -1;

    const replacement =
      activeInstanceWillClose && activeIndex >= 0
        ? (instances.slice(activeIndex + 1).find((instance) => !closingIds.has(instance.id)) ??
          instances
            .slice(0, activeIndex)
            .reverse()
            .find((instance) => !closingIds.has(instance.id)))
        : undefined;

    if (activeInstanceWillClose) dispatch(commitActiveEditingInstanceDraft());

    dispatch(editingInstancesClosed(idsToClose));

    if (activeInstanceWillClose) {
      if (replacement) dispatch(navigateToEditingInstance(replacement.id));
      else dispatch(sourceCleared());
      dispatch(nativeDialogStateChanged(false));
    }
  };

function reportClosedSources(instances: EditingInstance[], origin: DiagnosticOrigin): void {
  if (instances.length === 0) return;

  diagnostics.event("source.file-close.completed", {
    data: {
      count: instances.length,
      sourcePaths: instances.map((instance) => instance.snapshot.source.sourcePath),
    },
    origin,
    result: "success",
    ...(instances.length === 1 ? { snapshotId: instances[0]!.id } : {}),
  });
}

function isEditingInstance(instance: EditingInstance | undefined): instance is EditingInstance {
  return instance !== undefined;
}

const deleteActiveEditingInstanceSourceRequested =
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
        return selectHasQueuedOrRenderingExportByInstanceId(state, id);
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

const restoreSourceFileRequested =
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

const handlePreviewPlaybackError =
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

const prepareSourceWaveforms =
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

export {
  activateEditingInstanceRequested,
  checkMediaCapabilitiesRequested,
  chooseSourceRequested,
  closeActiveEditingInstanceRequested,
  closeEditingInstancesRequested,
  commitActiveEditingInstanceDraft,
  deleteActiveEditingInstanceSourceRequested,
  handlePreviewPlaybackError,
  ingestSources,
  leaveActiveEditingInstance,
  navigateToEditingInstance,
  prepareImportedSourceThumbnailsRequested,
  prepareSourceWaveforms,
  releaseImportedSourceThumbnailDemand,
  releaseImportedSourceThumbnailForInstance,
  restoreActiveEditingInstanceRequested,
  restoreExportAttemptRequested,
  restoreSourceFileRequested,
};
