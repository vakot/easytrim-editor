import { useEffect, useRef, useState } from "react";
import { Group, Panel } from "react-resizable-panels";

import type { AudioTrackState, PreviewState } from "../../app/session-state";
import { PaneResizeHandle } from "../../components/PaneResizeHandle";
import {
  clampPlaybackMicros,
  formatPlaybackTime,
  frameDurationMicros,
} from "../../domain/playback";
import {
  canSetTrimBoundaryAtPlayhead,
  playheadAfterSegmentMove,
  playheadFollowAfterTrimBoundaryMove,
  setTrimBoundaryAtPlayhead,
  type TrimBoundary,
  type TrimRange,
} from "../../domain/trim";
import type { AudioStream, FrameRate } from "../../lib/tauri/media";
import { AudioTracks } from "../audio-tracks/AudioTracks";
import { PlaybackControls, PlaybackTimecode, TimelineTools } from "../preview/PlaybackControls";
import { VideoPreview } from "../preview/VideoPreview";
import { TrimTimeline } from "../timeline/TrimTimeline";

interface EditorStageProps {
  sourceId: string;
  preview: PreviewState;
  trim: TrimRange;
  frameRate?: FrameRate;
  audioStreams: AudioStream[];
  audioTracks: AudioTrackState[];
  masterVolumePercent: number;
  mergeAudio: boolean;
  onPreviewPlaybackError: (sourceId: string, previewKind: "source" | "proxy") => void;
  onTrimChange: (trim: TrimRange) => void;
  onPrepareWaveforms: (streamIndexes: number[], width: number) => void;
  onToggleAudioTrack: (streamIndex: number) => void;
  onSetAllAudioTracksEnabled: (enabled: boolean) => void;
  onAudioTrackVolumeChange: (streamIndex: number, volumePercent: number) => void;
  onAllAudioTracksVolumeChange: (volumePercent: number) => void;
  onToggleAudioMerge: () => void;
  onWaveformImageError: (streamIndex: number) => void;
}

interface EditorShortcutActions {
  enabled: boolean;
  togglePlayback: () => void;
  stepFrame: (direction: -1 | 1) => void;
  setSegmentBoundary: (boundary: TrimBoundary) => void;
}

