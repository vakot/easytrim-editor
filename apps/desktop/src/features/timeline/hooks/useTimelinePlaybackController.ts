import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import {
  selectLoopPlaybackEnabled,
  selectSegmentPlaybackEnabled,
} from "@/app/store/slices/editor-tools-slice";
import { selectPlaybackSpeed } from "@/app/store/slices/playback-controls-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { clampPlaybackMicros } from "@/domain/playback";
import { canSetTrimBoundaryAtPlayhead, type TrimRange } from "@/domain/trim";
import { useAudioPlayback, useAudioTransport } from "@/features/audio";
import { type PreviewPlaybackFrame, usePreviewMediaTransport } from "@/features/preview";

import { FRAME_SHUTTLE_PLAYBACK_RATE, type FrameShuttleDirection } from "../lib/editor-shortcuts";
import { cancelFrame, syncPlayheadElements } from "../lib/playhead-sync";

import { useEditorTimelineShortcuts } from "./useEditorTimelineShortcuts";
import { usePlaybackModes } from "./usePlaybackModes";
import { useTimelineMediaEvents } from "./useTimelineMediaEvents";
import { useTimelineMediaStartup } from "./useTimelineMediaStartup";
import { useTimelineScrub } from "./useTimelineScrub";
import { useTimelineShuttle } from "./useTimelineShuttle";
import { useTimelineTransportCommands } from "./useTimelineTransportCommands";
import { useTimelineTrimEditing } from "./useTimelineTrimEditing";

const EMPTY_TRIM: TrimRange = {
  startMicros: 0,
  endMicros: 0,
  sourceDurationMicros: 0,
};

