import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { clampPlaybackMicros, frameDurationMicros } from "@/domain/playback";
import {
  canSetTrimBoundaryAtPlayhead,
  playheadAfterSegmentMove,
  playheadFollowAfterTrimBoundaryMove,
  setTrimBoundaryAtPlayhead,
  type TrimBoundary,
  type TrimRange,
} from "@/domain/trim";
import { isApplicationDialogOpen } from "@/lib/hotkeys";
import { useTimelineTools } from "@/app/hooks/useTimelineTools";
import { useSourceDetails } from "@/app/hooks/useSourceDetails";
import { usePlaybackModes } from "@/features/editor/hooks/usePlaybackModes";
import { synchronizeAudioPosition } from "@/features/editor/utils/audio-sync";
import { editorShortcutFromEvent, isShortcutBlockedTarget } from "@/features/editor/utils/editor-shortcuts";
import {
  cancelFrame,
  seekMediaIfNeeded,
  seekVideo,
  syncPlayheadElements,
  waitForSeekToSettle,
} from "@/features/editor/utils/media-sync";

const EMPTY_TRIM: TrimRange = {
  startMicros: 0,
  endMicros: 0,
  sourceDurationMicros: 0,
};

export interface EditorInteractionValue {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playheadRef: React.RefObject<HTMLButtonElement | null>;
  audioPlayheadRef: React.RefObject<HTMLDivElement | null>;
  playheadMicros: number;
  displayedPlayheadMicros: number;
  isPlaying: boolean;
  transportError: string | null;
  playbackRate: number;
  onLoadedMetadata: () => void;
  onPlay: () => void;
  onPause: () => void;
  onTimeUpdate: (seconds: number) => void;
  onEnded: () => void;
  onTogglePlayback: () => void;
  onStepFrame: (direction: -1 | 1) => void;
  onSetSegmentBoundary: (boundary: TrimBoundary) => void;
  onTrimBoundaryChange: (boundary: TrimBoundary, nextTrim: TrimRange) => TrimBoundary | null;
  onSegmentMove: (nextTrim: TrimRange) => TrimBoundary | null;
  onTrimDragStart: () => void;
  onTrimDragEnd: () => void;
  onSegmentDragStart: () => void;
  onSegmentDragEnd: () => void;
  onSeek: (micros: number) => void;
  onScrubStart: () => void;
  onScrub: (micros: number) => void;
  onScrubEnd: () => void;
  onCropToolOpenChange: (isOpen: boolean) => void;
  onPreviewPlaybackError: (previewKind: "source" | "proxy") => void;
  canSetSegmentStart: boolean;
  canSetSegmentEnd: boolean;
}