export function EditorStage({
  sourceId,
  preview,
  trim,
  frameRate,
  audioStreams,
  audioTracks,
  masterVolumePercent,
  mergeAudio,
  onPreviewPlaybackError,
  onTrimChange,
  onPrepareWaveforms,
  onToggleAudioTrack,
  onSetAllAudioTracksEnabled,
  onAudioTrackVolumeChange,
  onAllAudioTracksVolumeChange,
  onToggleAudioMerge,
  onWaveformImageError,
}: EditorStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playheadRef = useRef<HTMLButtonElement>(null);
  const audioPlayheadRef = useRef<HTMLDivElement>(null);
  const playbackFrameRef = useRef<number | null>(null);
  const scrubFrameRef = useRef<number | null>(null);
  const pendingScrubMicrosRef = useRef<number | null>(null);
  const resumeAfterScrubRef = useRef(false);
  const lastPlaybackCommitAtRef = useRef(0);
  const trimRef = useRef(trim);
  const currentPlayheadMicrosRef = useRef(trim.startMicros);
  const segmentDragActiveRef = useRef(false);
  const segmentFollowBoundaryRef = useRef<TrimBoundary | null>(null);
  const shortcutActionsRef = useRef<EditorShortcutActions | null>(null);
  trimRef.current = trim;

  const [playheadMicros, setPlayheadMicros] = useState(trim.startMicros);
  const [isPlaying, setIsPlaying] = useState(false);
  const [safeTrimFollowingEnabled, setSafeTrimFollowingEnabled] = useState(true);
  const [transportError, setTransportError] = useState<string | null>(null);
  const displayedPlayheadMicros = clampPlaybackMicros(playheadMicros, trim.sourceDurationMicros);

  useEffect(
    () => () => {
      cancelFrame(playbackFrameRef);
      cancelFrame(scrubFrameRef);
    },
    [],
  );

  useEffect(() => {
    function handleEditorShortcut(event: globalThis.KeyboardEvent) {
      const actions = shortcutActionsRef.current;
      const shortcut = editorShortcutFromEvent(event);
      if (!actions?.enabled || !shortcut) {
        return;
      }

      const isPriorityShortcut = shortcut === "toggle-playback";
      if (
        !isPriorityShortcut &&
        (event.defaultPrevented || isShortcutBlockedTarget(event.target))
      ) {
        return;
      }

      event.preventDefault();
      if (event.repeat && shortcut !== "previous-frame" && shortcut !== "next-frame") {
        return;
      }

      switch (shortcut) {
        case "toggle-playback":
          actions.togglePlayback();
          break;
        case "previous-frame":
          actions.stepFrame(-1);
          break;
        case "next-frame":
          actions.stepFrame(1);
          break;
        case "set-segment-start":
          actions.setSegmentBoundary("start");
          break;
        case "set-segment-end":
          actions.setSegmentBoundary("end");
          break;
      }
    }

    window.addEventListener("keydown", handleEditorShortcut, true);
    return () => window.removeEventListener("keydown", handleEditorShortcut, true);
  }, []);

  function commitSeek(micros: number) {
    const clamped = clampPlaybackMicros(micros, trimRef.current.sourceDurationMicros);
    currentPlayheadMicrosRef.current = clamped;
    syncPlayheadElements(
      playheadRef.current,
      audioPlayheadRef.current,
      clamped,
      trimRef.current.sourceDurationMicros,
    );
    setPlayheadMicros(clamped);
    seekVideo(videoRef.current, clamped);
  }

  function queueScrubSeek(micros: number) {
    pendingScrubMicrosRef.current = clampPlaybackMicros(
      micros,
      trimRef.current.sourceDurationMicros,
    );
    if (scrubFrameRef.current !== null) {
      return;
    }
    scrubFrameRef.current = requestAnimationFrame(() => {
      scrubFrameRef.current = null;
      const pendingMicros = pendingScrubMicrosRef.current;
      pendingScrubMicrosRef.current = null;
      if (pendingMicros !== null) {
        commitSeek(pendingMicros);
      }
    });
  }

  function flushScrubSeek() {
    cancelFrame(scrubFrameRef);
    const pendingMicros = pendingScrubMicrosRef.current;
    pendingScrubMicrosRef.current = null;
    if (pendingMicros !== null) {
      commitSeek(pendingMicros);
    }
  }

  function handleScrubStart() {
    resumeAfterScrubRef.current = isPlaying;
    videoRef.current?.pause();
    setIsPlaying(false);
    stopPlayheadAnimation();
  }

  function handleScrubEnd() {
    flushScrubSeek();
    const shouldResume = resumeAfterScrubRef.current;
    resumeAfterScrubRef.current = false;
    if (shouldResume) {
      startMediaPlayback();
    }
  }

  function handleTimeUpdate(seconds: number) {
    const durationMicros = trimRef.current.sourceDurationMicros;
    const currentMicros = clampPlaybackMicros(seconds * 1_000_000, durationMicros);
    currentPlayheadMicrosRef.current = currentMicros;
    syncPlayheadElements(
      playheadRef.current,
      audioPlayheadRef.current,
      currentMicros,
      durationMicros,
    );
    setPlayheadMicros(currentMicros);
    if (currentMicros >= durationMicros) {
      stopPlayheadAnimation();
    }
  }

  function startPlayheadAnimation() {
    stopPlayheadAnimation();
    const update = (timestamp: number) => {
      const video = videoRef.current;
      if (!video || video.paused) {
        playbackFrameRef.current = null;
        return;
      }

      const durationMicros = trimRef.current.sourceDurationMicros;
      const currentMicros = clampPlaybackMicros(video.currentTime * 1_000_000, durationMicros);
      currentPlayheadMicrosRef.current = currentMicros;
      syncPlayheadElements(
        playheadRef.current,
        audioPlayheadRef.current,
        currentMicros,
        durationMicros,
      );
      if (timestamp - lastPlaybackCommitAtRef.current >= 100) {
        lastPlaybackCommitAtRef.current = timestamp;
        setPlayheadMicros(currentMicros);
      }

      if (currentMicros >= durationMicros) {
        playbackFrameRef.current = null;
        return;
      }
      playbackFrameRef.current = requestAnimationFrame(update);
    };
    playbackFrameRef.current = requestAnimationFrame(update);
  }

  function stopPlayheadAnimation() {
    cancelFrame(playbackFrameRef);
  }

  function startMediaPlayback() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    setTransportError(null);
    void video.play().catch(() => {
      setIsPlaying(false);
      setTransportError("Playback could not start.");
    });
  }

  function handleTogglePlayback() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    setTransportError(null);
    if (isPlaying) {
      video.pause();
      return;
    }
    if (currentPlayheadMicrosRef.current >= trimRef.current.sourceDurationMicros) {
      commitSeek(0);
    }
    startMediaPlayback();
  }

  function handleStepFrame(direction: -1 | 1) {
    videoRef.current?.pause();
    setIsPlaying(false);
    stopPlayheadAnimation();
    commitSeek(currentPlayheadMicrosRef.current + direction * frameDurationMicros(frameRate));
  }

  function handleSetSegmentBoundary(boundary: TrimBoundary) {
    const currentTrim = trimRef.current;
    const currentPlayheadMicros = currentPlayheadMicrosRef.current;
    if (!canSetTrimBoundaryAtPlayhead(currentTrim, boundary, currentPlayheadMicros)) {
      return;
    }
    const nextTrim = setTrimBoundaryAtPlayhead(currentTrim, boundary, currentPlayheadMicros);
    trimRef.current = nextTrim;
    onTrimChange(nextTrim);
  }

  function handleTrimBoundaryChange(
    boundary: TrimBoundary,
    nextTrim: TrimRange,
  ): TrimBoundary | null {
    const previousTrim = trimRef.current;
    const currentPlayheadMicros = currentPlayheadMicrosRef.current;
    const follow = safeTrimFollowingEnabled
      ? playheadFollowAfterTrimBoundaryMove(previousTrim, nextTrim, boundary, currentPlayheadMicros)
      : { playheadMicros: currentPlayheadMicros, boundary: null };

    trimRef.current = nextTrim;
    onTrimChange(nextTrim);
    if (follow.playheadMicros !== currentPlayheadMicros) {
      commitSeek(follow.playheadMicros);
    }
    return follow.boundary;
  }

  function handleSegmentMove(nextTrim: TrimRange): TrimBoundary | null {
    const previousTrim = trimRef.current;
    const currentPlayheadMicros = currentPlayheadMicrosRef.current;
    const follow =
      safeTrimFollowingEnabled && segmentDragActiveRef.current
        ? playheadAfterSegmentMove(
            previousTrim,
            nextTrim,
            currentPlayheadMicros,
            segmentFollowBoundaryRef.current,
          )
        : { playheadMicros: currentPlayheadMicros, boundary: null };

    segmentFollowBoundaryRef.current = follow.boundary;
    trimRef.current = nextTrim;
    onTrimChange(nextTrim);
    if (follow.playheadMicros !== currentPlayheadMicros) {
      commitSeek(follow.playheadMicros);
    }
    return follow.boundary;
  }

  function handleSegmentDragStart() {
    segmentDragActiveRef.current = true;
    segmentFollowBoundaryRef.current = null;
  }

  function handleSegmentDragEnd() {
    segmentDragActiveRef.current = false;
    segmentFollowBoundaryRef.current = null;
  }

  shortcutActionsRef.current = {
    enabled: preview.status === "ready",
    togglePlayback: handleTogglePlayback,
    stepFrame: handleStepFrame,
    setSegmentBoundary: handleSetSegmentBoundary,
  };

  return (
    <Group
      id="editor-stage-panels"
      orientation="vertical"
      className="editor-stage-content"
      resizeTargetMinimumSize={{ fine: 8, coarse: 24 }}
      aria-label="Preview and timeline panes"
    >
      <Panel id="preview-panel" minSize="14rem" className="editor-pane-content">
        <div className="preview-workspace">
          <VideoPreview
            sourceId={sourceId}
            preview={preview}
            videoRef={videoRef}
            onPlaybackError={onPreviewPlaybackError}
            onLoadedMetadata={() => commitSeek(displayedPlayheadMicros)}
            onTogglePlayback={handleTogglePlayback}
            onPlay={() => {
              setIsPlaying(true);
              startPlayheadAnimation();
            }}
            onPause={() => {
              setIsPlaying(false);
              stopPlayheadAnimation();
              const video = videoRef.current;
              if (video) {
                handleTimeUpdate(video.currentTime);
              }
            }}
            onTimeUpdate={handleTimeUpdate}
          />
        </div>
      </Panel>

      <PaneResizeHandle
        id="preview-timeline-resize-handle"
        label="Resize preview and timeline"
        orientation="horizontal"
      />

      <Panel
        id="timeline-panel"
        defaultSize="22rem"
        minSize="10rem"
        maxSize="70%"
        groupResizeBehavior="preserve-pixel-size"
        className="editor-pane-content"
      >
        <div className="timeline-pane-scroll">
          <TrimTimeline
            range={trim}
            playheadMicros={displayedPlayheadMicros}
            playheadRef={playheadRef}
            frameRate={frameRate}
            playbackControls={
              preview.status === "ready" ? (
                <PlaybackControls
                  isPlaying={isPlaying}
                  error={transportError}
                  canSetSegmentStart={canSetTrimBoundaryAtPlayhead(
                    trim,
                    "start",
                    displayedPlayheadMicros,
                  )}
                  canSetSegmentEnd={canSetTrimBoundaryAtPlayhead(
                    trim,
                    "end",
                    displayedPlayheadMicros,
                  )}
                  onTogglePlayback={handleTogglePlayback}
                  onStepFrame={handleStepFrame}
                  onSetSegmentBoundary={handleSetSegmentBoundary}
                />
              ) : null
            }
            playbackTimecode={
              preview.status === "ready" ? (
                <PlaybackTimecode
                  currentMicros={displayedPlayheadMicros}
                  sourceDurationMicros={trim.sourceDurationMicros}
                />
              ) : null
            }
            videoToolbar={
              preview.status === "ready" ? (
                <TimelineTools
                  safeTrimFollowingEnabled={safeTrimFollowingEnabled}
                  onToggleSafeTrimFollowing={() =>
                    setSafeTrimFollowingEnabled((enabled) => !enabled)
                  }
                />
              ) : null
            }
            audioRows={
              <AudioTracks
                streams={audioStreams}
                tracks={audioTracks}
                masterVolumePercent={masterVolumePercent}
                range={trim}
                playheadMicros={displayedPlayheadMicros}
                playheadRef={audioPlayheadRef}
                mergeAudio={mergeAudio}
                onToggleTrack={onToggleAudioTrack}
                onSetAllTracksEnabled={onSetAllAudioTracksEnabled}
                onTrackVolumeChange={onAudioTrackVolumeChange}
                onSetAllTracksVolume={onAllAudioTracksVolumeChange}
                onToggleMerge={onToggleAudioMerge}
                onPrepareWaveforms={onPrepareWaveforms}
                onWaveformImageError={onWaveformImageError}
              />
            }
            onChange={handleTrimBoundaryChange}
            onMoveSegment={handleSegmentMove}
            onSegmentDragStart={handleSegmentDragStart}
            onSegmentDragEnd={handleSegmentDragEnd}
            onSeek={commitSeek}
            onScrubStart={handleScrubStart}
            onScrub={queueScrubSeek}
            onScrubEnd={handleScrubEnd}
          />
        </div>
      </Panel>
    </Group>
  );
}

