import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import { useAudioTransport } from "@/features/audio";
import { usePreviewMediaTransport } from "@/features/preview";

import {
  PlaybackTransportContext,
  TimelineFrameContext,
} from "./contexts/timeline-runtime-contexts";
import { frameCountFor, frameToSeconds, secondsToFrame } from "./lib/frame-time";

const DEFAULT_FRAME_RATE = { denominator: 1, numerator: 30 } as const;

function TimelinePlaybackProvider({ children }: { children: ReactNode }) {
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const source = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const {
    getMediaState,
    isSeekPending,
    isPreviewReady,
    pauseMedia,
    playMedia,
    previewKey,
    registerMediaObserver,
    requestPlaybackFrame,
    seekMedia,
    setPlaybackRate,
  } = usePreviewMediaTransport();
  const {
    pause: pauseAudio,
    resumeAudioContext,
    setPlaybackRate: setAudioPlaybackRate,
    startAt: startAudioAt,
    syncTo: syncAudioTo,
  } = useAudioTransport();

  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;
  const metadataFrameCount = media?.video.frameCount;
  const framesCount =
    metadataFrameCount && metadataFrameCount > 0
      ? metadataFrameCount
      : frameCountFor(media?.durationMicros ?? 0, frameRate);
  const frameRateForConversion = frameRate ?? DEFAULT_FRAME_RATE;

  const [currentFrame, setCurrentFrameState] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const clampFrame = useCallback(
    (frame: number) =>
      framesCount <= 0 ? 0 : Math.max(0, Math.min(framesCount - 1, Math.round(frame))),
    [framesCount],
  );

  const publishFrame = useCallback(
    (frame: number) => {
      const nextFrame = clampFrame(frame);
      setCurrentFrameState(nextFrame);
    },
    [clampFrame],
  );

  const setCurrentFrame = useCallback(
    (frame: number) => {
      const nextFrame = clampFrame(frame);
      publishFrame(nextFrame);
      if (framesCount === 0) return;
      const seconds = frameToSeconds(nextFrame, frameRateForConversion);
      seekMedia(seconds, false);
      syncAudioTo(seconds, true);
    },
    [clampFrame, frameRateForConversion, framesCount, publishFrame, seekMedia, syncAudioTo],
  );

  const pause = useCallback(() => {
    pauseMedia();
    pauseAudio();
    setIsPlaying(false);
  }, [pauseAudio, pauseMedia]);

  const toggle = useCallback(() => {
    if (!isPreviewReady || framesCount === 0) return;
    if (getMediaState()?.paused === false) {
      pause();
      return;
    }

    const seconds = frameToSeconds(currentFrame, frameRateForConversion);
    void resumeAudioContext();
    setAudioPlaybackRate(1);
    void startAudioAt(seconds).catch(pauseAudio);
    void playMedia().catch(pauseAudio);
  }, [
    frameRateForConversion,
    framesCount,
    getMediaState,
    isPreviewReady,
    currentFrame,
    pause,
    pauseAudio,
    playMedia,
    resumeAudioContext,
    setAudioPlaybackRate,
    startAudioAt,
  ]);

  const suspendForInteraction = useCallback(() => {
    const shouldResume = !getMediaState()?.paused;
    if (shouldResume) pause();
    return shouldResume;
  }, [getMediaState, pause]);

  const resumeAfterInteraction = useCallback(
    (resumePlayback: boolean) => {
      if (resumePlayback) toggle();
    },
    [toggle],
  );

  useEffect(() => {
    publishFrame(0);
    pause();
  }, [activeInstanceId, pause, publishFrame, previewKey, source?.sourcePath]);

  useEffect(() => {
    setPlaybackRate(1);
    setAudioPlaybackRate(1);
  }, [setAudioPlaybackRate, setPlaybackRate]);

  useEffect(
    () =>
      registerMediaObserver({
        onEnded: pause,
        onPause: () => {
          setIsPlaying(false);
          pauseAudio();
        },
        onPlay: () => setIsPlaying(true),
        onPlaybackError: pause,
        onTimeUpdate: (seconds) => {
          if (isSeekPending()) return;
          publishFrame(secondsToFrame(seconds, frameRateForConversion, framesCount));
          syncAudioTo(seconds);
        },
      }),
    [
      frameRateForConversion,
      framesCount,
      isSeekPending,
      pause,
      pauseAudio,
      publishFrame,
      registerMediaObserver,
      syncAudioTo,
    ],
  );

  useEffect(() => {
    if (!isPlaying) return;
    let frame = requestPlaybackFrame(update);

    function update(_timestamp: number, seconds: number) {
      if (!isSeekPending()) {
        publishFrame(secondsToFrame(seconds, frameRateForConversion, framesCount));
        syncAudioTo(seconds);
      }
      frame = requestPlaybackFrame(update);
    }

    return () => frame?.cancel();
  }, [
    frameRateForConversion,
    framesCount,
    isSeekPending,
    isPlaying,
    publishFrame,
    requestPlaybackFrame,
    syncAudioTo,
  ]);

  const frameState = useMemo(
    () => ({ currentFrame, framesCount, setCurrentFrame }),
    [currentFrame, framesCount, setCurrentFrame],
  );
  const transport = useMemo(
    () => ({ isPlaying, pause, resumeAfterInteraction, suspendForInteraction, toggle }),
    [isPlaying, pause, resumeAfterInteraction, suspendForInteraction, toggle],
  );

  return (
    <TimelineFrameContext.Provider value={frameState}>
      <PlaybackTransportContext.Provider value={transport}>
        {children}
      </PlaybackTransportContext.Provider>
    </TimelineFrameContext.Provider>
  );
}

export { TimelinePlaybackProvider };
