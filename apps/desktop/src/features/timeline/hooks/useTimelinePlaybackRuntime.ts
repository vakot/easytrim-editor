import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector, useAppStore } from "@/app/store/redux-hooks";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import {
  selectLoopPlaybackEnabled,
  selectSegmentPlaybackEnabled,
} from "@/app/store/slices/editor-tools-slice";
import { selectPlaybackSpeed } from "@/app/store/slices/playback-controls-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim, trimChanged } from "@/app/store/slices/trim-slice";
import { commitActiveEditingInstanceDraft } from "@/app/store/thunks/source-media-thunks";
import { clampPlaybackMicros, frameDurationMicros } from "@/domain/playback";
import {
  canSetTrimBoundaryAtPlayhead,
  setTrimBoundaryAtPlayhead,
  type TrimBoundary,
  type TrimRange,
} from "@/domain/trim";
import { useAudioPlayback, useAudioTransport } from "@/features/audio";
import { usePreviewRuntime } from "@/features/preview";
import { diagnostics } from "@/lib/diagnostics";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";

import { FRAME_SHUTTLE_PLAYBACK_RATE, type FrameShuttleDirection } from "../lib/editor-shortcuts";
import {
  cancelPlaybackFrame,
  type PlaybackFrameHandle,
  requestPlaybackFrame,
} from "../lib/media-sync";
import { cancelFrame, syncPlayheadElements } from "../lib/playhead-sync";
import { createSeekScheduler } from "../lib/seek-scheduler";

import { useEditorTimelineShortcuts } from "./useEditorTimelineShortcuts";
import { usePlaybackModes } from "./usePlaybackModes";

const EMPTY_TRIM: TrimRange = {
  startMicros: 0,
  endMicros: 0,
  sourceDurationMicros: 0,
};

const AUDIO_SYNC_INTERVAL_MS = 100;
const REVERSE_SHUTTLE_SEEK_INTERVAL_MS = 50;
const SHUTTLE_MAX_FRAME_DELTA_MS = 100;

