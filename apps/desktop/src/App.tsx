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
  const [isSourceDragActive, setIsSourceDragActive] = useState(false);
  const [dropListenerError, setDropListenerError] = useState<string | null>(null);
  const [exportQueue, setExportQueue] = useState<ExportToast[]>([]);
  const waveformJobSequence = useRef(0);
  const hasSource = session.source !== null;

  const inspectSource = useCallback((source: SourceSelection) => {
    dispatch({ type: "source-selected", source });
    void inspectMedia(source.sourceId)
      .then((media) => {
        dispatch({ type: "source-ready", sourceId: source.sourceId, media });
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

  const handleSetAllAudioTracksEnabled = useCallback((sourceId: string, enabled: boolean) => {
    dispatch({ type: "audio-tracks-set-enabled", sourceId, enabled });
  }, []);

  const handleAudioTrackVolumeChange = useCallback(
    (sourceId: string, streamIndex: number, volumePercent: number) => {
      dispatch({ type: "audio-track-volume-changed", sourceId, streamIndex, volumePercent });
    },
    [],
  );

  const handleAllAudioTracksVolumeChange = useCallback(
    (sourceId: string, volumePercent: number) => {
      dispatch({ type: "audio-tracks-volume-set", sourceId, volumePercent });
    },
    [],
  );

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
    try {
      const source = await chooseSource();
      if (source) {
        inspectSource(source);
      }
    } catch (error: unknown) {
      dispatch({ type: "source-failed", error: normalizeAppError(error) });
    } finally {
      setIsChoosingSource(false);
    }
  }

  return (
    <main className={`app-shell ${hasSource ? "has-source" : "is-empty"}`}>
      {hasSource ? (
        <div className="app-toolbar" role="toolbar" aria-label="Application toolbar">
          <h1 className="app-brand">ClipKit</h1>
          <div className="toolbar-actions">
            <CapabilityStatus capabilities={session.capabilities} />
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
                mergeAudio={session.source.mergeAudio}
                queue={exportQueue}
                setQueue={setExportQueue}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <header className="welcome-header">
          <div>
            <p className="eyebrow">Local video editor</p>
            <h1>ClipKit</h1>
          </div>
          <div className="welcome-summary">
            <p>Import a video to inspect its source and prepare a precise cut.</p>
            <div className="toolbar-actions">
              <CapabilityStatus capabilities={session.capabilities} />
              <OpenVideoButton
                isChoosingSource={isChoosingSource}
                onChooseSource={() => void handleChooseSource()}
              />
            </div>
          </div>
        </header>
      )}

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
        onSetAllAudioTracksEnabled={handleSetAllAudioTracksEnabled}
        onAudioTrackVolumeChange={handleAudioTrackVolumeChange}
        onAllAudioTracksVolumeChange={handleAllAudioTracksVolumeChange}
        onToggleAudioMerge={handleToggleAudioMerge}
        onWaveformImageError={handleWaveformImageError}
        exportQueue={exportQueue}
      />
    </main>
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