function seekVideo(video: HTMLVideoElement | null, micros: number) {
  if (!video) {
    return;
  }
  try {
    video.currentTime = micros / 1_000_000;
  } catch {
    // Metadata may not be ready yet; loadedmetadata retries the seek.
  }
}

function syncPlayheadElements(
  playhead: HTMLButtonElement | null,
  audioPlayhead: HTMLDivElement | null,
  micros: number,
  durationMicros: number,
) {
  const percent = durationMicros > 0 ? (micros / durationMicros) * 100 : 0;
  if (playhead) {
    playhead.style.left = `${percent}%`;
    playhead.setAttribute("aria-valuenow", micros.toString());
    playhead.setAttribute("aria-valuetext", `${(micros / 1_000_000).toFixed(3)} seconds`);
    playhead.title = formatPlaybackTime(micros);
  }
  if (audioPlayhead) {
    audioPlayhead.style.left = `${percent}%`;
  }
}

function cancelFrame(frameRef: { current: number | null }) {
  if (frameRef.current !== null) {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }
}

type EditorShortcut =
  "toggle-playback" | "previous-frame" | "next-frame" | "set-segment-start" | "set-segment-end";

function editorShortcutFromEvent(event: globalThis.KeyboardEvent): EditorShortcut | null {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return null;
  }
  switch (event.key.toLowerCase()) {
    case " ":
      return "toggle-playback";
    case "arrowleft":
      return "previous-frame";
    case "arrowright":
      return "next-frame";
    case "i":
      return "set-segment-start";
    case "o":
      return "set-segment-end";
    default:
      return null;
  }
}

function isShortcutBlockedTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      "input, textarea, select, button, [contenteditable]:not([contenteditable='false'])",
    ) !== null
  );
}
