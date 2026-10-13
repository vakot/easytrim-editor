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
    isPreviewReady,
    isSeekPending,
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

  const sessionKey = JSON.stringify([activeInstanceId, source?.sourcePath ?? null, previewKey]);
  const [playbackState, setPlaybackState] = useState(() => ({
    sessionKey,
    currentFrame: 0,
    isPlaying: false,
  }));

  if (playbackState.sessionKey !== sessionKey) {
    setPlaybackState({ sessionKey, currentFrame: 0, isPlaying: false });
  }

  const { currentFrame, isPlaying } = playbackState;

  const setCurrentFrameState = useCallback(
    (frame: number) => setPlaybackState((state) => ({ ...state, currentFrame: frame })),
    [],
  );

  const setIsPlayingState = useCallback(
    (playing: boolean) => setPlaybackState((state) => ({ ...state, isPlaying: playing })),
    [],
  );

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
    [clampFrame, setCurrentFrameState],
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
    setIsPlayingState(false);
  }, [pauseAudio, pauseMedia, setIsPlayingState]);

  const setIsPlaying = useCallback(
    (shouldPlay: boolean) => {
      if (!shouldPlay) {
        pause();
        return;
      }
      if (!isPreviewReady || framesCount === 0 || getMediaState()?.paused === false) return;

      const seconds = frameToSeconds(currentFrame, frameRateForConversion);
      void resumeAudioContext();
      setAudioPlaybackRate(1);
      void startAudioAt(seconds).catch(pauseAudio);
      void playMedia().catch(pauseAudio);
    },
    [
      currentFrame,
      frameRateForConversion,
      framesCount,
      getMediaState,
      isPreviewReady,
      pause,
      pauseAudio,
      playMedia,
      resumeAudioContext,
      setAudioPlaybackRate,
      startAudioAt,
    ],
  );

  useEffect(() => {
    pauseMedia();
    pauseAudio();
  }, [pauseAudio, pauseMedia, sessionKey]);

  useEffect(() => {
    setPlaybackRate(1);
    setAudioPlaybackRate(1);
  }, [setAudioPlaybackRate, setPlaybackRate]);

  useEffect(
    () =>
      registerMediaObserver({
        onEnded: pause,
        onPause: () => {
          setIsPlayingState(false);
          pauseAudio();
        },
        onPlay: () => setIsPlayingState(true),
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
      setIsPlayingState,
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
    () => ({
      isPlaying,
      setIsPlaying,
    }),
    [isPlaying, setIsPlaying],
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
