import { useCallback, useEffect, useMemo, useRef } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectPlaybackVolumePercent } from "@/app/store/slices/preferences-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import {
  audioTrackPlaybackFfmpegProcessing,
  type AudioTrackSelection,
  effectiveAudioTrackGainDb,
  getAudioTrackLiveHighPassEffects,
} from "@/domain/audio-processing";

import type { AudioPlaybackAdapter } from "../contexts/audio-transport-context";
import { AudioPlaybackSession } from "../lib/audio-playback-session";
import type { WebAudioTrack } from "../lib/web-audio-engine";

function useAudioPlaybackRuntime(): AudioPlaybackAdapter {
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const sourcePath = useAppSelector(selectSourceSelection)?.sourcePath ?? null;
  const media = useAppSelector(selectSourceMedia);
  const audioTracks = useAppSelector(selectAudioTracks);
  const playbackVolumePercent = useAppSelector(selectPlaybackVolumePercent);
  const sessionRef = useRef<AudioPlaybackSession | null>(null);
  const playbackErrorObserverRef = useRef<(() => void) | null>(null);

  const enabledTracks = useMemo(() => audioTracks.filter((track) => track.enabled), [audioTracks]);
  const webAudioTracks: WebAudioTrack[] = useMemo(
    () =>
      enabledTracks.flatMap((track) => {
        const stream = media?.audioStreams.find(
          (candidate) => candidate.streamIndex === track.streamIndex,
        );

        const loudnessAnalysis =
          track.processing.loudnessNormalization !== undefined &&
          track.loudnessAnalysis.status === "ready"
            ? { loudnessAnalysis: { ...track.loudnessAnalysis.value } }
            : {};

        if (
          track.processing.loudnessNormalization !== undefined &&
          track.loudnessAnalysis.status !== "ready"
        ) {
          return [];
        }

        const selection: AudioTrackSelection = {
          ...loudnessAnalysis,
          processing: audioTrackPlaybackFfmpegProcessing(track.processing),
          streamIndex: track.streamIndex,
        };

        return [
          {
            gainDb: effectiveAudioTrackGainDb(track.processing),
            liveHighPassEffects: getAudioTrackLiveHighPassEffects(track.processing),
            selection,
            startTimeMicros: stream?.startTimeMicros ?? 0,
            durationMicros: stream?.durationMicros,
            streamIndex: track.streamIndex,
          },
        ];
      }),
    [enabledTracks, media],
  );

  useEffect(() => {
    if (!sourcePath || !media || typeof AudioContext === "undefined") return;
    const session = new AudioPlaybackSession(sourcePath);
    sessionRef.current = session;
    const unregisterPlaybackErrorObserver = session.registerPlaybackErrorObserver(() => {
      playbackErrorObserverRef.current?.();
    });

    return () => {
      if (sessionRef.current === session) sessionRef.current = null;
      unregisterPlaybackErrorObserver();
      session.close();
    };
  }, [activeInstanceId, media, sourcePath]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.setDuration(media?.durationMicros ?? 0);
    session.setTracks(webAudioTracks);
  }, [activeInstanceId, media, sourcePath, webAudioTracks]);

  useEffect(() => {
    sessionRef.current?.setOutputGain(playbackVolumePercent / 100);
  }, [activeInstanceId, media, playbackVolumePercent, sourcePath]);

  useEffect(() => {
    const isMono =
      webAudioTracks.length > 0 &&
      webAudioTracks.every(
        (track) =>
          media?.audioStreams.find((stream) => stream.streamIndex === track.streamIndex)
            ?.channels === 1,
      );

    sessionRef.current?.setMono(isMono);
  }, [activeInstanceId, media, sourcePath, webAudioTracks]);

  const pause = useCallback(() => sessionRef.current?.pause(), []);

  const seek = useCallback((seconds: number) => sessionRef.current?.seek(seconds), []);

  const prepareAt = useCallback(
    (seconds: number) => sessionRef.current?.prepareAt(seconds) ?? Promise.resolve(),
    [],
  );

  const prefetchAt = useCallback((seconds: number) => {
    void sessionRef.current?.prefetchAt(seconds);
  }, []);

  const startAlignedWithVideoAt = useCallback(
    (videoPositionSeconds: number) =>
      sessionRef.current?.startAlignedWithVideoAt(videoPositionSeconds) ??
      Promise.resolve(videoPositionSeconds),
    [],
  );

  const registerPlaybackErrorObserver = useCallback((observer: () => void) => {
    playbackErrorObserverRef.current = observer;
    return () => {
      if (playbackErrorObserverRef.current === observer) playbackErrorObserverRef.current = null;
    };
  }, []);

  const getCurrentTimeSeconds = useCallback(() => {
    const session = sessionRef.current;
    return session?.hasTracks ? session.currentTimeSeconds : null;
  }, []);

  const requiresLoudnessAnalysis = enabledTracks.some(
    (track) =>
      track.processing.loudnessNormalization !== undefined &&
      track.loudnessAnalysis.status !== "ready",
  );

  const isReady = !requiresLoudnessAnalysis && sourcePath !== null && media !== null;
  const hasActiveOutput = enabledTracks.length > 0 && typeof AudioContext !== "undefined";

  return useMemo<AudioPlaybackAdapter>(
    () => ({
      getCurrentTimeSeconds,
      hasActiveOutput,
      isReady,
      pause,
      prefetchAt,
      prepareAt,
      registerPlaybackErrorObserver,
      seek,
      startAlignedWithVideoAt,
    }),
    [
      getCurrentTimeSeconds,
      hasActiveOutput,
      isReady,
      pause,
      prefetchAt,
      prepareAt,
      registerPlaybackErrorObserver,
      seek,
      startAlignedWithVideoAt,
    ],
  );
}

export { useAudioPlaybackRuntime };
