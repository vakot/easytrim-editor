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
import { useAppDispatch, useAppSelector } from "@/app/store/hooks";
import {
  loopPlaybackChanged,
  segmentPlaybackChanged,
  selectEditorTools,
} from "@/app/store/slices/editor-tools-slice";
import { useSourceDetails } from "@/app/hooks/useSourceDetails";
import { usePlaybackModes } from "@/features/editor/hooks/usePlaybackModes";
import { synchronizeAudioPosition } from "@/features/editor/utils/audio-sync";
import {
  editorShortcutFromEvent,
  isShortcutBlockedTarget,
} from "@/features/editor/utils/editor-shortcuts";
import {
  cancelFrame,
  cancelPlaybackFrame,
  requestPlaybackFrame,
  seekMediaIfNeeded,
  seekVideo,
  syncPlayheadElements,
  type PlaybackFrameHandle,
} from "@/features/editor/utils/media-sync";

const EMPTY_TRIM: TrimRange = {
  startMicros: 0,
  endMicros: 0,
  sourceDurationMicros: 0,
};
const AUDIO_SYNC_INTERVAL_MS = 100;

export interface EditorInteractionValue {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playheadRef: React.RefObject<HTMLButtonElement | null>;
  audioPlayheadRef: React.RefObject<HTMLDivElement | null>;
  playheadMicros: number;
  displayedPlayheadMicros: number;
  isPlaying: boolean;
  isPlaybackReady: boolean;
  transportError: string | null;
  playbackRate: number;
  nativeLoopEnabled: boolean;
  videoMuted: boolean;
  onLoadedMetadata: () => void;
  onCanPlay: () => void;
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
  const dispatch = useAppDispatch();
  const tools = useAppSelector(selectEditorTools);
  const trim = source.trim ?? EMPTY_TRIM;
  const preview = source.preview;
  const frameRate = source.frameRate;
  const audioTracks = source.audioTracks;
  const audioPreviewUrls = source.audioPreviewUrls;
  const externalAudioStreamCount = Object.keys(audioPreviewUrls).length;
  const usesExternalAudio =
    source.audioPreviewPreparation.status === "ready" && externalAudioStreamCount > 0;
  const nativeAudioTrack = usesExternalAudio
    ? undefined
    : (audioTracks.find(
        (track) =>
          source.audioStreams.find((stream) => stream.streamIndex === track.streamIndex)?.isDefault,
      ) ?? audioTracks[0]);
  const previewKey =
    source.sourceId && preview.status === "ready"
      ? `${source.sourceId}:${preview.value.url}`
      : null;
  const [playheadMicros, setPlayheadMicros] = useState(trim.startMicros);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transportError, setTransportError] = useState<string | null>(null);
  const [readyPreviewKey, setReadyPreviewKey] = useState<string | null>(null);
  const [audioReadiness, setAudioReadiness] = useState<{
    sourceId: string | null;
    streamIndexes: Set<number>;
  }>(() => ({ sourceId: null, streamIndexes: new Set() }));
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioElementsRef = useRef(new Map<number, HTMLAudioElement>());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef(
    new Map<number, { source: MediaElementAudioSourceNode; gain: GainNode }>(),
  );
  const nativeAudioNodeRef = useRef<{
    element: HTMLVideoElement;
    source: MediaElementAudioSourceNode;
    gain: GainNode;
  } | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const playheadRef = useRef<HTMLButtonElement>(null);
  const audioPlayheadRef = useRef<HTMLDivElement>(null);
  const playbackFrameRef = useRef<PlaybackFrameHandle | null>(null);
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
  const lastAudioSyncAtRef = useRef(0);
  const trimRef = useRef(trim);
  const currentPlayheadMicrosRef = useRef(trim.startMicros);
  const segmentDragActiveRef = useRef(false);
  const segmentFollowBoundaryRef = useRef<TrimBoundary | null>(null);
  const playbackRateRef = useRef(tools.playbackSpeed);
  const isPlaybackReady =
    previewKey !== null &&
    readyPreviewKey === previewKey &&
    source.audioPreviewPreparation.status !== "loading" &&
    (!usesExternalAudio ||
      (audioReadiness.sourceId === source.sourceId &&
        audioReadiness.streamIndexes.size === externalAudioStreamCount));
  const isPlaybackReadyRef = useRef(isPlaybackReady);
  const nativeLoopEnabled =
    isPlaybackReady &&
    tools.loopPlaybackEnabled &&
    !tools.segmentPlaybackEnabled &&
    !usesExternalAudio;
  const nativeLoopEnabledRef = useRef(nativeLoopEnabled);
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

  useEffect(() => {
    isPlaybackReadyRef.current = isPlaybackReady;
    nativeLoopEnabledRef.current = nativeLoopEnabled;
    playbackRateRef.current = tools.playbackSpeed;
  }, [isPlaybackReady, nativeLoopEnabled, tools.playbackSpeed]);

  const playbackModes = usePlaybackModes({
    loopEnabled: tools.loopPlaybackEnabled,
    segmentEnabled: tools.segmentPlaybackEnabled,
    onLoopEnabledChange: (enabled) => dispatch(loopPlaybackChanged(enabled)),
    onSegmentEnabledChange: (enabled) => dispatch(segmentPlaybackChanged(enabled)),
  });
  const displayedPlayheadMicros = clampPlaybackMicros(playheadMicros, trim.sourceDurationMicros);

  useEffect(() => {
    playbackStartSequenceRef.current += 1;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    currentPlayheadMicrosRef.current = 0;
    videoRef.current?.pause();
    for (const audio of audioElementsRef.current.values()) audio.pause();
    cancelPlaybackFrame(playbackFrameRef);
    // Source replacement is an explicit transport reset, not persisted editor state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPlaying(false);
    setTransportError(null);
    setPlayheadMicros(0);
  }, [source.sourceId]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = tools.playbackSpeed;
    for (const audio of audioElementsRef.current.values()) audio.playbackRate = tools.playbackSpeed;
  }, [audioPreviewUrls, tools.playbackSpeed]);

  useEffect(() => {
    if (!source.sourceId || audioTracks.length === 0) return;
    if (typeof AudioContext === "undefined") return;
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    let masterGain = masterGainRef.current;
    if (!masterGain) {
      masterGain = context.createGain();
      masterGainRef.current = masterGain;
      masterGain.connect(context.destination);
    }

    const activeStreamIndexes = new Set(
      usesExternalAudio ? Object.keys(audioPreviewUrls).map(Number) : [],
    );
    for (const [streamIndex, element] of audioElementsRef.current) {
      if (activeStreamIndexes.has(streamIndex)) continue;
      element.pause();
      element.remove();
      audioElementsRef.current.delete(streamIndex);
      audioNodesRef.current.get(streamIndex)?.source.disconnect();
      audioNodesRef.current.get(streamIndex)?.gain.disconnect();
      audioNodesRef.current.delete(streamIndex);
    }
    for (const [streamIndexText, url] of usesExternalAudio
      ? Object.entries(audioPreviewUrls)
      : []) {
      const streamIndex = Number(streamIndexText);
      if (audioElementsRef.current.has(streamIndex)) continue;
      const element = new Audio();
      element.crossOrigin = "anonymous";
      element.src = url;
      element.preload = "auto";
      element.playbackRate = tools.playbackSpeed;
      element.setAttribute("aria-hidden", "true");
      element.style.display = "none";
      const markReady = () => {
        setAudioReadiness((current) => {
          const indexes =
            current.sourceId === source.sourceId
              ? new Set(current.streamIndexes)
              : new Set<number>();
          if (indexes.has(streamIndex)) return current;
          indexes.add(streamIndex);
          return { sourceId: source.sourceId, streamIndexes: indexes };
        });
      };
      element.addEventListener("canplay", markReady, { once: true });
      document.body.appendChild(element);
      const audioSource = context.createMediaElementSource(element);
      const gain = context.createGain();
      audioSource.connect(gain).connect(masterGain);
      audioElementsRef.current.set(streamIndex, element);
      audioNodesRef.current.set(streamIndex, { source: audioSource, gain });
      if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) markReady();
    }

    const video = videoRef.current;
    const nativeNode = nativeAudioNodeRef.current;
    if (usesExternalAudio || !video) {
      nativeNode?.source.disconnect();
      nativeNode?.gain.disconnect();
      nativeAudioNodeRef.current = null;
    } else if (nativeNode?.element !== video) {
      nativeNode?.source.disconnect();
      nativeNode?.gain.disconnect();
      const mediaSource = context.createMediaElementSource(video);
      const gain = context.createGain();
      mediaSource.connect(gain).connect(masterGain);
      nativeAudioNodeRef.current = { element: video, source: mediaSource, gain };
    }
  }, [
    audioPreviewUrls,
    audioTracks.length,
    readyPreviewKey,
    source.sourceId,
    tools.playbackSpeed,
    usesExternalAudio,
  ]);

  useEffect(() => {
    const masterGain = masterGainRef.current;
    if (masterGain)
      masterGain.gain.value = source.masterEnabled ? source.masterVolumePercent / 50 : 0;
    for (const track of audioTracks) {
      const node = audioNodesRef.current.get(track.streamIndex);
      if (node) node.gain.gain.value = track.enabled ? track.volumePercent / 50 : 0;
    }
    if (nativeAudioNodeRef.current) {
      nativeAudioNodeRef.current.gain.gain.value = nativeAudioTrack?.enabled
        ? nativeAudioTrack.volumePercent / 50
        : 0;
    } else if (videoRef.current && nativeAudioTrack) {
      const combinedGain =
        (source.masterEnabled ? source.masterVolumePercent / 50 : 0) *
        (nativeAudioTrack.enabled ? nativeAudioTrack.volumePercent / 50 : 0);
      videoRef.current.volume = Math.min(1, combinedGain);
    }
  }, [
    audioPreviewUrls,
    audioTracks,
    nativeAudioTrack,
    readyPreviewKey,
    source.masterEnabled,
    source.masterVolumePercent,
  ]);

  useEffect(() => {
    function handleEditorShortcut(event: globalThis.KeyboardEvent) {
      if (isApplicationDialogOpen() || timelineInteractionActiveRef.current) return;
      const actions = shortcutActionsRef.current;
      const shortcut = editorShortcutFromEvent(event);
      if (!actions?.enabled || !shortcut) return;
      const isPriorityShortcut = shortcut === "toggle-playback";
      if (!isPriorityShortcut && (event.defaultPrevented || isShortcutBlockedTarget(event.target)))
        return;
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

  const stopPlayheadAnimation = useCallback(() => cancelPlaybackFrame(playbackFrameRef), []);
  const pauseAudioPlayback = useCallback(() => {
    for (const audio of audioElementsRef.current.values()) audio.pause();
  }, []);
  const syncAudioPlayback = useCallback((seconds: number, force = false) => {
    for (const audio of audioElementsRef.current.values())
      synchronizeAudioPosition(audio, seconds, playbackRateRef.current, force);
  }, []);

  const commitSeek = useCallback((micros: number) => {
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
    for (const audio of audioElementsRef.current.values())
      seekMediaIfNeeded(audio, clamped / 1_000_000);
  }, []);

  const startMediaPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isPlaybackReadyRef.current) return;
    const startMicros = currentPlayheadMicrosRef.current;
    const startSequence = ++playbackStartSequenceRef.current;
    playbackRequestedRef.current = true;
    setTransportError(null);
    seekVideo(video, startMicros);
    syncAudioPlayback(startMicros / 1_000_000, true);
    const media = [video, ...audioElementsRef.current.values()];
    const resumeAudioContext = audioContextRef.current?.resume() ?? Promise.resolve();
    void Promise.all([resumeAudioContext, ...media.map((element) => element.play())]).catch(() => {
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
  }, [pauseAudioPlayback, stopPlayheadAnimation, syncAudioPlayback, t]);

  const handlePlaybackBoundary = useCallback(
    (currentMicros: number): boolean => {
      const boundary = playbackModes.consumeBoundary(currentMicros, trimRef.current);
      if (!boundary.reached) return false;
      if (!boundary.action) return true;
      if (boundary.action.type === "restart") {
        commitSeek(boundary.action.positionMicros);
        if (videoRef.current?.paused) startMediaPlayback();
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
    },
    [commitSeek, pauseAudioPlayback, playbackModes, startMediaPlayback, stopPlayheadAnimation],
  );

  const startPlayheadAnimation = useCallback(() => {
    stopPlayheadAnimation();
    const update = (timestamp: number, mediaTimeSeconds: number) => {
      const video = videoRef.current;
      if (!video || video.paused) {
        playbackFrameRef.current = null;
        return;
      }
      const currentMicros = clampPlaybackMicros(
        mediaTimeSeconds * 1_000_000,
        trimRef.current.sourceDurationMicros,
      );
      currentPlayheadMicrosRef.current = currentMicros;
      syncPlayheadElements(
        playheadRef.current,
        audioPlayheadRef.current,
        currentMicros,
        trimRef.current.sourceDurationMicros,
      );
      if (timestamp - lastPlaybackCommitAtRef.current >= 100) {
        lastPlaybackCommitAtRef.current = timestamp;
        setPlayheadMicros(currentMicros);
      }
      if (timestamp - lastAudioSyncAtRef.current >= AUDIO_SYNC_INTERVAL_MS) {
        lastAudioSyncAtRef.current = timestamp;
        syncAudioPlayback(mediaTimeSeconds);
      }
      if (!nativeLoopEnabledRef.current && handlePlaybackBoundary(currentMicros)) {
        playbackFrameRef.current = video.paused ? null : requestPlaybackFrame(video, update);
        return;
      }
      playbackFrameRef.current = requestPlaybackFrame(video, update);
    };
    const video = videoRef.current;
    if (video) playbackFrameRef.current = requestPlaybackFrame(video, update);
  }, [handlePlaybackBoundary, stopPlayheadAnimation, syncAudioPlayback]);

  useEffect(
    () => () => {
      playbackStartSequenceRef.current += 1;
      cancelPlaybackFrame(playbackFrameRef);
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
      nativeAudioNodeRef.current?.source.disconnect();
      nativeAudioNodeRef.current?.gain.disconnect();
      void audioContextRef.current?.close();
    },
    [],
  );

  const flushTrimCommit = useCallback(() => {
    cancelFrame(trimCommitFrameRef);
    const pendingTrim = pendingTrimCommitRef.current;
    pendingTrimCommitRef.current = null;
    if (pendingTrim) source.onTrimChange(pendingTrim);
  }, [source]);
  const queueTrimCommit = useCallback(
    (nextTrim: TrimRange) => {
      pendingTrimCommitRef.current = nextTrim;
      if (trimCommitFrameRef.current !== null) return;
      trimCommitFrameRef.current = requestAnimationFrame(() => {
        trimCommitFrameRef.current = null;
        const pendingTrim = pendingTrimCommitRef.current;
        pendingTrimCommitRef.current = null;
        if (pendingTrim) source.onTrimChange(pendingTrim);
      });
    },
    [source],
  );
  const queueScrubSeek = useCallback(
    (micros: number) => {
      pendingScrubMicrosRef.current = clampPlaybackMicros(
        micros,
        trimRef.current.sourceDurationMicros,
      );
      if (scrubFrameRef.current !== null) return;
      scrubFrameRef.current = requestAnimationFrame(() => {
        scrubFrameRef.current = null;
        const pendingMicros = pendingScrubMicrosRef.current;
        pendingScrubMicrosRef.current = null;
        if (pendingMicros !== null) commitSeek(pendingMicros);
      });
    },
    [commitSeek],
  );
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
    if (!video || !isPlaybackReadyRef.current) return;
    setTransportError(null);
    if (playbackRequestedRef.current || isPlayingRef.current) {
      playbackStartSequenceRef.current += 1;
      playbackRequestedRef.current = false;
      isPlayingRef.current = false;
      video.pause();
      return;
    }
    const startMicros = playbackModes.startMicros(
      currentPlayheadMicrosRef.current,
      trimRef.current,
    );
    if (startMicros !== currentPlayheadMicrosRef.current) commitSeek(startMicros);
    playbackModes.resetBoundary();
    startMediaPlayback();
  }, [commitSeek, playbackModes, startMediaPlayback]);
  const handleStepFrame = useCallback(
    (direction: -1 | 1) => {
      playbackStartSequenceRef.current += 1;
      playbackRequestedRef.current = false;
      isPlayingRef.current = false;
      videoRef.current?.pause();
      setIsPlaying(false);
      stopPlayheadAnimation();
      commitSeek(currentPlayheadMicrosRef.current + direction * frameDurationMicros(frameRate));
    },
    [commitSeek, frameRate, stopPlayheadAnimation],
  );
  const handleSetSegmentBoundary = useCallback(
    (boundary: TrimBoundary) => {
      if (!source.trim) return;
      const currentMicros = currentPlayheadMicrosRef.current;
      if (!canSetTrimBoundaryAtPlayhead(trimRef.current, boundary, currentMicros)) return;
      const nextTrim = setTrimBoundaryAtPlayhead(trimRef.current, boundary, currentMicros);
      trimRef.current = nextTrim;
      flushTrimCommit();
      source.onTrimChange(nextTrim);
    },
    [flushTrimCommit, source],
  );
  const handleTrimBoundaryChange = useCallback(
    (boundary: TrimBoundary, nextTrim: TrimRange) => {
      const currentMicros = currentPlayheadMicrosRef.current;
      const follow = tools.safeTrimFollowingEnabled
        ? playheadFollowAfterTrimBoundaryMove(trimRef.current, nextTrim, boundary, currentMicros)
        : { playheadMicros: currentMicros, boundary: null };
      trimRef.current = nextTrim;
      queueTrimCommit(nextTrim);
      if (follow.playheadMicros !== currentMicros) queueScrubSeek(follow.playheadMicros);
      return follow.boundary;
    },
    [queueScrubSeek, queueTrimCommit, tools.safeTrimFollowingEnabled],
  );
  const handleSegmentMove = useCallback(
    (nextTrim: TrimRange) => {
      const currentMicros = currentPlayheadMicrosRef.current;
      const follow =
        tools.safeTrimFollowingEnabled && segmentDragActiveRef.current
          ? playheadAfterSegmentMove(
              trimRef.current,
              nextTrim,
              currentMicros,
              segmentFollowBoundaryRef.current,
            )
          : { playheadMicros: currentMicros, boundary: null };
      segmentFollowBoundaryRef.current = follow.boundary;
      trimRef.current = nextTrim;
      queueTrimCommit(nextTrim);
      if (follow.playheadMicros !== currentMicros) queueScrubSeek(follow.playheadMicros);
      return follow.boundary;
    },
    [queueScrubSeek, queueTrimCommit, tools.safeTrimFollowingEnabled],
  );
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

  const onTimeUpdate = useCallback(
    (seconds: number) => {
      const currentMicros = clampPlaybackMicros(
        seconds * 1_000_000,
        trimRef.current.sourceDurationMicros,
      );
      if (isPlayingRef.current) {
        handlePlaybackBoundary(currentMicros);
        return;
      }
      currentPlayheadMicrosRef.current = currentMicros;
      syncPlayheadElements(
        playheadRef.current,
        audioPlayheadRef.current,
        currentMicros,
        trimRef.current.sourceDurationMicros,
      );
      setPlayheadMicros(currentMicros);
      syncAudioPlayback(seconds, true);
      if (currentMicros >= trimRef.current.sourceDurationMicros) stopPlayheadAnimation();
    },
    [handlePlaybackBoundary, stopPlayheadAnimation, syncAudioPlayback],
  );
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
  const onCropToolOpenChange = useCallback(
    (isOpen: boolean) => {
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
    },
    [pauseAudioPlayback, startMediaPlayback, stopPlayheadAnimation],
  );
  const onPreviewPlaybackError = useCallback(
    (previewKind: "source" | "proxy") => {
      playbackStartSequenceRef.current += 1;
      playbackRequestedRef.current = false;
      isPlayingRef.current = false;
      videoRef.current?.pause();
      pauseAudioPlayback();
      setIsPlaying(false);
      stopPlayheadAnimation();
      source.onPreviewPlaybackError(previewKind);
    },
    [pauseAudioPlayback, source, stopPlayheadAnimation],
  );

  useEffect(() => {
    shortcutActionsRef.current = {
      enabled: isPlaybackReady,
      togglePlayback: handleTogglePlayback,
      stepFrame: handleStepFrame,
      setSegmentBoundary: handleSetSegmentBoundary,
    };
  }, [handleSetSegmentBoundary, handleStepFrame, handleTogglePlayback, isPlaybackReady]);

  return {
    videoRef,
    playheadRef,
    audioPlayheadRef,
    playheadMicros,
    displayedPlayheadMicros,
    isPlaying,
    isPlaybackReady,
    transportError,
    playbackRate: tools.playbackSpeed,
    nativeLoopEnabled,
    videoMuted: usesExternalAudio || !nativeAudioTrack,
    onLoadedMetadata: () => commitSeek(displayedPlayheadMicros),
    onCanPlay: () => {
      if (previewKey) setReadyPreviewKey(previewKey);
    },
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