const AUDIO_SYNC_INTERVAL_MS = 100;
function useTimelinePlaybackController() {
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const loopPlaybackEnabled = useAppSelector(selectLoopPlaybackEnabled);
  const segmentPlaybackEnabled = useAppSelector(selectSegmentPlaybackEnabled);
  const playbackSpeed = useAppSelector(selectPlaybackSpeed);
  const sourceSelection = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const trim = useAppSelector(selectTrim) ?? EMPTY_TRIM;
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;

  const sourcePath = sourceSelection?.sourcePath ?? null;
  const sourceIdentity = useMemo(
    () => ({ activeInstanceId, sourcePath }),
    [activeInstanceId, sourcePath],
  );

  const previewRuntime = usePreviewMediaTransport();
  const { previewKey } = previewRuntime;
  const {
    getMediaState,
    isPreviewReady,
    isSeekPending,
    pauseMedia,
    playMedia,
    registerMediaObserver,
    requestPlaybackFrame,
    setNativeLoopEnabled,
    setPlaybackRate,
  } = previewRuntime;

  const [playheadMicros, setPlayheadMicros] = useState(trim.startMicros);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuttleDirection, setShuttleDirection] = useState<FrameShuttleDirection | 0>(0);
  const [transportError, setTransportError] = useState<string | null>(null);

  const playheadRef = useRef<HTMLButtonElement>(null);

  const playbackFrameRef = useRef<PreviewPlaybackFrame | null>(null);
  const reverseShuttleFrameRef = useRef<number | null>(null);
  const reverseShuttleLastFrameAtRef = useRef<number | null>(null);
  const reverseShuttleLastSeekAtRef = useRef(0);
  const scrubFrameRef = useRef<number | null>(null);
  const pendingScrubMicrosRef = useRef<number | null>(null);
  const frameStepSeekFrameRef = useRef<number | null>(null);
  const pendingFrameStepSeekMicrosRef = useRef<number | null>(null);
  const resumeAfterScrubRef = useRef(false);
  const timelineInteractionActiveRef = useRef(false);
  const playbackStartSequenceRef = useRef(0);
  const playbackRequestedRef = useRef(false);
  const transportSuspendedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const shuttleDirectionRef = useRef<FrameShuttleDirection | 0>(0);
  const lastPlaybackCommitAtRef = useRef(0);
  const lastScrubCommitAtRef = useRef(-Infinity);
  const trimInteractionActiveRef = useRef(false);
  const lastAudioSyncAtRef = useRef(0);
  const trimRef = useRef(trim);
  const currentPlayheadMicrosRef = useRef(trim.startMicros);
  const activePlaybackRate = shuttleDirection === 1 ? FRAME_SHUTTLE_PLAYBACK_RATE : playbackSpeed;
  const { audioPlayheadRef } = useAudioPlayback();
  const audioTransport = useAudioTransport();

  const {
    isReady: isAudioReady,
    pause: pauseAudioPlayback,
    setPlaybackRate: setAudioPlaybackRate,
    syncTo: syncAudioPlayback,
    usesExternalAudio,
  } = audioTransport;

  const isPlaybackReady = isPreviewReady && isAudioReady;

  const isPlaybackReadyRef = useRef(isPlaybackReady);
  const nativeLoopEnabled =
    isPlaybackReady &&
    shuttleDirection === 0 &&
    loopPlaybackEnabled &&
    !segmentPlaybackEnabled &&
    !usesExternalAudio;

  const nativeLoopEnabledRef = useRef(nativeLoopEnabled);
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
  }, [isPlaybackReady, nativeLoopEnabled]);

  useEffect(() => {
    playbackStartSequenceRef.current += 1;
    playbackRequestedRef.current = false;
    transportSuspendedRef.current = false;
    isPlayingRef.current = false;
    pauseMedia();
    pauseAudioPlayback();
    playbackFrameRef.current?.cancel();
    playbackFrameRef.current = null;
    cancelFrame(scrubFrameRef);
    cancelFrame(frameStepSeekFrameRef);
    pendingScrubMicrosRef.current = null;
    pendingFrameStepSeekMicrosRef.current = null;
    timelineInteractionActiveRef.current = false;
    trimInteractionActiveRef.current = false;
    resumeAfterScrubRef.current = false;
    // Source replacement is an explicit transport reset, not persisted editor state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPlaying(false);
    setTransportError(null);
    currentPlayheadMicrosRef.current = trimRef.current.startMicros;
    setPlayheadMicros(trimRef.current.startMicros);
  }, [activeInstanceId, pauseAudioPlayback, pauseMedia, previewKey, sourcePath]);

  useEffect(() => {
    setPlaybackRate(activePlaybackRate);
    setAudioPlaybackRate(activePlaybackRate);
  }, [activePlaybackRate, setAudioPlaybackRate, setPlaybackRate]);

  useEffect(() => {
    setNativeLoopEnabled(nativeLoopEnabled);
  }, [nativeLoopEnabled, setNativeLoopEnabled]);

  const playbackModes = usePlaybackModes({
    loopEnabled: loopPlaybackEnabled,
    segmentEnabled: segmentPlaybackEnabled,
  });

  const displayedPlayheadMicros = clampPlaybackMicros(playheadMicros, trim.sourceDurationMicros);

  const stopPlayheadAnimation = useCallback(() => {
    playbackFrameRef.current?.cancel();
    playbackFrameRef.current = null;
  }, []);

  const mediaStartup = useTimelineMediaStartup({
    currentPlayheadMicrosRef,
    isPlaybackReady,
    isPlaybackReadyRef,
    isPlayingRef,
    pauseAudioPlayback,
    playbackRequestedRef,
    playbackSpeed,
    playbackStartSequenceRef,
    reverseShuttleFrameRef,
    setAudioPlaybackRate,
    setIsPlaying,
    setShuttleDirection,
    setTransportError,
    shuttleDirectionRef,
    stopPlayheadAnimation,
    timelineInteractionActiveRef,
    transportSuspendedRef,
    usesExternalAudio,
  });

  const { applyMediaSeek, scheduleVideoSeek, startMediaPlayback } = mediaStartup;

  const flushFrameStepSeek = useCallback(() => {
    cancelFrame(frameStepSeekFrameRef);
    const pendingMicros = pendingFrameStepSeekMicrosRef.current;
    pendingFrameStepSeekMicrosRef.current = null;
    if (pendingMicros !== null) applyMediaSeek(pendingMicros);
  }, [applyMediaSeek]);

  const queueFrameStepSeek = useCallback(
    (micros: number) => {
      const clamped = clampPlaybackMicros(micros, trimRef.current.sourceDurationMicros);
      currentPlayheadMicrosRef.current = clamped;
      syncPlayheadElements(
        playheadRef.current,
        audioPlayheadRef.current,
        clamped,
        trimRef.current.sourceDurationMicros,
      );
      setPlayheadMicros(clamped);

      if (!isSeekPending() && frameStepSeekFrameRef.current === null) {
        applyMediaSeek(clamped);
        return;
      }
      pendingFrameStepSeekMicrosRef.current = clamped;
      if (frameStepSeekFrameRef.current !== null) return;
      frameStepSeekFrameRef.current = requestAnimationFrame(() => {
        frameStepSeekFrameRef.current = null;
        const pendingMicros = pendingFrameStepSeekMicrosRef.current;
        pendingFrameStepSeekMicrosRef.current = null;
        if (pendingMicros !== null) applyMediaSeek(pendingMicros);
      });
    },
    [applyMediaSeek, audioPlayheadRef, isSeekPending, setPlayheadMicros],
  );

  const commitSeek = useCallback(
    (micros: number, seekMedia = true, publish = true) => {
      flushFrameStepSeek();
      const clamped = clampPlaybackMicros(micros, trimRef.current.sourceDurationMicros);
      currentPlayheadMicrosRef.current = clamped;
      syncPlayheadElements(
        playheadRef.current,
        audioPlayheadRef.current,
        clamped,
        trimRef.current.sourceDurationMicros,
      );
      if (publish) setPlayheadMicros(clamped);
      if (seekMedia) applyMediaSeek(clamped);
    },
    [applyMediaSeek, audioPlayheadRef, flushFrameStepSeek, setPlayheadMicros],
  );

  const syncPlayhead = useCallback(
    (micros: number) =>
      syncPlayheadElements(
        playheadRef.current,
        audioPlayheadRef.current,
        micros,
        trimRef.current.sourceDurationMicros,
      ),
    [audioPlayheadRef],
  );

  const shuttle = useTimelineShuttle({
    commitSeek,
    currentPlayheadMicrosRef,
    flushFrameStepSeek,
    getMediaState,
    isPlaybackReadyRef,
    isPlayingRef,
    isSeekPending,
    lastPlaybackCommitAtRef,
    pauseAudioPlayback,
    pauseMedia,
    playbackModes,
    playbackSpeed,
    reverseShuttleFrameRef,
    reverseShuttleLastFrameAtRef,
    reverseShuttleLastSeekAtRef,
    scheduleVideoSeek,
    setAudioPlaybackRate,
    setPlaybackRate,
    setIsPlaying,
    setPlayheadMicros,
    setShuttleDirection,
    shuttleDirection,
    shuttleDirectionRef,
    startMediaPlayback,
    stopPlayheadAnimation,
    syncPlayhead,
    trimRef,
  });

  const { resetShuttle } = shuttle;

  useEffect(() => {
    resetShuttle();
  }, [activeInstanceId, previewKey, resetShuttle, sourcePath]);

  const handlePlaybackBoundary = useCallback(
    (currentMicros: number): boolean => {
      if (shuttleDirectionRef.current !== 0) return false;
      const boundary = playbackModes.consumeBoundary(currentMicros, trimRef.current);
      if (!boundary.reached) return false;
      if (!boundary.action) return true;
      if (boundary.action.type === "restart") {
        commitSeek(boundary.action.positionMicros);
        if (getMediaState()?.paused) startMediaPlayback();
        return true;
      }
      playbackStartSequenceRef.current += 1;
      playbackRequestedRef.current = false;
      isPlayingRef.current = false;
      pauseMedia();
      pauseAudioPlayback();
      setIsPlaying(false);
      stopPlayheadAnimation();
      commitSeek(boundary.action.positionMicros);
      return true;
    },
    [
      commitSeek,
      pauseAudioPlayback,
      playbackModes,
      setIsPlaying,
      startMediaPlayback,
      stopPlayheadAnimation,
      getMediaState,
      pauseMedia,
    ],
  );

  const startPlayheadAnimation = useCallback(() => {
    stopPlayheadAnimation();
    const update = (timestamp: number, mediaTimeSeconds: number) => {
      const mediaState = getMediaState();
      if (!mediaState || mediaState.paused) {
        playbackFrameRef.current = null;
        return;
      }
      if (isSeekPending() || mediaState.seeking) {
        playbackFrameRef.current = requestPlaybackFrame(update);
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
        const nextState = getMediaState();
        playbackFrameRef.current =
          nextState && !nextState.paused ? requestPlaybackFrame(update) : null;
        return;
      }
      playbackFrameRef.current = requestPlaybackFrame(update);
    };

    if (getMediaState()) playbackFrameRef.current = requestPlaybackFrame(update);
  }, [
    audioPlayheadRef,
    getMediaState,
    handlePlaybackBoundary,
    isSeekPending,
    requestPlaybackFrame,
    stopPlayheadAnimation,
    syncAudioPlayback,
  ]);

  useEffect(() => {
    return () => {
      playbackStartSequenceRef.current += 1;
      playbackFrameRef.current?.cancel();
      playbackFrameRef.current = null;
      cancelFrame(scrubFrameRef);
      pendingFrameStepSeekMicrosRef.current = null;
    };
  }, []);

  const { startShuttle: handleShuttleStart, stopShuttle: handleShuttleEnd } = shuttle;

  const scrub = useTimelineScrub({
    applyMediaSeek,
    commitSeek,
    currentPlayheadMicrosRef,
    flushFrameStepSeek,
    handleShuttleEnd,
    isPlayingRef,
    lastScrubCommitAtRef,
    pauseAudioPlayback,
    pauseMedia,
    pendingScrubMicrosRef,
    playbackModes,
    playbackRequestedRef,
    playbackStartSequenceRef,
    resumeAfterScrubRef,
    scrubFrameRef,
    setIsPlaying,
    shuttleDirectionRef,
    startMediaPlayback,
    stopPlayheadAnimation,
    timelineInteractionActiveRef,
    trimInteractionActiveRef,
    trimRef,
  });

  const { endScrub: handleScrubEnd, queueScrubSeek, startScrub: handleScrubStart } = scrub;

  const trimEditing = useTimelineTrimEditing({
    currentPlayheadMicrosRef,
    onScrubEnd: handleScrubEnd,
    onScrubStart: handleScrubStart,
    sourceIdentity,
    sourcePath,
    trimInteractionActiveRef,
    trimRef,
  });

  const {
    beginTrimDrag,
    finishTrimDrag,
    onSegmentMove,
    onSetSegmentBoundary,
    onTrimBoundaryChange,
  } = trimEditing;

  const transportCommands = useTimelineTransportCommands({
    commitSeek,
    currentPlayheadMicrosRef,
    flushFrameStepSeek,
    frameRate,
    getMediaState,
    handleShuttleEnd,
    isPlaybackReadyRef,
    isPlayingRef,
    pauseAudioPlayback,
    pauseMedia,
    pendingFrameStepSeekMicrosRef,
    playbackModes,
    playbackRequestedRef,
    playbackStartSequenceRef,
    queueFrameStepSeek,
    resumeAfterScrubRef,
    setIsPlaying,
    setTransportError,
    shuttleDirectionRef,
    startMediaPlayback,
    stopPlayheadAnimation,
    transportSuspendedRef,
    trimRef,
  });

  const {
    pausePlayback: handlePausePlayback,
    resumeAfterInteraction,
    stepFrame: handleStepFrame,
    suspendForInteraction,
    togglePlayback: handleTogglePlayback,
  } = transportCommands;

  const onSetPlayhead = useCallback(
    (micros: number) => {
      syncPlayhead(micros);
      setPlayheadMicros(micros);
    },
    [setPlayheadMicros, syncPlayhead],
  );

  const mediaEvents = useTimelineMediaEvents({
    commitSeek,
    currentPlayheadMicrosRef,
    getMediaState,
    handlePlaybackBoundary,
    handlePausePlayback,
    handleShuttleEnd,
    isPlayingRef,
    isSeekPending,
    onSetPlayhead,
    pendingFrameStepSeekMicrosRef,
    pauseAudioPlayback,
    pauseMedia,
    playMedia,
    playbackModes,
    playbackRequestedRef,
    setIsPlaying,
    shuttleDirectionRef,
    startMediaPlayback,
    startPlayheadAnimation,
    stopPlayheadAnimation,
    timelineInteractionActiveRef,
    transportSuspendedRef,
    trimRef,
  });

  const { onEnded, onLoadedMetadata, onPause, onPlay, onPlaybackError, onTimeUpdate } = mediaEvents;

  useEffect(
    () =>
      registerMediaObserver({
        onEnded,
        onLoadedMetadata,
        onPause,
        onPlay,
        onPlaybackError,
        onTimeUpdate,
      }),
    [
      onEnded,
      onLoadedMetadata,
      onPause,
      onPlay,
      onPlaybackError,
      onTimeUpdate,
      registerMediaObserver,
    ],
  );

  useEditorTimelineShortcuts(
    {
      enabled: isPlaybackReady,
      onSetSegmentBoundary,
      onShuttleEnd: handleShuttleEnd,
      onShuttleStart: handleShuttleStart,
      onStepFrame: handleStepFrame,
      onTogglePlayback: handleTogglePlayback,
    },
    timelineInteractionActiveRef,
  );

  return {
    canInteract: isPlaybackReady,
    playheadRef,
    displayedPlayheadMicros,
    isPlaying,
    transportError,
    shuttleDirection,
    onLoadedMetadata,
    onPlay,
    onPause,
    pause: handlePausePlayback,
    onTimeUpdate,
    onEnded,
    toggle: handleTogglePlayback,
    stepFrame: handleStepFrame,
    startShuttle: handleShuttleStart,
    stopShuttle: handleShuttleEnd,
    suspendForInteraction,
    resumeAfterInteraction,
    onSetSegmentBoundary,
    onTrimBoundaryChange,
    onSegmentMove,
    onTrimDragStart: beginTrimDrag,
    onTrimDragEnd: finishTrimDrag,
    onSegmentDragStart: beginTrimDrag,
    onSegmentDragEnd: finishTrimDrag,
    onSeek: commitSeek,
    onScrubStart: handleScrubStart,
    onScrub: queueScrubSeek,
    onScrubEnd: handleScrubEnd,
    canSetSegmentStart: canSetTrimBoundaryAtPlayhead(trim, "start", displayedPlayheadMicros),
    canSetSegmentEnd: canSetTrimBoundaryAtPlayhead(trim, "end", displayedPlayheadMicros),
  };
}

export { useTimelinePlaybackController };
