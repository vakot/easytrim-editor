import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { initialSessionState, sessionReducer } from "./app/session-state";
import type { TrimRange } from "./domain/trim";
import { CapabilityStatus, SourceWorkspace } from "./features/import-source/SourceWorkspace";
import { ExportPanel, type ExportToast } from "./features/export/ExportPanel";
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
} from "./lib/tauri/media";
import "./App.css";

function App() {
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

  async function handleChooseSource() {
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
  }

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

  return (
    <main className={`app-shell ${hasSource ? "has-source" : "is-empty"}`}>
      {hasSource ? (
        <div className="app-toolbar" role="toolbar" aria-label="Application toolbar">
          <div className="toolbar-brand-group">
            <h1
              className="app-brand"
              role="button"
              tabIndex={0}
              aria-label="Return to CLIP KIT welcome page"
              onClick={requestReturnToWelcome}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  requestReturnToWelcome();
                }
              }}
            >
              <img src="/logo_outline.svg" alt="" />
              CLIP KIT
            </h1>
          </div>
          <div className="toolbar-capability">
            <CapabilityStatus capabilities={session.capabilities} />
          </div>
          <div className="toolbar-actions">
            <OpenVideoButton
              isChoosingSource={isChoosingSource}
              onChooseSource={() => void handleChooseSource()}
            />
            {session.status === "ready" && session.source?.media && session.source.trim ? (
              <ExportPanel
                key={`export-${session.source.selection.sourceId}`}
                source={session.source.media}
                sourceName={session.source.selection.displayName}
                trim={session.source.trim}
                audioTracks={session.source.audioTracks}
                masterEnabled={session.source.masterEnabled}
                masterVolumePercent={session.source.masterVolumePercent}
                mergeAudio={session.source.mergeAudio}
                queue={exportQueue}
                setQueue={setExportQueue}
                onNativeDialogStateChange={setIsNativeDialogOpen}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {isReturnConfirmationOpen ? (
        <ReturnConfirmationDialog
          onCancel={() => setIsReturnConfirmationOpen(false)}
          onConfirm={() => {
            setIsReturnConfirmationOpen(false);
            handleReturnToWelcome();
          }}
        />
      ) : null}

      {isNativeDialogOpen ? <NativeDialogOverlay /> : null}

      {dropListenerError ? (
        <p className="inline-alert" role="alert">
          Drag and drop is unavailable: {dropListenerError}
        </p>
      ) : null}

      <SourceWorkspace
        session={session}
        isChoosingSource={isChoosingSource}
        isSourceDragActive={isSourceDragActive}
        onChooseSource={() => void handleChooseSource()}
        onPreviewPlaybackError={handlePreviewPlaybackError}
        onTrimChange={handleTrimChange}
        onPrepareWaveforms={handlePrepareWaveforms}
        onToggleAudioTrack={handleToggleAudioTrack}
        onAudioTrackVolumeChange={handleAudioTrackVolumeChange}
        onToggleAudioMaster={handleToggleAudioMaster}
        onMasterVolumeChange={handleMasterVolumeChange}
        onToggleAudioMerge={handleToggleAudioMerge}
        onWaveformImageError={handleWaveformImageError}
        audioPreviewUrls={audioPreviewUrls}
        exportQueue={exportQueue}
      />
    </main>
  );
}

function NativeDialogOverlay() {
  return (
    <div className="native-dialog-overlay" role="status" aria-live="polite">
      <div className="native-dialog-card">
        <span className="native-dialog-spinner" aria-hidden="true" />
        <strong>Waiting for system dialog</strong>
        <span>Choose a file location to continue.</span>
      </div>
    </div>
  );
}

function ReturnConfirmationDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="return-confirmation-overlay" role="presentation">
      <section
        className="return-confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="return-confirmation-title"
      >
        <p className="section-label">Leave editor</p>
        <h2 id="return-confirmation-title">Return to welcome page?</h2>
        <p>Your current trim and audio settings will be cleared.</p>
        <div className="return-confirmation-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-button" type="button" onClick={onConfirm}>
            Return to welcome
          </button>
        </div>
      </section>
    </div>
  );
}

function OpenVideoButton({
  isChoosingSource,
  onChooseSource,
}: {
  isChoosingSource: boolean;
  onChooseSource: () => void;
}) {
  return (
    <button
      className="toolbar-button secondary-button"
      type="button"
      onClick={onChooseSource}
      disabled={isChoosingSource}
    >
      {isChoosingSource ? "Opening…" : "Open video"}
    </button>
  );
}

export default App;
