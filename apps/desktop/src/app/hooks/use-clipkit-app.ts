import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { initialSessionState, sessionReducer } from "@/app/session-state";
import type { TrimRange } from "@/domain/trim";
import type { ExportToast } from "@/features/export/ExportPanel";
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

export function useClipKitApp() {
  const [session, dispatch] = useReducer(sessionReducer, initialSessionState);
  const [isChoosingSource, setIsChoosingSource] = useState(false);
  const [isNativeDialogOpen, setIsNativeDialogOpen] = useState(false);
  const [isReturnConfirmationOpen, setIsReturnConfirmationOpen] = useState(false);
  const [isSourceDragActive, setIsSourceDragActive] = useState(false);
  const [dropListenerError, setDropListenerError] = useState<string | null>(null);
  const [exportQueue, setExportQueue] = useState<ExportToast[]>([]);
  const [audioPreviewUrls, setAudioPreviewUrls] = useState<Record<number, string>>({});
  const activeSourceIdRef = useRef<string | null>(null);
  const waveformJobSequence = useRef(0);
  const hasSource = session.source !== null;

  const inspectSource = useCallback((source: SourceSelection) => {
    activeSourceIdRef.current = source.sourceId;
    setAudioPreviewUrls({});
    dispatch({ type: "source-selected", source });
    void inspectMedia(source.sourceId)
      .then((media) => {
        dispatch({ type: "source-ready", sourceId: source.sourceId, media });
        void prepareAudioPreviews(
          source.sourceId,
          media.audioStreams.map((stream) => stream.streamIndex),
        )
          .then((previews) => {
            if (activeSourceIdRef.current !== source.sourceId) {
              return;
            }
            setAudioPreviewUrls(
              Object.fromEntries(previews.map((preview) => [preview.streamIndex, preview.url])),
            );
          })
          .catch(() => {
            // Audio-only preview is an optimization; the source video remains usable if it fails.
          });
        dispatch({ type: "preview-loading", sourceId: source.sourceId, kind: "source" });
        return prepareSourcePreview(source.sourceId);
      })
      .then((preview) => {
        dispatch({ type: "preview-ready", sourceId: source.sourceId, preview });
      })
      .catch((error: unknown) => {
        const normalized = normalizeAppError(error);
        dispatch(
          normalized.code === "probe_failed" ||
            normalized.code === "unsupported_media" ||
            normalized.code === "io_failed"
            ? {
                type: "source-failed",
                sourceId: source.sourceId,
                error: normalized,
              }
            : {
                type: "preview-failed",
                sourceId: source.sourceId,
                error: normalized,
              },
        );
      });
  }, []);

  const handlePreviewPlaybackError = useCallback((sourceId: string, previewKind: PreviewKind) => {
    if (previewKind === "proxy") {
      dispatch({
        type: "preview-failed",
        sourceId,
        error: {
          code: "preview_playback_failed",
          message: "The compatible preview could not be played.",
        },
      });
      return;
    }

    dispatch({ type: "preview-loading", sourceId, kind: "proxy" });
    void prepareProxyPreview(sourceId)
      .then((preview) => {
        dispatch({ type: "preview-ready", sourceId, preview });
      })
      .catch((error: unknown) => {
        dispatch({
          type: "preview-failed",
          sourceId,
          error: normalizeAppError(error),
        });
      });
  }, []);

  const handleTrimChange = useCallback((sourceId: string, trim: TrimRange) => {
    dispatch({ type: "trim-changed", sourceId, trim });
  }, []);

  const handlePrepareWaveforms = useCallback(
    (sourceId: string, streamIndexes: number[], width: number) => {
      if (streamIndexes.length === 0) {
        return;
      }
      const jobId = `waveform-${++waveformJobSequence.current}`;
      dispatch({ type: "waveforms-loading", sourceId, jobId, width, streamIndexes });
      void prepareWaveforms(sourceId, jobId, streamIndexes, width)
        .then((results) => {
          results.forEach((result) => dispatch({ type: "waveform-result", result }));
        })
        .catch((error: unknown) => {
          dispatch({
            type: "waveforms-failed",
            sourceId,
            jobId,
            width,
            streamIndexes,
            error: normalizeAppError(error),
          });
        });
    },
    [],
  );

  const handleToggleAudioTrack = useCallback((sourceId: string, streamIndex: number) => {
    dispatch({ type: "audio-track-toggled", sourceId, streamIndex });
  }, []);

  const handleAudioTrackVolumeChange = useCallback(
    (sourceId: string, streamIndex: number, volumePercent: number) => {
      dispatch({ type: "audio-track-volume-changed", sourceId, streamIndex, volumePercent });
    },
    [],
  );

  const handleToggleAudioMaster = useCallback((sourceId: string) => {
    dispatch({ type: "audio-master-toggled", sourceId });
  }, []);

  const handleMasterVolumeChange = useCallback((sourceId: string, volumePercent: number) => {
    dispatch({ type: "audio-master-volume-changed", sourceId, volumePercent });
  }, []);

  const handleToggleAudioMerge = useCallback((sourceId: string) => {
    dispatch({ type: "audio-merge-toggled", sourceId });
  }, []);

  const handleWaveformImageError = useCallback((sourceId: string, streamIndex: number) => {
    dispatch({ type: "waveform-display-failed", sourceId, streamIndex });
  }, []);

  useEffect(() => {
    let disposed = false;

    void checkMediaCapabilities()
      .then((capabilities) => {
        if (!disposed) {
          dispatch({ type: "capabilities-ready", capabilities });
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          dispatch({
            type: "capabilities-failed",
            error: normalizeAppError(error),
          });
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

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
        dispatch({ type: "source-failed", error: event.error });
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
  }, [inspectSource]);

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
      dispatch({ type: "source-failed", error: normalizeAppError(error) });
    } finally {
      setIsChoosingSource(false);
      setIsNativeDialogOpen(false);
    }
  }, [inspectSource, isChoosingSource]);

  const handleReturnToWelcome = useCallback(() => {
    activeSourceIdRef.current = null;
    setAudioPreviewUrls({});
    dispatch({ type: "return-to-welcome" });
  }, []);

  const requestReturnToWelcome = useCallback(() => {
    if (hasSource) {
      setIsReturnConfirmationOpen(true);
    }
  }, [hasSource]);

  useEffect(() => {
    if (!hasSource) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isNativeDialogOpen) {
        if (isReturnConfirmationOpen) {
          setIsReturnConfirmationOpen(false);
        } else {
          requestReturnToWelcome();
        }
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [hasSource, isNativeDialogOpen, isReturnConfirmationOpen, requestReturnToWelcome]);

  return {
    session,
    hasSource,
    isChoosingSource,
    isNativeDialogOpen,
    isReturnConfirmationOpen,
    isSourceDragActive,
    dropListenerError,
    exportQueue,
    audioPreviewUrls,
    setExportQueue,
    setIsNativeDialogOpen,
    setIsReturnConfirmationOpen,
    handleChooseSource,
    handleReturnToWelcome,
    requestReturnToWelcome,
    handlePreviewPlaybackError,
    handleTrimChange,
    handlePrepareWaveforms,
    handleToggleAudioTrack,
    handleAudioTrackVolumeChange,
    handleToggleAudioMaster,
    handleMasterVolumeChange,
    handleToggleAudioMerge,
    handleWaveformImageError,
  };
}
