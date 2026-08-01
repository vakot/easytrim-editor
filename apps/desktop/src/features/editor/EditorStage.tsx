import { useEffect, useRef, useState } from "react";
import { Group, Panel } from "react-resizable-panels";
import { useTranslation } from "react-i18next";

import { PaneResizeHandle } from "../../components/PaneResizeHandle";
import { clampPlaybackMicros, frameDurationMicros } from "../../domain/playback";
import {
  canSetTrimBoundaryAtPlayhead,
  playheadAfterSegmentMove,
  playheadFollowAfterTrimBoundaryMove,
  setTrimBoundaryAtPlayhead,
  type TrimBoundary,
  type TrimRange,
} from "../../domain/trim";
import { AudioTracks } from "../audio-tracks";
import { PlaybackControls, PlaybackTimecode, TimelineTools } from "../preview/PlaybackControls";
import { VideoPreview } from "../preview/VideoPreview";
import { TrimTimeline } from "../timeline";
import { TimelinePane } from "./components/TimelinePane";
import { useTimelinePanelSizing } from "./hooks/use-timeline-panel-sizing";
import type { EditorShortcutActions, EditorStageProps } from "./types";
import { editorShortcutFromEvent, isShortcutBlockedTarget } from "./utils/editor-shortcuts";
import {
  cancelFrame,
  seekMediaIfNeeded,
  seekVideo,
  syncPlayheadElements,
  waitForSeekToSettle,
} from "./utils/media-sync";

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
  const { t } = useTranslation();
  const timelinePanelSizing = useTimelinePanelSizing(sourceId);
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
  const playbackStartSequenceRef = useRef(0);
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
      playbackStartSequenceRef.current += 1;
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

    return () => {
      // Keep the graph alive across volume changes; elements are disposed on source unmount.
    };
  }, [audioPreviewUrls]);

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
      seekMediaIfNeeded(audio, clamped / 1_000_000);
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
    playbackStartSequenceRef.current += 1;
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
    const startMicros = currentPlayheadMicrosRef.current;
    const startSeconds = startMicros / 1_000_000;
    const startSequence = ++playbackStartSequenceRef.current;
    setTransportError(null);
    void audioContextRef.current?.resume();
    seekVideo(video, startMicros);
    syncAudioPlayback(startSeconds);

    const seekingMedia = [video, ...audioElementsRef.current.values()].filter(
      (media) => media.seeking,
    );
    if (seekingMedia.length === 0) {
      beginMediaPlayback(video, startSequence);
      return;
    }
    void Promise.all(seekingMedia.map(waitForSeekToSettle)).then(() => {
      beginMediaPlayback(video, startSequence);
    });
  }

  function beginMediaPlayback(video: HTMLVideoElement, startSequence: number) {
    if (startSequence !== playbackStartSequenceRef.current) {
      return;
    }
    void video
      .play()
      .then(() => {
        if (startSequence !== playbackStartSequenceRef.current) {
          video.pause();
          return;
        }
        syncAudioPlayback(video.currentTime);
        return Promise.all([...audioElementsRef.current.values()].map((audio) => audio.play()));
      })
      .catch(() => {
        if (startSequence !== playbackStartSequenceRef.current) {
          return;
        }
        pauseAudioPlayback();
        setIsPlaying(false);
        setTransportError(t("preview.playbackFailed"));
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
      playbackStartSequenceRef.current += 1;
      video.pause();
      return;
    }
    if (currentPlayheadMicrosRef.current >= trimRef.current.sourceDurationMicros) {
      commitSeek(0);
    }
    startMediaPlayback();
  }

  function handleStepFrame(direction: -1 | 1) {
    playbackStartSequenceRef.current += 1;
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
      className="min-h-0 min-w-0 bg-background"
      resizeTargetMinimumSize={{ fine: 8, coarse: 24 }}
      aria-label={t("preview.panes")}
    >
      <Panel id="preview-panel" minSize="14rem" className="min-h-0 min-w-0">
        <div className="grid size-full min-h-0 place-items-center overflow-auto bg-preview-surface p-3">
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
        label={t("preview.resize")}
        orientation="horizontal"
      />

      <Panel
        id="timeline-panel"
        panelRef={timelinePanelSizing.panelRef}
        defaultSize={timelinePanelSizing.constraints.defaultSize}
        minSize={timelinePanelSizing.constraints.minSize}
        maxSize={timelinePanelSizing.constraints.maxSize}
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0 min-w-0 bg-background"
      >
        <TimelinePane
          onSizeConstraintsChange={timelinePanelSizing.onSizeConstraintsChange}
          timeline={
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
              onChange={handleTrimBoundaryChange}
              onMoveSegment={handleSegmentMove}
              onSegmentDragStart={handleSegmentDragStart}
              onSegmentDragEnd={handleSegmentDragEnd}
              onSeek={commitSeek}
              onScrubStart={handleScrubStart}
              onScrub={queueScrubSeek}
              onScrubEnd={handleScrubEnd}
            />
          }
          audioTracks={
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
        />
      </Panel>
    </Group>
  );
}
