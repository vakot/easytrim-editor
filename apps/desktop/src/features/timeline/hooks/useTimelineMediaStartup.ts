import { type MutableRefObject, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAudioTransport } from "@/features/audio";
import { usePreviewMediaTransport } from "@/features/preview";

import type { FrameShuttleDirection } from "../lib/editor-shortcuts";
import { cancelFrame } from "../lib/playhead-sync";

interface TimelineMediaStartupArgs {
  currentPlayheadMicrosRef: MutableRefObject<number>;
  isPlaybackReady: boolean;
  isPlaybackReadyRef: MutableRefObject<boolean>;
  isPlayingRef: MutableRefObject<boolean>;
  pauseAudioPlayback: () => void;
  playbackRequestedRef: MutableRefObject<boolean>;
  playbackSpeed: number;
  playbackStartSequenceRef: MutableRefObject<number>;
  reverseShuttleFrameRef: MutableRefObject<number | null>;
  setAudioPlaybackRate: (rate: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setShuttleDirection: (direction: FrameShuttleDirection | 0) => void;
  setTransportError: (error: string | null) => void;
  shuttleDirectionRef: MutableRefObject<FrameShuttleDirection | 0>;
  stopPlayheadAnimation: () => void;
  timelineInteractionActiveRef: MutableRefObject<boolean>;
  transportSuspendedRef: MutableRefObject<boolean>;
  usesExternalAudio: boolean;
}

function useTimelineMediaStartup({
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
}: TimelineMediaStartupArgs) {
  const { t } = useTranslation();
  const { resumeAt, resumeAudioContext, startAt, syncTo } = useAudioTransport();
  const { getMediaState, pauseMedia, playMedia, seekMedia, setPlaybackRate } =
    usePreviewMediaTransport();

  const cancelPendingPlaybackStart = useCallback(() => {
    playbackStartSequenceRef.current += 1;
    playbackRequestedRef.current = false;
  }, [playbackRequestedRef, playbackStartSequenceRef]);

  const handlePlaybackStartFailure = useCallback(() => {
    cancelPendingPlaybackStart();
    isPlayingRef.current = false;
    shuttleDirectionRef.current = 0;
    cancelFrame(reverseShuttleFrameRef);
    pauseMedia();
    setPlaybackRate(playbackSpeed);
    setAudioPlaybackRate(playbackSpeed);
    pauseAudioPlayback();
    setIsPlaying(false);
    setShuttleDirection(0);
    stopPlayheadAnimation();
    setTransportError(t("preview.playback.playbackFailed"));
  }, [
    isPlayingRef,
    cancelPendingPlaybackStart,
    pauseAudioPlayback,
    playbackSpeed,
    pauseMedia,
    reverseShuttleFrameRef,
    setAudioPlaybackRate,
    setIsPlaying,
    setPlaybackRate,
    setShuttleDirection,
    setTransportError,
    shuttleDirectionRef,
    stopPlayheadAnimation,
    t,
  ]);

  const resumeExternalAudioPlayback = useCallback(() => {
    const mediaState = getMediaState();
    if (!mediaState || mediaState.paused) return;

    const startSequence = playbackStartSequenceRef.current;
    void resumeAt(mediaState.currentTimeSeconds).catch(() => {
      if (startSequence !== playbackStartSequenceRef.current) return;
      handlePlaybackStartFailure();
    });
  }, [getMediaState, handlePlaybackStartFailure, playbackStartSequenceRef, resumeAt]);

  useEffect(() => {
    if (!usesExternalAudio || !isPlaybackReady || !isPlayingRef.current) return;
    resumeExternalAudioPlayback();
  }, [isPlaybackReady, isPlayingRef, resumeExternalAudioPlayback, usesExternalAudio]);

  const scheduleVideoSeek = useCallback(
    (micros: number, approximate: boolean, onSettled?: () => void) => {
      seekMedia(micros / 1_000_000, approximate, onSettled);
    },
    [seekMedia],
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
              syncTo(micros / 1_000_000, true);
              if (isPlayingRef.current) resumeExternalAudioPlayback();
            },
      );
    },
    [
      isPlayingRef,
      pauseAudioPlayback,
      resumeExternalAudioPlayback,
      scheduleVideoSeek,
      syncTo,
      timelineInteractionActiveRef,
    ],
  );

  const startMediaPlayback = useCallback(() => {
    if (transportSuspendedRef.current || !getMediaState() || !isPlaybackReadyRef.current) return;
    const startMicros = currentPlayheadMicrosRef.current;
    const startSequence = ++playbackStartSequenceRef.current;
    playbackRequestedRef.current = true;
    setTransportError(null);
    void resumeAudioContext().catch(() => {
      if (startSequence !== playbackStartSequenceRef.current) return;
      handlePlaybackStartFailure();
    });
    scheduleVideoSeek(startMicros, false, () => {
      if (startSequence !== playbackStartSequenceRef.current || transportSuspendedRef.current)
        return;
      void Promise.all([playMedia(), startAt(startMicros / 1_000_000)]).catch(() => {
        if (startSequence !== playbackStartSequenceRef.current) return;
        handlePlaybackStartFailure();
      });
    });
  }, [
    currentPlayheadMicrosRef,
    handlePlaybackStartFailure,
    isPlaybackReadyRef,
    getMediaState,
    playbackRequestedRef,
    playbackStartSequenceRef,
    playMedia,
    resumeAudioContext,
    scheduleVideoSeek,
    setTransportError,
    startAt,
    transportSuspendedRef,
  ]);

  return {
    applyMediaSeek,
    cancelPendingPlaybackStart,
    scheduleVideoSeek,
    startMediaPlayback,
  };
}

export { useTimelineMediaStartup };
