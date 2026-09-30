import { type MutableRefObject, useCallback } from "react";

import { frameDurationMicros } from "@/domain/playback";
import type { TrimRange } from "@/domain/trim";
import { diagnostics } from "@/lib/diagnostics";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";

import type { FrameShuttleDirection } from "../lib/editor-shortcuts";

import type { usePlaybackModes } from "./usePlaybackModes";

interface TimelineTransportCommandArgs {
  commitSeek: (micros: number) => void;
  currentPlayheadMicrosRef: MutableRefObject<number>;
  flushFrameStepSeek: () => void;
  frameRate: Parameters<typeof frameDurationMicros>[0];
  getMediaState: () => { currentTimeSeconds: number; paused: boolean; seeking: boolean } | null;
  handleShuttleEnd: (origin?: DiagnosticOrigin) => void;
  isPlaybackReadyRef: MutableRefObject<boolean>;
  isPlayingRef: MutableRefObject<boolean>;
  pauseAudioPlayback: () => void;
  pauseMedia: () => void;
  pendingFrameStepSeekMicrosRef: MutableRefObject<number | null>;
  playbackModes: ReturnType<typeof usePlaybackModes>;
  playbackRequestedRef: MutableRefObject<boolean>;
  playbackStartSequenceRef: MutableRefObject<number>;
  queueFrameStepSeek: (micros: number) => void;
  resumeAfterScrubRef: MutableRefObject<boolean>;
  setIsPlaying: (playing: boolean) => void;
  setTransportError: (error: string | null) => void;
  shuttleDirectionRef: MutableRefObject<FrameShuttleDirection | 0>;
  startMediaPlayback: () => void;
  stopPlayheadAnimation: () => void;
  transportSuspendedRef: MutableRefObject<boolean>;
  trimRef: MutableRefObject<TrimRange>;
}

function useTimelineTransportCommands({
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
}: TimelineTransportCommandArgs) {
  const togglePlayback = useCallback(
    (origin: DiagnosticOrigin = { type: "internal" }) => {
      if (shuttleDirectionRef.current !== 0) {
        handleShuttleEnd(origin);
        return;
      }
      diagnostics.action("playback.toggle.requested", origin, {
        playing: playbackRequestedRef.current || isPlayingRef.current,
      });
      const mediaAvailable = getMediaState() !== null;
      if (!mediaAvailable || !isPlaybackReadyRef.current) {
        diagnostics.event("playback.toggle.ignored", {
          data: { reason: !mediaAvailable ? "video_unavailable" : "preview_not_ready" },
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
        pauseMedia();
        return;
      }
      flushFrameStepSeek();
      const startMicros = playbackModes.startMicros(
        currentPlayheadMicrosRef.current,
        trimRef.current,
      );

      if (startMicros !== currentPlayheadMicrosRef.current) commitSeek(startMicros);
      playbackModes.resetBoundary();
      startMediaPlayback();
    },
    [
      commitSeek,
      currentPlayheadMicrosRef,
      flushFrameStepSeek,
      getMediaState,
      handleShuttleEnd,
      isPlaybackReadyRef,
      isPlayingRef,
      pauseMedia,
      playbackModes,
      playbackRequestedRef,
      playbackStartSequenceRef,
      setTransportError,
      shuttleDirectionRef,
      startMediaPlayback,
      trimRef,
    ],
  );

  const pausePlayback = useCallback(() => {
    if (shuttleDirectionRef.current !== 0)
      handleShuttleEnd({ type: "internal", id: "scene-navigation" });
    playbackStartSequenceRef.current += 1;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    resumeAfterScrubRef.current = false;
    pauseMedia();
    pauseAudioPlayback();
    setIsPlaying(false);
    stopPlayheadAnimation();
  }, [
    handleShuttleEnd,
    isPlayingRef,
    pauseAudioPlayback,
    pauseMedia,
    playbackRequestedRef,
    playbackStartSequenceRef,
    resumeAfterScrubRef,
    setIsPlaying,
    shuttleDirectionRef,
    stopPlayheadAnimation,
  ]);

  const suspendForInteraction = useCallback(() => {
    if (shuttleDirectionRef.current !== 0) {
      handleShuttleEnd({ type: "internal", id: "preview-interaction" });
      transportSuspendedRef.current = true;
      return false;
    }
    const resumePlayback = playbackRequestedRef.current || isPlayingRef.current;
    transportSuspendedRef.current = true;
    playbackStartSequenceRef.current += 1;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    pauseMedia();
    pauseAudioPlayback();
    setIsPlaying(false);
    stopPlayheadAnimation();
    return resumePlayback;
  }, [
    handleShuttleEnd,
    isPlayingRef,
    pauseAudioPlayback,
    pauseMedia,
    playbackRequestedRef,
    playbackStartSequenceRef,
    setIsPlaying,
    shuttleDirectionRef,
    stopPlayheadAnimation,
    transportSuspendedRef,
  ]);

  const resumeAfterInteraction = useCallback(
    (resumePlayback: boolean) => {
      transportSuspendedRef.current = false;
      if (resumePlayback) togglePlayback({ type: "internal", id: "preview-interaction" });
    },
    [togglePlayback, transportSuspendedRef],
  );

  const stepFrame = useCallback(
    (direction: -1 | 1, origin: DiagnosticOrigin = { type: "internal" }) => {
      if (shuttleDirectionRef.current !== 0) handleShuttleEnd(origin);
      diagnostics.action("timeline.frame-step.requested", origin, { direction });
      playbackStartSequenceRef.current += 1;
      playbackRequestedRef.current = false;
      isPlayingRef.current = false;
      pauseMedia();
      setIsPlaying(false);
      stopPlayheadAnimation();
      const baseMicros = pendingFrameStepSeekMicrosRef.current ?? currentPlayheadMicrosRef.current;

      queueFrameStepSeek(baseMicros + direction * frameDurationMicros(frameRate));
    },
    [
      currentPlayheadMicrosRef,
      frameRate,
      handleShuttleEnd,
      isPlayingRef,
      pauseMedia,
      pendingFrameStepSeekMicrosRef,
      playbackRequestedRef,
      playbackStartSequenceRef,
      queueFrameStepSeek,
      setIsPlaying,
      shuttleDirectionRef,
      stopPlayheadAnimation,
    ],
  );

  return {
    pausePlayback,
    resumeAfterInteraction,
    stepFrame,
    suspendForInteraction,
    togglePlayback,
  };
}

export { useTimelineTransportCommands };