export function useEditorInteractionController(): EditorInteractionValue {
  const { t } = useTranslation();
  const source = useSourceDetails();
  const tools = useTimelineTools();
  const trim = source.trim ?? EMPTY_TRIM;
  const preview = source.preview;
  const frameRate = source.frameRate;
  const audioTracks = source.audioTracks;
  const audioPreviewUrls = source.audioPreviewUrls;
  const [playheadMicros, setPlayheadMicros] = useState(trim.startMicros);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transportError, setTransportError] = useState<string | null>(null);
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
  const trimCommitFrameRef = useRef<number | null>(null);
  const pendingTrimCommitRef = useRef<TrimRange | null>(null);
  const resumeAfterScrubRef = useRef(false);
  const timelineInteractionActiveRef = useRef(false);
  const playbackStartSequenceRef = useRef(0);
  const playbackRequestedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const resumeAfterCropRef = useRef(false);
  const lastPlaybackCommitAtRef = useRef(0);
  const trimRef = useRef(trim);
  const currentPlayheadMicrosRef = useRef(trim.startMicros);
  const segmentDragActiveRef = useRef(false);
  const segmentFollowBoundaryRef = useRef<TrimBoundary | null>(null);
  const shortcutActionsRef = useRef<{
    enabled: boolean;
    togglePlayback: () => void;
    stepFrame: (direction: -1 | 1) => void;
    setSegmentBoundary: (boundary: TrimBoundary) => void;
  } | null>(null);

  useEffect(() => {
    trimRef.current = trim;
    if (currentPlayheadMicrosRef.current > trim.sourceDurationMicros) {
      currentPlayheadMicrosRef.current = trim.sourceDurationMicros;
      setPlayheadMicros(trim.sourceDurationMicros);
    }
  }, [trim]);

  const playbackModes = usePlaybackModes({
    loopEnabled: tools.loopPlaybackEnabled,
    segmentEnabled: tools.segmentPlaybackEnabled,
    onLoopEnabledChange: () => tools.toggleLoopPlayback(),
    onSegmentEnabledChange: () => tools.toggleSegmentPlayback(),
  });
  const displayedPlayheadMicros = clampPlaybackMicros(playheadMicros, trim.sourceDurationMicros);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = tools.playbackSpeed;
    for (const audio of audioElementsRef.current.values()) audio.playbackRate = tools.playbackSpeed;
  }, [audioPreviewUrls, tools.playbackSpeed]);

  useEffect(() => {
    if (typeof AudioContext === "undefined") return;
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
      element.playbackRate = tools.playbackSpeed;
      element.setAttribute("aria-hidden", "true");
      element.style.display = "none";
      document.body.appendChild(element);
      const audioSource = context.createMediaElementSource(element);
      const gain = context.createGain();
      audioSource.connect(gain).connect(masterGain);
      audioElementsRef.current.set(streamIndex, element);
      audioNodesRef.current.set(streamIndex, { source: audioSource, gain });
    }
  }, [audioPreviewUrls, tools.playbackSpeed]);

  useEffect(() => {
    const masterGain = masterGainRef.current;
    if (masterGain) masterGain.gain.value = source.masterEnabled ? source.masterVolumePercent / 50 : 0;
    for (const track of audioTracks) {
      const node = audioNodesRef.current.get(track.streamIndex);
      if (node) node.gain.gain.value = track.enabled ? track.volumePercent / 50 : 0;
    }
  }, [audioTracks, source.masterEnabled, source.masterVolumePercent, audioPreviewUrls]);

  useEffect(() => {
    function handleEditorShortcut(event: globalThis.KeyboardEvent) {
      if (isApplicationDialogOpen() || timelineInteractionActiveRef.current) return;
      const actions = shortcutActionsRef.current;
      const shortcut = editorShortcutFromEvent(event);
      if (!actions?.enabled || !shortcut) return;
      const isPriorityShortcut = shortcut === "toggle-playback";
      if (!isPriorityShortcut && (event.defaultPrevented || isShortcutBlockedTarget(event.target))) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat && shortcut !== "previous-frame" && shortcut !== "next-frame") return;
      if (shortcut === "toggle-playback") actions.togglePlayback();
      if (shortcut === "previous-frame") actions.stepFrame(-1);
      if (shortcut === "next-frame") actions.stepFrame(1);
      if (shortcut === "set-segment-start") actions.setSegmentBoundary("start");
      if (shortcut === "set-segment-end") actions.setSegmentBoundary("end");
    }
    window.addEventListener("keydown", handleEditorShortcut, true);
    return () => window.removeEventListener("keydown", handleEditorShortcut, true);
  }, []);

  const stopPlayheadAnimation = useCallback(() => cancelFrame(playbackFrameRef), []);
  const pauseAudioPlayback = useCallback(() => {
    for (const audio of audioElementsRef.current.values()) audio.pause();
  }, []);
  const syncAudioPlayback = useCallback((seconds: number, force = false) => {
    for (const audio of audioElementsRef.current.values()) synchronizeAudioPosition(audio, seconds, force);
  }, []);

  const commitSeek = useCallback((micros: number) => {
    const clamped = clampPlaybackMicros(micros, trimRef.current.sourceDurationMicros);
    currentPlayheadMicrosRef.current = clamped;
    syncPlayheadElements(playheadRef.current, audioPlayheadRef.current, clamped, trimRef.current.sourceDurationMicros);
    setPlayheadMicros(clamped);
    seekVideo(videoRef.current, clamped);
    for (const audio of audioElementsRef.current.values()) seekMediaIfNeeded(audio, clamped / 1_000_000);
  }, []);

  const startMediaPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const startMicros = currentPlayheadMicrosRef.current;
    const startSequence = ++playbackStartSequenceRef.current;
    playbackRequestedRef.current = true;
    setTransportError(null);
    void audioContextRef.current?.resume();
    seekVideo(video, startMicros);
    syncAudioPlayback(startMicros / 1_000_000, true);
    const seekingMedia = [video, ...audioElementsRef.current.values()].filter((media) => media.seeking);
    const begin = () => {
      if (startSequence !== playbackStartSequenceRef.current) return;
      void video.play().then(() => {
        if (startSequence !== playbackStartSequenceRef.current) {
          video.pause();
          return;
        }
        syncAudioPlayback(video.currentTime);
        return Promise.all([...audioElementsRef.current.values()].map((audio) => audio.play()));
      }).catch(() => {
        if (startSequence !== playbackStartSequenceRef.current) return;
        playbackStartSequenceRef.current += 1;
        playbackRequestedRef.current = false;
        isPlayingRef.current = false;
        video.pause();
        pauseAudioPlayback();
        setIsPlaying(false);
        stopPlayheadAnimation();
        setTransportError(t("preview.playbackFailed"));
      });
    };
    if (seekingMedia.length === 0) begin();
    else void Promise.all(seekingMedia.map(waitForSeekToSettle)).then(begin);
  }, [pauseAudioPlayback, stopPlayheadAnimation, syncAudioPlayback, t]);

  const handlePlaybackBoundary = useCallback((currentMicros: number): boolean => {
    const boundary = playbackModes.consumeBoundary(currentMicros, trimRef.current);
    if (!boundary.reached) return false;
    if (!boundary.action) return true;
    if (boundary.action.type === "restart") {
      commitSeek(boundary.action.positionMicros);
      startMediaPlayback();
      return true;
    }
    playbackStartSequenceRef.current += 1;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    videoRef.current?.pause();
    pauseAudioPlayback();
    setIsPlaying(false);
    stopPlayheadAnimation();
    commitSeek(boundary.action.positionMicros);
    return true;
  }, [commitSeek, pauseAudioPlayback, playbackModes, startMediaPlayback, stopPlayheadAnimation]);

  const startPlayheadAnimation = useCallback(() => {
    stopPlayheadAnimation();
    const update = (timestamp: number) => {
      const video = videoRef.current;
      if (!video || video.paused) {
        playbackFrameRef.current = null;
        return;
      }
      const currentMicros = clampPlaybackMicros(video.currentTime * 1_000_000, trimRef.current.sourceDurationMicros);
      currentPlayheadMicrosRef.current = currentMicros;
      syncPlayheadElements(playheadRef.current, audioPlayheadRef.current, currentMicros, trimRef.current.sourceDurationMicros);
      if (timestamp - lastPlaybackCommitAtRef.current >= 100) {
        lastPlaybackCommitAtRef.current = timestamp;
        setPlayheadMicros(currentMicros);
      }
      if (handlePlaybackBoundary(currentMicros)) {
        playbackFrameRef.current = video.paused ? null : requestAnimationFrame(update);
        return;
      }
      playbackFrameRef.current = requestAnimationFrame(update);
    };
    playbackFrameRef.current = requestAnimationFrame(update);
  }, [handlePlaybackBoundary, stopPlayheadAnimation]);

  useEffect(() => () => {
    playbackStartSequenceRef.current += 1;
    cancelFrame(playbackFrameRef);
    cancelFrame(scrubFrameRef);
    cancelFrame(trimCommitFrameRef);
    for (const element of audioElementsRef.current.values()) {
      element.pause();
      element.remove();
    }
    for (const node of audioNodesRef.current.values()) {
      node.source.disconnect();
      node.gain.disconnect();
    }
    void audioContextRef.current?.close();
  }, []);

  const flushTrimCommit = useCallback(() => {
    cancelFrame(trimCommitFrameRef);
    const pendingTrim = pendingTrimCommitRef.current;
    pendingTrimCommitRef.current = null;
    if (pendingTrim) source.onTrimChange(pendingTrim);
  }, [source]);
  const queueTrimCommit = useCallback((nextTrim: TrimRange) => {
    pendingTrimCommitRef.current = nextTrim;
    if (trimCommitFrameRef.current !== null) return;
    trimCommitFrameRef.current = requestAnimationFrame(() => {
      trimCommitFrameRef.current = null;
      const pendingTrim = pendingTrimCommitRef.current;
      pendingTrimCommitRef.current = null;
      if (pendingTrim) source.onTrimChange(pendingTrim);
    });
  }, [source]);
  const queueScrubSeek = useCallback((micros: number) => {
    pendingScrubMicrosRef.current = clampPlaybackMicros(micros, trimRef.current.sourceDurationMicros);
    if (scrubFrameRef.current !== null) return;
    scrubFrameRef.current = requestAnimationFrame(() => {
      scrubFrameRef.current = null;
      const pendingMicros = pendingScrubMicrosRef.current;
      pendingScrubMicrosRef.current = null;
      if (pendingMicros !== null) commitSeek(pendingMicros);
    });
  }, [commitSeek]);
  const flushScrubSeek = useCallback(() => {
    cancelFrame(scrubFrameRef);
    const pendingMicros = pendingScrubMicrosRef.current;
    pendingScrubMicrosRef.current = null;
    if (pendingMicros !== null) commitSeek(pendingMicros);
  }, [commitSeek]);
  const handleScrubStart = useCallback(() => {
    timelineInteractionActiveRef.current = true;
    playbackStartSequenceRef.current += 1;
    resumeAfterScrubRef.current = playbackRequestedRef.current || isPlayingRef.current;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    videoRef.current?.pause();
    pauseAudioPlayback();
    setIsPlaying(false);
    stopPlayheadAnimation();
  }, [pauseAudioPlayback, stopPlayheadAnimation]);
  const handleScrubEnd = useCallback(() => {
    flushScrubSeek();
    timelineInteractionActiveRef.current = false;
    if (resumeAfterScrubRef.current) {
      resumeAfterScrubRef.current = false;
      playbackModes.startMicros(currentPlayheadMicrosRef.current, trimRef.current);
      playbackModes.resetBoundary();
      startMediaPlayback();
    }
  }, [flushScrubSeek, playbackModes, startMediaPlayback]);

  const handleTogglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setTransportError(null);
    if (playbackRequestedRef.current || isPlayingRef.current) {
      playbackStartSequenceRef.current += 1;
      playbackRequestedRef.current = false;
      isPlayingRef.current = false;
      video.pause();
      return;
    }
    const startMicros = playbackModes.startMicros(currentPlayheadMicrosRef.current, trimRef.current);
    if (startMicros !== currentPlayheadMicrosRef.current) commitSeek(startMicros);
    playbackModes.resetBoundary();
    startMediaPlayback();
  }, [commitSeek, playbackModes, startMediaPlayback]);
  const handleStepFrame = useCallback((direction: -1 | 1) => {
    playbackStartSequenceRef.current += 1;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    videoRef.current?.pause();
    setIsPlaying(false);
    stopPlayheadAnimation();
    commitSeek(currentPlayheadMicrosRef.current + direction * frameDurationMicros(frameRate));
  }, [commitSeek, frameRate, stopPlayheadAnimation]);
  const handleSetSegmentBoundary = useCallback((boundary: TrimBoundary) => {
    if (!source.trim) return;
    const currentMicros = currentPlayheadMicrosRef.current;
    if (!canSetTrimBoundaryAtPlayhead(trimRef.current, boundary, currentMicros)) return;
    const nextTrim = setTrimBoundaryAtPlayhead(trimRef.current, boundary, currentMicros);
    trimRef.current = nextTrim;
    flushTrimCommit();
    source.onTrimChange(nextTrim);
  }, [flushTrimCommit, source]);
  const handleTrimBoundaryChange = useCallback((boundary: TrimBoundary, nextTrim: TrimRange) => {
    const currentMicros = currentPlayheadMicrosRef.current;
    const follow = tools.safeTrimFollowingEnabled
      ? playheadFollowAfterTrimBoundaryMove(trimRef.current, nextTrim, boundary, currentMicros)
      : { playheadMicros: currentMicros, boundary: null };
    trimRef.current = nextTrim;
    queueTrimCommit(nextTrim);
    if (follow.playheadMicros !== currentMicros) queueScrubSeek(follow.playheadMicros);
    return follow.boundary;
  }, [queueScrubSeek, queueTrimCommit, tools.safeTrimFollowingEnabled]);
  const handleSegmentMove = useCallback((nextTrim: TrimRange) => {
    const currentMicros = currentPlayheadMicrosRef.current;
    const follow = tools.safeTrimFollowingEnabled && segmentDragActiveRef.current
      ? playheadAfterSegmentMove(trimRef.current, nextTrim, currentMicros, segmentFollowBoundaryRef.current)
      : { playheadMicros: currentMicros, boundary: null };
    segmentFollowBoundaryRef.current = follow.boundary;
    trimRef.current = nextTrim;
    queueTrimCommit(nextTrim);
    if (follow.playheadMicros !== currentMicros) queueScrubSeek(follow.playheadMicros);
    return follow.boundary;
  }, [queueScrubSeek, queueTrimCommit, tools.safeTrimFollowingEnabled]);
  const handleSegmentDragStart = useCallback(() => {
    segmentDragActiveRef.current = true;
    segmentFollowBoundaryRef.current = null;
    handleScrubStart();
  }, [handleScrubStart]);
  const handleSegmentDragEnd = useCallback(() => {
    segmentDragActiveRef.current = false;
    segmentFollowBoundaryRef.current = null;
    flushTrimCommit();
    handleScrubEnd();
  }, [flushTrimCommit, handleScrubEnd]);
  const handleTrimDragEnd = useCallback(() => {
    flushTrimCommit();
    handleScrubEnd();
  }, [flushTrimCommit, handleScrubEnd]);

  const onTimeUpdate = useCallback((seconds: number) => {
    const currentMicros = clampPlaybackMicros(seconds * 1_000_000, trimRef.current.sourceDurationMicros);
    currentPlayheadMicrosRef.current = currentMicros;
    syncPlayheadElements(playheadRef.current, audioPlayheadRef.current, currentMicros, trimRef.current.sourceDurationMicros);
    setPlayheadMicros(currentMicros);
    if (isPlayingRef.current && handlePlaybackBoundary(currentMicros)) return;
    syncAudioPlayback(seconds);
    if (currentMicros >= trimRef.current.sourceDurationMicros) stopPlayheadAnimation();
  }, [handlePlaybackBoundary, stopPlayheadAnimation, syncAudioPlayback]);
  const onPause = useCallback(() => {
    if (isPlayingRef.current) {
      void videoRef.current?.play().catch(() => undefined);
      return;
    }
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    setIsPlaying(false);
    pauseAudioPlayback();
    stopPlayheadAnimation();
    if (videoRef.current) onTimeUpdate(videoRef.current.currentTime);
  }, [onTimeUpdate, pauseAudioPlayback, stopPlayheadAnimation]);
  const onCropToolOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) {
      resumeAfterCropRef.current = playbackRequestedRef.current || isPlayingRef.current;
      if (!resumeAfterCropRef.current) return;
      playbackStartSequenceRef.current += 1;
      playbackRequestedRef.current = false;
      isPlayingRef.current = false;
      videoRef.current?.pause();
      pauseAudioPlayback();
      setIsPlaying(false);
      stopPlayheadAnimation();
      return;
    }
    if (resumeAfterCropRef.current) {
      resumeAfterCropRef.current = false;
      startMediaPlayback();
    }
  }, [pauseAudioPlayback, startMediaPlayback, stopPlayheadAnimation]);
  const onPreviewPlaybackError = useCallback((previewKind: "source" | "proxy") => {
    playbackStartSequenceRef.current += 1;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    videoRef.current?.pause();
    pauseAudioPlayback();
    setIsPlaying(false);
    stopPlayheadAnimation();
    source.onPreviewPlaybackError(previewKind);
  }, [pauseAudioPlayback, source, stopPlayheadAnimation]);

  useEffect(() => {
    shortcutActionsRef.current = {
      enabled: preview.status === "ready",
      togglePlayback: handleTogglePlayback,
      stepFrame: handleStepFrame,
      setSegmentBoundary: handleSetSegmentBoundary,
    };
  }, [handleSetSegmentBoundary, handleStepFrame, handleTogglePlayback, preview.status]);

  return {
    videoRef,
    playheadRef,
    audioPlayheadRef,
    playheadMicros,
    displayedPlayheadMicros,
    isPlaying,
    transportError,
    playbackRate: tools.playbackSpeed,
    onLoadedMetadata: () => commitSeek(displayedPlayheadMicros),
    onPlay: () => {
      playbackRequestedRef.current = true;
      isPlayingRef.current = true;
      setIsPlaying(true);
      startPlayheadAnimation();
    },
    onPause,
    onTimeUpdate,
    onEnded: () => {
      if (videoRef.current) handlePlaybackBoundary(videoRef.current.currentTime * 1_000_000);
    },
    onTogglePlayback: handleTogglePlayback,
    onStepFrame: handleStepFrame,
    onSetSegmentBoundary: handleSetSegmentBoundary,
    onTrimBoundaryChange: handleTrimBoundaryChange,
    onSegmentMove: handleSegmentMove,
    onTrimDragStart: handleScrubStart,
    onTrimDragEnd: handleTrimDragEnd,
    onSegmentDragStart: handleSegmentDragStart,
    onSegmentDragEnd: handleSegmentDragEnd,
    onSeek: commitSeek,
    onScrubStart: handleScrubStart,
    onScrub: queueScrubSeek,
    onScrubEnd: handleScrubEnd,
    onCropToolOpenChange,
    onPreviewPlaybackError,
    canSetSegmentStart: canSetTrimBoundaryAtPlayhead(trim, "start", displayedPlayheadMicros),
    canSetSegmentEnd: canSetTrimBoundaryAtPlayhead(trim, "end", displayedPlayheadMicros),
  };
}
