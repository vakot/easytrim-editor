import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  capabilitiesFailed,
  capabilitiesReady,
  previewFailed,
  previewLoading,
  previewReady,
  selectHasSource,
  sourceCleared,
  sourceFailed,
  sourceReady,
  sourceSelected,
  waveformsFailed,
  waveformReady,
  waveformsLoading,
} from "@/app/store/slices/session-slice";
import type { ExportToast } from "@/features/export";
import {
  exportPresetReducer,
  loadExportPresetState,
  persistExportPresetState,
} from "@/features/export/export-presets";
import {
  availableQueueFinishActions,
  performQueueFinishAction,
  type QueueFinishAction,
} from "@/lib/tauri/queue";
import {
  cancelActiveExport,
  cancelAllQueuedExports,
  setExportQueueExecutionEnabled,
} from "@/features/export/utils/export-queue";
import {
  checkMediaCapabilities,
  chooseSource,
  inspectMedia,
  listenForSourceDrops,
  normalizeAppError,
  prepareAudioPreviews,
  prepareProxyPreview,
  prepareSourcePreview,
  prepareWaveforms,
  type PreviewKind,
  type SourceSelection,
} from "@/lib/tauri/media";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";

export function useEasyTrimEditorApp(defaultMergeAudio = false) {
  const dispatch = useAppDispatch();
  const hasSource = useAppSelector(selectHasSource);
  const [isChoosingSource, setIsChoosingSource] = useState(false);
  const [isNativeDialogOpen, setIsNativeDialogOpen] = useState(false);
  const [isSourceDragActive, setIsSourceDragActive] = useState(false);
  const [dropListenerError, setDropListenerError] = useState<string | null>(null);
  const [exportQueue, setExportQueue] = useState<ExportToast[]>([]);
  const [queueStarted, setQueueStarted] = useState(false);
  const [queueFinishAction, setQueueFinishAction] = useState<QueueFinishAction>("nothing");
  const [availableQueueFinishActionsState, setAvailableQueueFinishActionsState] = useState<
    QueueFinishAction[]
  >(["exit", "nothing"]);
  const [exportPresets, dispatchExportPreset] = useReducer(
    exportPresetReducer,
    undefined,
    loadExportPresetState,
  );
  const [audioPreviewUrls, setAudioPreviewUrls] = useState<Record<number, string>>({});
  const [audioPreviewPreparation, setAudioPreviewPreparation] = useState<{
    sourceId: string | null;
    status: "idle" | "loading" | "ready" | "unavailable";
  }>({ sourceId: null, status: "idle" });
  const activeSourceIdRef = useRef<string | null>(null);
  const waveformJobSequence = useRef(0);
  const queueHadWorkRef = useRef(false);
  const suppressQueueFinishActionRef = useRef(false);

  useEffect(() => {
    setExportQueueExecutionEnabled(queueStarted);
  }, [queueStarted]);

  useEffect(() => {
    let active = true;
    void availableQueueFinishActions()
      .then((actions) => {
        if (active) {
          setAvailableQueueFinishActionsState(actions.includes("nothing") ? actions : ["nothing"]);
        }
      })
      .catch(() => {
        // Keep the safe default when the optional native capability probe fails.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const hasWork = exportQueue.some(
      (toast) => toast.status === "queued" || toast.status === "rendering",
    );
    if (hasWork) {
      queueHadWorkRef.current = true;
      return;
    }
    if (!queueHadWorkRef.current) return;

    queueHadWorkRef.current = false;
    if (suppressQueueFinishActionRef.current) {
      suppressQueueFinishActionRef.current = false;
      return;
    }
    if (!exportQueue.some((toast) => toast.status === "completed" || toast.status === "failed")) {
      return;
    }
    if (queueFinishAction !== "nothing") {
      void performQueueFinishAction(queueFinishAction).catch(() => undefined);
    }
  }, [exportQueue, queueFinishAction]);

  useEffect(() => {
    persistExportPresetState(exportPresets);
  }, [exportPresets]);

  const inspectSource = useCallback(
    (source: SourceSelection) => {
      activeSourceIdRef.current = source.sourceId;
      setAudioPreviewUrls({});
      setAudioPreviewPreparation({ sourceId: source.sourceId, status: "idle" });
      dispatch(sourceSelected({ source, mergeAudio: defaultMergeAudio }));
      void inspectMedia(source.sourceId)
        .then((media) => {
          if (activeSourceIdRef.current !== source.sourceId) return undefined;
          dispatch(sourceReady({ sourceId: source.sourceId, media }));
          const audioStreamIndexes = media.audioStreams.map((stream) => stream.streamIndex);
          if (audioStreamIndexes.length <= 1) {
            setAudioPreviewPreparation({ sourceId: source.sourceId, status: "ready" });
          } else {
            setAudioPreviewPreparation({ sourceId: source.sourceId, status: "loading" });
            void prepareAudioPreviews(source.sourceId, audioStreamIndexes)
              .then((previews) => {
                if (activeSourceIdRef.current !== source.sourceId) {
                  return;
                }
                setAudioPreviewUrls(
                  Object.fromEntries(previews.map((preview) => [preview.streamIndex, preview.url])),
                );
                setAudioPreviewPreparation({ sourceId: source.sourceId, status: "ready" });
              })
              .catch(() => {
                // Audio-only preview is an optimization; the source video remains usable if it fails.
                if (activeSourceIdRef.current === source.sourceId) {
                  setAudioPreviewPreparation({ sourceId: source.sourceId, status: "unavailable" });
                }
              });
          }
          dispatch(previewLoading({ sourceId: source.sourceId, kind: "source" }));
          return prepareSourcePreview(source.sourceId);
        })
        .then((preview) => {
          if (!preview) return;
          dispatch(previewReady({ sourceId: source.sourceId, preview }));
        })
        .catch((error: unknown) => {
          const normalized = normalizeAppError(error);
          dispatch(
            normalized.code === "probe_failed" ||
              normalized.code === "unsupported_media" ||
              normalized.code === "io_failed"
              ? sourceFailed({ sourceId: source.sourceId, error: normalized })
              : previewFailed({ sourceId: source.sourceId, error: normalized }),
          );
        });
    },
    [defaultMergeAudio, dispatch],
  );

  const handlePreviewPlaybackError = useCallback(
    (sourceId: string, previewKind: PreviewKind) => {
      if (previewKind === "proxy") {
        dispatch(
          previewFailed({
            sourceId,
            error: {
              code: "preview_playback_failed",
              message: "The compatible preview could not be played.",
            },
          }),
        );
        return;
      }

      dispatch(previewLoading({ sourceId, kind: "proxy" }));
      void prepareProxyPreview(sourceId)
        .then((preview) => {
          dispatch(previewReady({ sourceId, preview }));
        })
        .catch((error: unknown) => {
          dispatch(previewFailed({ sourceId, error: normalizeAppError(error) }));
        });
    },
    [dispatch],
  );

  const handlePrepareWaveforms = useCallback(
    (sourceId: string, streamIndexes: number[], width: number) => {
      if (streamIndexes.length === 0) {
        return;
      }
      const jobId = `waveform-${++waveformJobSequence.current}`;
      dispatch(waveformsLoading({ sourceId, jobId, width, streamIndexes }));
      void prepareWaveforms(sourceId, jobId, streamIndexes, width)
        .then((results) => {
          results.forEach((result) => dispatch(waveformReady(result)));
        })
        .catch((error: unknown) => {
          dispatch(
            waveformsFailed({
              sourceId,
              jobId,
              width,
              streamIndexes,
              error: normalizeAppError(error),
            }),
          );
        });
    },
    [dispatch],
  );

  useEffect(() => {
    let disposed = false;

    void checkMediaCapabilities()
      .then((capabilities) => {
        if (!disposed) {
          dispatch(capabilitiesReady(capabilities));
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          dispatch(capabilitiesFailed(normalizeAppError(error)));
        }
      });

    return () => {
      disposed = true;
    };
  }, [dispatch]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listenForSourceDrops((event) => {
      if (disposed) {
        return;
      }
      if (event.status === "drag") {
        setIsSourceDragActive(event.active);
        return;
      }

      setDropListenerError(null);
      if (event.status === "failed") {
        dispatch(sourceFailed({ error: event.error }));
        return;
      }
      inspectSource(event.source);
    })
      .then((stopListening) => {
        if (disposed) {
          stopListening();
        } else {
          unlisten = stopListening;
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setDropListenerError(normalizeAppError(error).message);
        }
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [dispatch, inspectSource]);

  const handleChooseSource = useCallback(async () => {
    if (isChoosingSource) {
      return;
    }

    setIsChoosingSource(true);
    setIsNativeDialogOpen(true);
    try {
      const source = await chooseSource();
      if (source) {
        inspectSource(source);
      }
    } catch (error: unknown) {
      dispatch(sourceFailed({ error: normalizeAppError(error) }));
    } finally {
      setIsChoosingSource(false);
      setIsNativeDialogOpen(false);
    }
  }, [dispatch, inspectSource, isChoosingSource]);

  useKeyboardShortcut(
    (event) =>
      event.key.toLowerCase() === "o" && event.ctrlKey && !isChoosingSource && !isNativeDialogOpen,
    handleChooseSource,
  );

  const clearSource = useCallback(() => {
    activeSourceIdRef.current = null;
    setAudioPreviewUrls({});
    setAudioPreviewPreparation({ sourceId: null, status: "idle" });
    dispatch(sourceCleared());
  }, [dispatch]);

  const handleCloseFile = useCallback(() => {
    if (!hasSource) {
      return;
    }
    clearSource();
  }, [clearSource, hasSource]);

  useKeyboardShortcut(
    (event) =>
      event.key.toLowerCase() === "q" &&
      event.ctrlKey &&
      hasSource &&
      !isChoosingSource &&
      !isNativeDialogOpen,
    handleCloseFile,
  );

  const handleQueueStartedChange = useCallback((enabled: boolean) => {
    setQueueStarted(enabled);
    setExportQueueExecutionEnabled(enabled);
  }, []);

  useKeyboardShortcut(
    (event) =>
      event.key === "Enter" &&
      !queueStarted &&
      exportQueue.some((toast) => toast.status === "queued") &&
      document.activeElement === document.body,
    () => handleQueueStartedChange(true),
  );

  const handleCancelQueue = useCallback(() => {
    suppressQueueFinishActionRef.current = true;
    cancelAllQueuedExports();
  }, []);

  useEffect(() => {
    if (!hasSource) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || isNativeDialogOpen) {
        return;
      }

      const openDialog = document.querySelector<HTMLElement>(
        '[data-slot="dialog-content"][data-state="open"]',
      );
      if (openDialog) {
        openDialog.querySelector<HTMLElement>('[data-slot="dialog-close"]')?.click();
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement !== document.body) {
        activeElement.blur();
        return;
      }

      // Escape only clears focus or closes an open dialog. Closing a source is explicit.
    }

    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [hasSource, isNativeDialogOpen]);

  return {
    isChoosingSource,
    isNativeDialogOpen,
    isSourceDragActive,
    dropListenerError,
    exportQueue,
    queueStarted,
    queueFinishAction,
    availableQueueFinishActions: availableQueueFinishActionsState,
    exportPresets,
    dispatchExportPreset,
    audioPreviewUrls,
    audioPreviewPreparation,
    setExportQueue,
    setIsNativeDialogOpen,
    setQueueStarted: handleQueueStartedChange,
    cancelActiveExport,
    cancelQueue: handleCancelQueue,
    setQueueFinishAction,
    handleChooseSource,
    handleCloseFile,
    handlePreviewPlaybackError,
    handlePrepareWaveforms,
  };
}
