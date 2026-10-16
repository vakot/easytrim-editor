import { useCallback, useEffect, useMemo, useRef } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectPlaybackVolumePercent } from "@/app/store/slices/preferences-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import {
  type AudioChainSelection,
  audioFiltersRequireLoudnessAnalysis,
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
  const webAudioTracksRef = useRef<WebAudioTrack[]>([]);
  const playbackErrorObserverRef = useRef<(() => void) | null>(null);
  const playbackRateRef = useRef(1);
  const playbackVolumePercentRef = useRef(playbackVolumePercent);

  const enabledTracks = useMemo(() => audioTracks.filter((track) => track.enabled), [audioTracks]);
  const webAudioTracks: WebAudioTrack[] = useMemo(
    () =>
      enabledTracks.flatMap((track) => {
        const stream = media?.audioStreams.find(
          (candidate) => candidate.streamIndex === track.streamIndex,
        );

        const requiresMeasurements = audioFiltersRequireLoudnessAnalysis(track.processing.filters);
        if (requiresMeasurements && track.loudnessAnalysis.status !== "ready") return [];

        // Track Volume stays out of the selection so changing it never re-renders PCM.
        const selection: AudioChainSelection = {
          filters: track.processing.filters,
          ...(requiresMeasurements && track.loudnessAnalysis.status === "ready"
            ? { loudnessMeasurements: track.loudnessAnalysis.value }
            : {}),
          streamIndex: track.streamIndex,
        };

        return [
          {
            selection,
            startTimeMicros: stream?.startTimeMicros ?? 0,
            durationMicros: stream?.durationMicros,
            streamIndex: track.streamIndex,
            volume: track.processing.volume,
          },
        ];
      }),
    [enabledTracks, media],
  );

  useEffect(() => {
    if (!sourcePath || !media || typeof AudioContext === "undefined") return;
    const session = new AudioPlaybackSession(sourcePath);
    sessionRef.current = session;
    session.setPlaybackRate(playbackRateRef.current);
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
    webAudioTracksRef.current = webAudioTracks;
    const session = sessionRef.current;
    if (!session) return;
    session.setDuration(media?.durationMicros ?? 0);
    session.setTracks(webAudioTracks);
  }, [activeInstanceId, media, sourcePath, webAudioTracks]);

  useEffect(() => {
    playbackVolumePercentRef.current = playbackVolumePercent;
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

  const setLiveOutputVolume = useCallback((volumePercent: number | null) => {
    sessionRef.current?.setOutputGain((volumePercent ?? playbackVolumePercentRef.current) / 100);
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    playbackRateRef.current = rate;
    sessionRef.current?.setPlaybackRate(rate);
  }, []);

  const setLiveTrackVolume = useCallback((streamIndex: number, volume: number | null) => {
    const committedVolume = webAudioTracksRef.current.find(
      (track) => track.streamIndex === streamIndex,
    )?.volume;

    const nextVolume = volume ?? committedVolume;
    if (nextVolume !== undefined) sessionRef.current?.setTrackVolume(streamIndex, nextVolume);
  }, []);

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

  const getMeter = useCallback(() => sessionRef.current?.meter ?? null, []);

  const requiresLoudnessAnalysis = enabledTracks.some(
    (track) =>
      audioFiltersRequireLoudnessAnalysis(track.processing.filters) &&
      track.loudnessAnalysis.status !== "ready",
  );

  const isReady = !requiresLoudnessAnalysis && sourcePath !== null && media !== null;
  const hasActiveOutput = enabledTracks.length > 0 && typeof AudioContext !== "undefined";

  return useMemo<AudioPlaybackAdapter>(
    () => ({
      getCurrentTimeSeconds,
      getMeter,
      hasActiveOutput,
      isReady,
      pause,
      prefetchAt,
      prepareAt,
      registerPlaybackErrorObserver,
      seek,
      setLiveOutputVolume,
      setLiveTrackVolume,
      setPlaybackRate,
      startAlignedWithVideoAt,
    }),
    [
      getCurrentTimeSeconds,
      getMeter,
      hasActiveOutput,
      isReady,
      pause,
      prefetchAt,
      prepareAt,
      registerPlaybackErrorObserver,
      seek,
      setLiveOutputVolume,
      setLiveTrackVolume,
      setPlaybackRate,
      startAlignedWithVideoAt,
    ],
  );
}

export { useAudioPlaybackRuntime };