function useTimelinePlaybackRuntime() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const store = useAppStore();
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

  const previewRuntime = usePreviewRuntime();
  const { previewKey, videoRef } = previewRuntime;

  const [playheadMicros, setPlayheadMicros] = useState(trim.startMicros);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuttleDirection, setShuttleDirection] = useState<FrameShuttleDirection | 0>(0);
  const [transportError, setTransportError] = useState<string | null>(null);

  const seekSchedulerRef = useRef<ReturnType<typeof createSeekScheduler> | null>(null);
  const playheadRef = useRef<HTMLButtonElement>(null);

  const playbackFrameRef = useRef<PlaybackFrameHandle | null>(null);
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
    resumeAt: resumeAudioAt,
    resumeAudioContext,
    setPlaybackRate: setAudioPlaybackRate,
    startAt: startAudioAt,
    syncTo: syncAudioPlayback,
    usesExternalAudio,
  } = audioTransport;

  const isPlaybackReady = previewRuntime.isPreviewReady && isAudioReady;

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

  const playbackModes = usePlaybackModes({
    loopEnabled: loopPlaybackEnabled,
    segmentEnabled: segmentPlaybackEnabled,
  });

  const displayedPlayheadMicros = clampPlaybackMicros(playheadMicros, trim.sourceDurationMicros);

  useEffect(() => {
    playbackStartSequenceRef.current += 1;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    videoRef.current?.pause();
    pauseAudioPlayback();
    cancelPlaybackFrame(playbackFrameRef);
    cancelFrame(reverseShuttleFrameRef);
    cancelFrame(scrubFrameRef);
    cancelFrame(frameStepSeekFrameRef);
    pendingScrubMicrosRef.current = null;
    pendingFrameStepSeekMicrosRef.current = null;
    timelineInteractionActiveRef.current = false;
    trimInteractionActiveRef.current = false;
    resumeAfterScrubRef.current = false;
    seekSchedulerRef.current?.dispose();
    seekSchedulerRef.current = null;
    shuttleDirectionRef.current = 0;
    // Source replacement is an explicit transport reset, not persisted editor state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShuttleDirection(0);
    setIsPlaying(false);
    setTransportError(null);
    // Snapshot activation restores the selected segment, so preview should begin at its boundary.
    currentPlayheadMicrosRef.current = trimRef.current.startMicros;
    setPlayheadMicros(trimRef.current.startMicros);
  }, [activeInstanceId, pauseAudioPlayback, previewKey, sourcePath, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = activePlaybackRate;
    setAudioPlaybackRate(activePlaybackRate);
  }, [activePlaybackRate, setAudioPlaybackRate, videoRef]);

  const stopPlayheadAnimation = useCallback(() => cancelPlaybackFrame(playbackFrameRef), []);
  const handlePlaybackStartFailure = useCallback(() => {
    playbackStartSequenceRef.current += 1;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    shuttleDirectionRef.current = 0;
    cancelFrame(reverseShuttleFrameRef);
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.playbackRate = playbackSpeed;
    }
    setAudioPlaybackRate(playbackSpeed);
    pauseAudioPlayback();
    setIsPlaying(false);
    setShuttleDirection(0);
    stopPlayheadAnimation();
    setTransportError(t("preview.messages.playbackFailed"));
  }, [
    pauseAudioPlayback,
    setAudioPlaybackRate,
    playbackSpeed,
    setIsPlaying,
    setShuttleDirection,
    setTransportError,
    stopPlayheadAnimation,
    t,
    videoRef,
  ]);

  const resumeExternalAudioPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.paused) return;

    const startSequence = playbackStartSequenceRef.current;
    const seconds = video.currentTime;
    void resumeAudioAt(seconds).catch(() => {
      if (startSequence !== playbackStartSequenceRef.current) return;
      handlePlaybackStartFailure();
    });
  }, [handlePlaybackStartFailure, resumeAudioAt, videoRef]);

  useEffect(() => {
    if (!usesExternalAudio || !isPlaybackReady || !isPlayingRef.current) return;
    resumeExternalAudioPlayback();
  }, [isPlaybackReady, resumeExternalAudioPlayback, usesExternalAudio]);

  const scheduleVideoSeek = useCallback(
    (micros: number, approximate: boolean, onSettled?: () => void) => {
      const video = videoRef.current;
      if (!video) return;
      if (seekSchedulerRef.current?.video !== video) {
        seekSchedulerRef.current?.dispose();
        seekSchedulerRef.current = createSeekScheduler(video);
      }
      seekSchedulerRef.current.seek(micros / 1_000_000, approximate, onSettled);
    },
    [videoRef],
  );

  const applyMediaSeek = useCallback(
    (micros: number) => {
      const interactive = timelineInteractionActiveRef.current;
      if (isPlayingRef.current) pauseAudioPlayback();
      scheduleVideoSeek(
        micros,
        interactive,
        interactive
          ? undefined
          : () => {
              syncAudioPlayback(micros / 1_000_000, true);
              if (isPlayingRef.current) resumeExternalAudioPlayback();
            },
      );
    },
    [pauseAudioPlayback, resumeExternalAudioPlayback, scheduleVideoSeek, syncAudioPlayback],
  );

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

      if (!seekSchedulerRef.current?.isPending && frameStepSeekFrameRef.current === null) {
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
    [applyMediaSeek, audioPlayheadRef, setPlayheadMicros],
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

  const startMediaPlayback = useCallback(() => {
    flushFrameStepSeek();
    const video = videoRef.current;
    if (!video || !isPlaybackReadyRef.current) return;
    const startMicros = currentPlayheadMicrosRef.current;
    const startSequence = ++playbackStartSequenceRef.current;
    playbackRequestedRef.current = true;
    setTransportError(null);
    void resumeAudioContext().catch(() => {
      if (startSequence !== playbackStartSequenceRef.current) return;
      handlePlaybackStartFailure();
    });
    scheduleVideoSeek(startMicros, false, () => {
      if (startSequence !== playbackStartSequenceRef.current) return;
      void Promise.all([video.play(), startAudioAt(startMicros / 1_000_000)]).catch(() => {
        if (startSequence !== playbackStartSequenceRef.current) return;
        handlePlaybackStartFailure();
      });
    });
  }, [
    flushFrameStepSeek,
    handlePlaybackStartFailure,
    resumeAudioContext,
    startAudioAt,
    scheduleVideoSeek,
    setTransportError,
    videoRef,
  ]);

  const handlePlaybackBoundary = useCallback(
    (currentMicros: number): boolean => {
      if (shuttleDirectionRef.current !== 0) return false;
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
    [
      commitSeek,
      pauseAudioPlayback,
      playbackModes,
      setIsPlaying,
      startMediaPlayback,
      stopPlayheadAnimation,
      videoRef,
    ],
  );

  const startPlayheadAnimation = useCallback(() => {
    stopPlayheadAnimation();
    const update = (timestamp: number, mediaTimeSeconds: number) => {
      const video = videoRef.current;
      if (!video || video.paused) {
        playbackFrameRef.current = null;
        return;
      }
      if (seekSchedulerRef.current?.isPending || video.seeking) {
        playbackFrameRef.current = requestPlaybackFrame(video, update);
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
  }, [
    audioPlayheadRef,
    handlePlaybackBoundary,
    stopPlayheadAnimation,
    syncAudioPlayback,
    videoRef,
  ]);

  useEffect(() => {
    return () => {
      playbackStartSequenceRef.current += 1;
      cancelPlaybackFrame(playbackFrameRef);
      cancelFrame(reverseShuttleFrameRef);
      cancelFrame(scrubFrameRef);
      pendingFrameStepSeekMicrosRef.current = null;
      seekSchedulerRef.current?.dispose();
      seekSchedulerRef.current = null;
    };
  }, []);

  const setMediaPlaybackRate = useCallback(
    (rate: number) => {
      if (videoRef.current) videoRef.current.playbackRate = rate;
      setAudioPlaybackRate(rate);
    },
    [setAudioPlaybackRate, videoRef],
  );

  const handleShuttleEnd = useCallback(
    (origin: DiagnosticOrigin = { type: "internal" }) => {
      flushFrameStepSeek();
      const direction = shuttleDirectionRef.current;
      if (direction === 0) return;

      const video = videoRef.current;
      const finalMicros =
        direction === 1 && video && !video.seeking && !seekSchedulerRef.current?.isPending
          ? video.currentTime * 1_000_000
          : currentPlayheadMicrosRef.current;

      shuttleDirectionRef.current = 0;
      cancelFrame(reverseShuttleFrameRef);
      reverseShuttleLastFrameAtRef.current = null;
      playbackStartSequenceRef.current += 1;
      playbackRequestedRef.current = false;
      isPlayingRef.current = false;
      video?.pause();
      pauseAudioPlayback();
      setIsPlaying(false);
      setShuttleDirection(0);
      stopPlayheadAnimation();
      setMediaPlaybackRate(playbackSpeed);
      commitSeek(finalMicros);
      diagnostics.event("timeline.shuttle.completed", {
        data: { direction },
        origin,
      });
    },
    [
      commitSeek,
      flushFrameStepSeek,
      pauseAudioPlayback,
      playbackSpeed,
      setIsPlaying,
      setShuttleDirection,
      setMediaPlaybackRate,
      stopPlayheadAnimation,
      videoRef,
    ],
  );

  const startReverseShuttleAnimation = useCallback(() => {
    cancelFrame(reverseShuttleFrameRef);
    reverseShuttleLastFrameAtRef.current = null;
    reverseShuttleLastSeekAtRef.current = 0;

    const update = (timestamp: number) => {
      if (shuttleDirectionRef.current !== -1) {
        reverseShuttleFrameRef.current = null;
        return;
      }

      const previousTimestamp = reverseShuttleLastFrameAtRef.current;
      reverseShuttleLastFrameAtRef.current = timestamp;
      const elapsedMs =
        previousTimestamp === null
          ? 0
          : Math.min(timestamp - previousTimestamp, SHUTTLE_MAX_FRAME_DELTA_MS);

      let currentMicros = Math.max(
        0,
        currentPlayheadMicrosRef.current - elapsedMs * FRAME_SHUTTLE_PLAYBACK_RATE * 1_000,
      );

      const boundary = playbackModes.consumeSourceBoundary(
        currentMicros,
        trimRef.current.sourceDurationMicros,
        -1,
      );

      const boundaryAction = boundary.reached ? boundary.action : null;
      const shuttleRestarted = boundaryAction?.type === "restart";
      if (boundaryAction) {
        currentMicros = boundaryAction.positionMicros;
        if (shuttleRestarted) playbackModes.resetBoundary();
      }

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

      const video = videoRef.current;
      if (
        video &&
        (shuttleRestarted ||
          (!video.seeking &&
            timestamp - reverseShuttleLastSeekAtRef.current >= REVERSE_SHUTTLE_SEEK_INTERVAL_MS))
      ) {
        reverseShuttleLastSeekAtRef.current = timestamp;
        scheduleVideoSeek(currentMicros, true);
      }

      if (boundary.reached && !shuttleRestarted) {
        handleShuttleEnd({ type: "internal", id: "source-start" });
        return;
      }
      reverseShuttleFrameRef.current = requestAnimationFrame(update);
    };

    reverseShuttleFrameRef.current = requestAnimationFrame(update);
  }, [audioPlayheadRef, handleShuttleEnd, playbackModes, scheduleVideoSeek, videoRef]);

  const handleShuttleStart = useCallback(
    (direction: FrameShuttleDirection, origin: DiagnosticOrigin = { type: "internal" }) => {
      if (!isPlaybackReadyRef.current || shuttleDirectionRef.current === direction) return;
      if (shuttleDirectionRef.current !== 0) handleShuttleEnd(origin);
      flushFrameStepSeek();

      playbackStartSequenceRef.current += 1;
      playbackRequestedRef.current = false;
      isPlayingRef.current = false;
      videoRef.current?.pause();
      pauseAudioPlayback();
      setIsPlaying(false);
      stopPlayheadAnimation();
      shuttleDirectionRef.current = direction;
      setShuttleDirection(direction);
      playbackModes.resetBoundary();
      diagnostics.action("timeline.shuttle.started", origin, {
        direction,
        rate: FRAME_SHUTTLE_PLAYBACK_RATE,
      });

      if (direction === 1) {
        setMediaPlaybackRate(FRAME_SHUTTLE_PLAYBACK_RATE);
        startMediaPlayback();
        return;
      }

      setMediaPlaybackRate(playbackSpeed);
      startReverseShuttleAnimation();
    },
    [
      handleShuttleEnd,
      flushFrameStepSeek,
      pauseAudioPlayback,
      playbackModes,
      playbackSpeed,
      setIsPlaying,
      setShuttleDirection,
      setMediaPlaybackRate,
      startMediaPlayback,
      startReverseShuttleAnimation,
      stopPlayheadAnimation,
      videoRef,
    ],
  );

  const queueScrubSeek = useCallback(
    (micros: number) => {
      pendingScrubMicrosRef.current = clampPlaybackMicros(
        micros,
        trimRef.current.sourceDurationMicros,
      );
      if (scrubFrameRef.current !== null) return;
      scrubFrameRef.current = requestAnimationFrame((timestamp) => {
        scrubFrameRef.current = null;
        const pendingMicros = pendingScrubMicrosRef.current;
        pendingScrubMicrosRef.current = null;
        if (pendingMicros !== null) {
          const publish =
            trimInteractionActiveRef.current || timestamp - lastScrubCommitAtRef.current >= 100;

          if (publish) lastScrubCommitAtRef.current = timestamp;
          commitSeek(pendingMicros, true, publish);
        }
      });
    },
    [commitSeek],
  );

  const flushScrubSeek = useCallback(() => {
    cancelFrame(scrubFrameRef);
    const pendingMicros = pendingScrubMicrosRef.current;
    pendingScrubMicrosRef.current = null;
    commitSeek(pendingMicros ?? currentPlayheadMicrosRef.current, false);
  }, [commitSeek]);

  const handleScrubStart = useCallback(() => {
    flushFrameStepSeek();
    if (shuttleDirectionRef.current !== 0) handleShuttleEnd();
    diagnostics.event("timeline.seek.started", {
      data: { source: "timeline" },
      origin: { type: "timeline", id: "timeline.scrub" },
    });
    timelineInteractionActiveRef.current = true;
    lastScrubCommitAtRef.current = -Infinity;
    playbackStartSequenceRef.current += 1;
    resumeAfterScrubRef.current = playbackRequestedRef.current || isPlayingRef.current;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    videoRef.current?.pause();
    pauseAudioPlayback();
    setIsPlaying(false);
    stopPlayheadAnimation();
  }, [
    flushFrameStepSeek,
    handleShuttleEnd,
    pauseAudioPlayback,
    setIsPlaying,
    stopPlayheadAnimation,
    videoRef,
  ]);

  const handleScrubEnd = useCallback(() => {
    flushScrubSeek();
    diagnostics.event("timeline.seek.completed", {
      data: { micros: currentPlayheadMicrosRef.current },
      origin: { type: "timeline", id: "timeline.scrub" },
    });
    timelineInteractionActiveRef.current = false;
    trimInteractionActiveRef.current = false;
    // A fast/keyframe seek is only for dragging; release always lands precisely.
    if (resumeAfterScrubRef.current) {
      resumeAfterScrubRef.current = false;
      playbackModes.startMicros(currentPlayheadMicrosRef.current, trimRef.current);
      playbackModes.resetBoundary();
      startMediaPlayback();
    } else {
      applyMediaSeek(currentPlayheadMicrosRef.current);
    }
  }, [applyMediaSeek, flushScrubSeek, playbackModes, startMediaPlayback]);

  const trimCommitFrameRef = useRef<number | null>(null);
  const pendingTrimCommitRef = useRef<TrimRange | null>(null);
  const isCurrentSourceIdentity = useCallback(() => {
    const state = store.getState();
    return (
      selectActiveInstanceId(state) === sourceIdentity.activeInstanceId &&
      (selectSourceSelection(state)?.sourcePath ?? null) === sourceIdentity.sourcePath
    );
  }, [sourceIdentity, store]);

  const flushTrimCommit = useCallback(() => {
    if (trimCommitFrameRef.current !== null) cancelAnimationFrame(trimCommitFrameRef.current);
    trimCommitFrameRef.current = null;
    const pendingTrim = pendingTrimCommitRef.current;
    pendingTrimCommitRef.current = null;
    if (pendingTrim && sourcePath && isCurrentSourceIdentity())
      dispatch(trimChanged({ trim: pendingTrim }));
  }, [dispatch, isCurrentSourceIdentity, sourcePath]);

  const queueTrimCommit = useCallback(
    (nextTrim: TrimRange) => {
      pendingTrimCommitRef.current = nextTrim;
      if (trimCommitFrameRef.current !== null) return;
      trimCommitFrameRef.current = requestAnimationFrame(() => {
        trimCommitFrameRef.current = null;
        const pendingTrim = pendingTrimCommitRef.current;
        pendingTrimCommitRef.current = null;
        if (pendingTrim && sourcePath && isCurrentSourceIdentity())
          dispatch(trimChanged({ trim: pendingTrim }));
      });
    },
    [dispatch, isCurrentSourceIdentity, sourcePath],
  );

  const onSetSegmentBoundary = useCallback(
    (boundary: TrimBoundary, origin: DiagnosticOrigin = { type: "internal" }) => {
      diagnostics.action("timeline.trim-boundary.requested", origin, { boundary });
      if (!sourcePath) {
        diagnostics.event("timeline.trim-boundary.ignored", {
          data: { boundary, reason: "source_unavailable" },
          origin,
          result: "ignored",
        });
        return;
      }
      const currentMicros = currentPlayheadMicrosRef.current;
      if (!canSetTrimBoundaryAtPlayhead(trimRef.current, boundary, currentMicros)) {
        diagnostics.event("timeline.trim-boundary.ignored", {
          data: { boundary, reason: "outside_trim_range" },
          origin,
          result: "ignored",
        });
        return;
      }
      const nextTrim = setTrimBoundaryAtPlayhead(trimRef.current, boundary, currentMicros);
      trimRef.current = nextTrim;
      flushTrimCommit();
      dispatch(trimChanged({ trim: nextTrim }));
      diagnostics.event("timeline.trim-boundary.changed", {
        data: { boundary, micros: currentMicros },
        origin,
      });
    },
    [dispatch, flushTrimCommit, sourcePath],
  );

  const onTrimBoundaryChange = useCallback(
    (_boundary: TrimBoundary, nextTrim: TrimRange) => {
      trimRef.current = nextTrim;
      queueTrimCommit(nextTrim);
    },
    [queueTrimCommit],
  );

  const onSegmentMove = useCallback(
    (nextTrim: TrimRange) => {
      trimRef.current = nextTrim;
      queueTrimCommit(nextTrim);
    },
    [queueTrimCommit],
  );

  const beginTrimDrag = useCallback(() => {
    trimInteractionActiveRef.current = true;
    handleScrubStart();
  }, [handleScrubStart]);

  const finishTrimDrag = useCallback(() => {
    flushTrimCommit();
    dispatch(commitActiveEditingInstanceDraft());
    handleScrubEnd();
  }, [dispatch, flushTrimCommit, handleScrubEnd]);

  useLayoutEffect(
    () => () => {
      if (trimCommitFrameRef.current !== null) cancelAnimationFrame(trimCommitFrameRef.current);
      trimCommitFrameRef.current = null;
      pendingTrimCommitRef.current = null;
    },
    [sourceIdentity],
  );

  const handleTogglePlayback = useCallback(
    (origin: DiagnosticOrigin = { type: "internal" }) => {
      if (shuttleDirectionRef.current !== 0) {
        handleShuttleEnd(origin);
        return;
      }
      diagnostics.action("playback.toggle.requested", origin, {
        playing: playbackRequestedRef.current || isPlayingRef.current,
      });
      const video = videoRef.current;
      if (!video || !isPlaybackReadyRef.current) {
        diagnostics.event("playback.toggle.ignored", {
          data: { reason: !video ? "video_unavailable" : "preview_not_ready" },
          origin,
          result: "ignored",
        });
        return;
      }
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
    },
    [commitSeek, handleShuttleEnd, playbackModes, setTransportError, startMediaPlayback, videoRef],
  );

  const handlePausePlayback = useCallback(() => {
    if (shuttleDirectionRef.current !== 0) {
      handleShuttleEnd({ type: "internal", id: "scene-navigation" });
    }
    playbackStartSequenceRef.current += 1;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    resumeAfterScrubRef.current = false;
    videoRef.current?.pause();
    pauseAudioPlayback();
    setIsPlaying(false);
    stopPlayheadAnimation();
  }, [handleShuttleEnd, pauseAudioPlayback, setIsPlaying, stopPlayheadAnimation, videoRef]);

  const handleStepFrame = useCallback(
    (direction: -1 | 1, origin: DiagnosticOrigin = { type: "internal" }) => {
      if (shuttleDirectionRef.current !== 0) handleShuttleEnd(origin);
      diagnostics.action("timeline.frame-step.requested", origin, { direction });
      playbackStartSequenceRef.current += 1;
      playbackRequestedRef.current = false;
      isPlayingRef.current = false;
      videoRef.current?.pause();
      setIsPlaying(false);
      stopPlayheadAnimation();
      const baseMicros = pendingFrameStepSeekMicrosRef.current ?? currentPlayheadMicrosRef.current;
      queueFrameStepSeek(baseMicros + direction * frameDurationMicros(frameRate));
    },
    [
      frameRate,
      handleShuttleEnd,
      queueFrameStepSeek,
      setIsPlaying,
      stopPlayheadAnimation,
      videoRef,
    ],
  );

  const onTimeUpdate = useCallback(
    (seconds: number) => {
      if (
        shuttleDirectionRef.current !== 0 ||
        timelineInteractionActiveRef.current ||
        pendingFrameStepSeekMicrosRef.current !== null ||
        seekSchedulerRef.current?.isPending ||
        videoRef.current?.seeking
      )
        return;
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
      if (currentMicros >= trimRef.current.sourceDurationMicros) stopPlayheadAnimation();
    },
    [audioPlayheadRef, handlePlaybackBoundary, setPlayheadMicros, stopPlayheadAnimation, videoRef],
  );

  const onPause = useCallback(() => {
    if (playbackRequestedRef.current && seekSchedulerRef.current?.isPending) return;
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
    diagnostics.event("playback.state.changed", {
      data: { status: "paused" },
      origin: { type: "internal" },
    });
  }, [onTimeUpdate, pauseAudioPlayback, setIsPlaying, stopPlayheadAnimation, videoRef]);

  const onLoadedMetadata = useCallback(() => {
    commitSeek(currentPlayheadMicrosRef.current);
  }, [commitSeek]);

  const onPlay = useCallback(() => {
    playbackRequestedRef.current = true;
    if (shuttleDirectionRef.current !== 0) {
      if (shuttleDirectionRef.current === 1) startPlayheadAnimation();
      return;
    }
    isPlayingRef.current = true;
    setIsPlaying(true);
    startPlayheadAnimation();
    diagnostics.event("playback.state.changed", {
      data: { status: "playing" },
      origin: { type: "internal" },
    });
  }, [setIsPlaying, startPlayheadAnimation]);

  const onEnded = useCallback(() => {
    diagnostics.event("playback.state.changed", {
      data: { status: "ended" },
      origin: { type: "internal" },
    });
    if (shuttleDirectionRef.current !== 0) {
      if (shuttleDirectionRef.current === 1) {
        const boundary = playbackModes.consumeSourceBoundary(
          trimRef.current.sourceDurationMicros,
          trimRef.current.sourceDurationMicros,
          1,
        );

        const boundaryAction = boundary.reached ? boundary.action : null;
        if (boundaryAction?.type === "restart") {
          commitSeek(boundaryAction.positionMicros);
          playbackModes.resetBoundary();
          startMediaPlayback();
          return;
        }
      }
      handleShuttleEnd({ type: "internal", id: "source-end" });
      return;
    }
    if (videoRef.current) handlePlaybackBoundary(videoRef.current.currentTime * 1_000_000);
  }, [
    commitSeek,
    handlePlaybackBoundary,
    handleShuttleEnd,
    playbackModes,
    startMediaPlayback,
    videoRef,
  ]);

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

export { useTimelinePlaybackRuntime };
