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
  masterEnabled: boolean;
  masterVolumePercent: number;
  mergeAudio: boolean;
  onPreviewPlaybackError: (sourceId: string, previewKind: "source" | "proxy") => void;
  onTrimChange: (trim: TrimRange) => void;
  onPrepareWaveforms: (streamIndexes: number[], width: number) => void;
  onToggleAudioTrack: (streamIndex: number) => void;
  onAudioTrackVolumeChange: (streamIndex: number, volumePercent: number) => void;
  onToggleAudioMaster: () => void;
  onMasterVolumeChange: (volumePercent: number) => void;
  onToggleAudioMerge: () => void;
  onWaveformImageError: (streamIndex: number) => void;
  audioPreviewUrls: Record<number, string>;
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
  masterEnabled,
  masterVolumePercent,
  mergeAudio,
  onPreviewPlaybackError,
  onTrimChange,
  onPrepareWaveforms,
  onToggleAudioTrack,
  onAudioTrackVolumeChange,
  onToggleAudioMaster,
  onMasterVolumeChange,
  onToggleAudioMerge,
  onWaveformImageError,
  audioPreviewUrls,
}: EditorStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioElementsRef = useRef(new Map<number, HTMLAudioElement>());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef(
    new Map<number, { source: MediaElementAudioSourceNode; gain: GainNode }>(),
  );
  const masterGainRef = useRef<GainNode | null>(null);
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
    const video = videoRef.current;
    if (video) {
      const hasIndependentAudio = Object.keys(audioPreviewUrls).length > 0;
      video.muted = hasIndependentAudio;
      video.volume = hasIndependentAudio ? 0 : 1;
    }
  }, [audioPreviewUrls]);

  useEffect(() => {
    if (typeof AudioContext === "undefined") {
      return;
    }
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    let masterGain = masterGainRef.current;
    if (!masterGain) {
      masterGain = context.createGain();
      masterGainRef.current = masterGain;
      masterGain.connect(context.destination);
    }

    const activeStreamIndexes = new Set(Object.keys(audioPreviewUrls).map(Number));
    for (const [streamIndex, element] of audioElementsRef.current) {
      if (activeStreamIndexes.has(streamIndex)) continue;
      element.pause();
      element.remove();
      audioElementsRef.current.delete(streamIndex);
      audioNodesRef.current.get(streamIndex)?.source.disconnect();
      audioNodesRef.current.get(streamIndex)?.gain.disconnect();
      audioNodesRef.current.delete(streamIndex);
    }

    for (const [streamIndexText, url] of Object.entries(audioPreviewUrls)) {
      const streamIndex = Number(streamIndexText);
      if (audioElementsRef.current.has(streamIndex)) continue;
      const element = new Audio();
      element.crossOrigin = "anonymous";
      element.src = url;
      element.preload = "auto";
      element.setAttribute("aria-hidden", "true");
      element.style.display = "none";
      document.body.appendChild(element);
      const source = context.createMediaElementSource(element);
      const gain = context.createGain();
      source.connect(gain).connect(masterGain);
      audioElementsRef.current.set(streamIndex, element);
      audioNodesRef.current.set(streamIndex, { source, gain });
    }

    if (isPlaying) {
      const seconds = videoRef.current?.currentTime ?? 0;
      void context.resume();
      syncAudioPlayback(seconds);
      void Promise.all([...audioElementsRef.current.values()].map((audio) => audio.play())).catch(
        () => undefined,
      );
    }

    return () => {
      // Keep the graph alive across volume changes; elements are disposed on source unmount.
    };
  }, [audioPreviewUrls, isPlaying]);

  useEffect(() => {
    const masterGain = masterGainRef.current;
    if (masterGain) {
      masterGain.gain.value = masterEnabled ? masterVolumePercent / 50 : 0;
    }
    for (const track of audioTracks) {
      const node = audioNodesRef.current.get(track.streamIndex);
      if (node) {
        node.gain.gain.value = track.enabled ? track.volumePercent / 50 : 0;
      }
    }
  }, [audioTracks, masterEnabled, masterVolumePercent, audioPreviewUrls]);

  useEffect(
    () => () => {
      for (const element of audioElementsRef.current.values()) {
        element.pause();
        element.remove();
      }
      audioElementsRef.current.clear();
      for (const node of audioNodesRef.current.values()) {
        node.source.disconnect();
        node.gain.disconnect();
      }
      audioNodesRef.current.clear();
      void audioContextRef.current?.close();
      audioContextRef.current = null;
      masterGainRef.current = null;
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
      event.stopPropagation();
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
      frameRate,
    );
    setPlayheadMicros(clamped);
    seekVideo(videoRef.current, clamped);
    for (const audio of audioElementsRef.current.values()) {
      try {
        audio.currentTime = clamped / 1_000_000;
      } catch {
        // Audio metadata may not be ready yet; playback start retries synchronization.
      }
    }
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
    pauseAudioPlayback();
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
      frameRate,
    );
    setPlayheadMicros(currentMicros);
    syncAudioPlayback(seconds);
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
        frameRate,
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
    void audioContextRef.current?.resume();
    syncAudioPlayback(video.currentTime);
    void video
      .play()
      .then(() => Promise.all([...audioElementsRef.current.values()].map((audio) => audio.play())))
      .catch(() => {
        pauseAudioPlayback();
        setIsPlaying(false);
        setTransportError("Playback could not start.");
      });
  }

  function pauseAudioPlayback() {
    for (const audio of audioElementsRef.current.values()) {
      audio.pause();
    }
  }

  function syncAudioPlayback(seconds: number) {
    for (const audio of audioElementsRef.current.values()) {
      if (Math.abs(audio.currentTime - seconds) > 0.08) {
        try {
          audio.currentTime = seconds;
        } catch {
          // Audio metadata may not be ready yet.
        }
      }
    }
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
              pauseAudioPlayback();
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
                  frameRate={frameRate}
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
                masterEnabled={masterEnabled}
                masterVolumePercent={masterVolumePercent}
                range={trim}
                playheadMicros={displayedPlayheadMicros}
                playheadRef={audioPlayheadRef}
                mergeAudio={mergeAudio}
                onToggleTrack={onToggleAudioTrack}
                onTrackVolumeChange={onAudioTrackVolumeChange}
                onToggleMaster={onToggleAudioMaster}
                onMasterVolumeChange={onMasterVolumeChange}
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
  frameRate?: FrameRate,
) {
  const percent = durationMicros > 0 ? (micros / durationMicros) * 100 : 0;
  if (playhead) {
    playhead.style.left = `${percent}%`;
    playhead.setAttribute("aria-valuenow", micros.toString());
    playhead.setAttribute("aria-valuetext", `${(micros / 1_000_000).toFixed(3)} seconds`);
    playhead.title = formatPlaybackTime(micros, frameRate);
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
  if (!(target instanceof Element)) {
    return false;
  }
  if (target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) {
    return true;
  }
  const button = target.closest("button");
  return button !== null && !button.classList.contains("transport-button");
}
