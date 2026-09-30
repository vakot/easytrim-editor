import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
} from "react";

import type { TrimRange } from "@/domain/trim";
import type { PreviewMediaState } from "@/features/preview";
import { diagnostics } from "@/lib/diagnostics";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";

import { FRAME_SHUTTLE_PLAYBACK_RATE, type FrameShuttleDirection } from "../lib/editor-shortcuts";
import { cancelFrame } from "../lib/playhead-sync";

interface TimelineShuttleArgs {
  commitSeek: (micros: number) => void;
  currentPlayheadMicrosRef: MutableRefObject<number>;
  flushFrameStepSeek: () => void;
  getMediaState: () => PreviewMediaState | null;
  isPlaybackReadyRef: MutableRefObject<boolean>;
  isPlayingRef: MutableRefObject<boolean>;
  isSeekPending: () => boolean;
  lastPlaybackCommitAtRef: MutableRefObject<number>;
  pauseAudioPlayback: () => void;
  pauseMedia: () => void;
  playbackModes: ReturnType<typeof import("./usePlaybackModes").usePlaybackModes>;
  playbackSpeed: number;
  reverseShuttleFrameRef: MutableRefObject<number | null>;
  reverseShuttleLastFrameAtRef: MutableRefObject<number | null>;
  reverseShuttleLastSeekAtRef: MutableRefObject<number>;
  scheduleVideoSeek: (micros: number, approximate: boolean, onSettled?: () => void) => void;
  setAudioPlaybackRate: (rate: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setPlayheadMicros: (micros: number) => void;
  setShuttleDirection: Dispatch<SetStateAction<FrameShuttleDirection | 0>>;
  shuttleDirection: FrameShuttleDirection | 0;
  shuttleDirectionRef: MutableRefObject<FrameShuttleDirection | 0>;
  startMediaPlayback: () => void;
  stopPlayheadAnimation: () => void;
  syncPlayhead: (micros: number) => void;
  trimRef: MutableRefObject<TrimRange>;
}

const REVERSE_SHUTTLE_SEEK_INTERVAL_MS = 50;
const SHUTTLE_MAX_FRAME_DELTA_MS = 100;

function useTimelineShuttle({
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
  setIsPlaying,
  setPlaybackRate,
  setPlayheadMicros,
  setShuttleDirection,
  shuttleDirection,
  shuttleDirectionRef,
  startMediaPlayback,
  stopPlayheadAnimation,
  syncPlayhead,
  trimRef,
}: TimelineShuttleArgs) {
  const setShuttlePlaybackRate = useCallback(
    (rate: number) => {
      setPlaybackRate(rate);
      setAudioPlaybackRate(rate);
    },
    [setAudioPlaybackRate, setPlaybackRate],
  );

  const stopShuttle = useCallback(
    (origin: DiagnosticOrigin = { type: "internal" }) => {
      flushFrameStepSeek();
      const direction = shuttleDirectionRef.current;
      if (direction === 0) return;

      const mediaState = getMediaState();
      const finalMicros =
        direction === 1 && mediaState && !mediaState.seeking && !isSeekPending()
          ? mediaState.currentTimeSeconds * 1_000_000
          : currentPlayheadMicrosRef.current;

      shuttleDirectionRef.current = 0;
      cancelFrame(reverseShuttleFrameRef);
      reverseShuttleLastFrameAtRef.current = null;
      isPlayingRef.current = false;
      pauseMedia();
      pauseAudioPlayback();
      setIsPlaying(false);
      setShuttleDirection(0);
      stopPlayheadAnimation();
      setShuttlePlaybackRate(playbackSpeed);
      commitSeek(finalMicros);
      diagnostics.event("timeline.shuttle.completed", { data: { direction }, origin });
    },
    [
      commitSeek,
      currentPlayheadMicrosRef,
      flushFrameStepSeek,
      getMediaState,
      isPlayingRef,
      isSeekPending,
      pauseAudioPlayback,
      pauseMedia,
      playbackSpeed,
      reverseShuttleFrameRef,
      reverseShuttleLastFrameAtRef,
      setIsPlaying,
      setShuttleDirection,
      setShuttlePlaybackRate,
      shuttleDirectionRef,
      stopPlayheadAnimation,
    ],
  );

  const startReverseShuttle = useCallback(() => {
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
      syncPlayhead(currentMicros);
      if (timestamp - lastPlaybackCommitAtRef.current >= 100) {
        lastPlaybackCommitAtRef.current = timestamp;
        setPlayheadMicros(currentMicros);
      }

      const mediaState = getMediaState();
      if (
        mediaState &&
        (shuttleRestarted ||
          (!mediaState.seeking &&
            timestamp - reverseShuttleLastSeekAtRef.current >= REVERSE_SHUTTLE_SEEK_INTERVAL_MS))
      ) {
        reverseShuttleLastSeekAtRef.current = timestamp;
        scheduleVideoSeek(currentMicros, true);
      }

      if (boundary.reached && !shuttleRestarted) {
        stopShuttle({ type: "internal", id: "source-start" });
        return;
      }
      reverseShuttleFrameRef.current = requestAnimationFrame(update);
    };

    reverseShuttleFrameRef.current = requestAnimationFrame(update);
  }, [
    currentPlayheadMicrosRef,
    getMediaState,
    lastPlaybackCommitAtRef,
    playbackModes,
    reverseShuttleFrameRef,
    reverseShuttleLastFrameAtRef,
    reverseShuttleLastSeekAtRef,
    scheduleVideoSeek,
    setPlayheadMicros,
    shuttleDirectionRef,
    stopShuttle,
    syncPlayhead,
    trimRef,
  ]);

  const startShuttle = useCallback(
    (direction: FrameShuttleDirection, origin: DiagnosticOrigin = { type: "internal" }) => {
      if (!isPlaybackReadyRef.current || shuttleDirectionRef.current === direction) return;
      if (shuttleDirectionRef.current !== 0) stopShuttle(origin);
      flushFrameStepSeek();
      isPlayingRef.current = false;
      pauseMedia();
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
        setShuttlePlaybackRate(FRAME_SHUTTLE_PLAYBACK_RATE);
        startMediaPlayback();
        return;
      }
      setShuttlePlaybackRate(playbackSpeed);
      startReverseShuttle();
    },
    [
      flushFrameStepSeek,
      isPlaybackReadyRef,
      isPlayingRef,
      pauseAudioPlayback,
      pauseMedia,
      playbackModes,
      playbackSpeed,
      setShuttleDirection,
      setIsPlaying,
      setShuttlePlaybackRate,
      startMediaPlayback,
      startReverseShuttle,
      stopPlayheadAnimation,
      stopShuttle,
      shuttleDirectionRef,
    ],
  );

  const resetShuttle = useCallback(() => {
    cancelFrame(reverseShuttleFrameRef);
    shuttleDirectionRef.current = 0;
    reverseShuttleLastFrameAtRef.current = null;
    setShuttleDirection(0);
  }, [
    reverseShuttleFrameRef,
    reverseShuttleLastFrameAtRef,
    setShuttleDirection,
    shuttleDirectionRef,
  ]);

  useEffect(() => () => cancelFrame(reverseShuttleFrameRef), [reverseShuttleFrameRef]);

  return {
    lastPlaybackCommitAtRef,
    resetShuttle,
    shuttleDirection,
    shuttleDirectionRef,
    startShuttle,
    stopShuttle,
  };
}

export { useTimelineShuttle };
