import { useCallback, useEffect, useMemo, useRef } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectPlaybackVolumePercent } from "@/app/store/slices/preferences-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import {
  audioTrackPlaybackFfmpegProcessing,
  type AudioTrackSelection,
  effectiveAudioTrackGainDb,
  getAudioTrackLiveHighPassEffects,
} from "@/domain/audio-processing";

import type { AudioPlaybackContract } from "../contexts/audio-playback-context";
import type { AudioPlaybackAdapter } from "../contexts/audio-transport-context";
import { AudioPlaybackSession } from "../lib/audio-playback-session";
import type { WebAudioTrack } from "../lib/web-audio-engine";

interface AudioPlaybackRuntime {
  adapter: AudioPlaybackAdapter;
  controls: AudioPlaybackContract;
}

function useAudioPlaybackRuntime({
  activeInstanceId,
  durationMicros,
}: {
  activeInstanceId: string | null;
  durationMicros: number;
}): AudioPlaybackRuntime {
  const sourcePath = useAppSelector(selectSourceSelection)?.sourcePath ?? null;
  const media = useAppSelector(selectSourceMedia);
  const audioTracks = useAppSelector(selectAudioTracks);
  const playbackVolumePercent = useAppSelector(selectPlaybackVolumePercent);
  const sessionRef = useRef<AudioPlaybackSession | null>(null);
  const audioMeterRef = useRef<AudioPlaybackContract["audioMeterRef"]["current"]>(null);

  const enabledTracks = useMemo(() => audioTracks.filter((track) => track.enabled), [audioTracks]);
  const webAudioTracks: WebAudioTrack[] = useMemo(
    () =>
      enabledTracks.flatMap((track) => {
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
            streamIndex: track.streamIndex,
          },
        ];
      }),
    [enabledTracks],
  );

  useEffect(() => {
    if (!sourcePath || !media || typeof AudioContext === "undefined") return;
    const session = new AudioPlaybackSession(sourcePath);
    sessionRef.current = session;
    audioMeterRef.current = session.meter;

    return () => {
      if (sessionRef.current === session) sessionRef.current = null;
      audioMeterRef.current = null;
      session.close();
    };
  }, [activeInstanceId, media, sourcePath]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.setDuration(durationMicros);
    session.setTracks(webAudioTracks);
  }, [activeInstanceId, durationMicros, media, sourcePath, webAudioTracks]);

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

  const startAt = useCallback(
    (seconds: number) => sessionRef.current?.startAt(seconds) ?? Promise.resolve(),
    [],
  );

  const seek = useCallback((seconds: number) => sessionRef.current?.seek(seconds), []);

  const setPlaybackRate = useCallback((rate: number) => {
    sessionRef.current?.setPlaybackRate(rate);
  }, []);

  const resume = useCallback(() => sessionRef.current?.resume() ?? Promise.resolve(), []);

  const getCurrentTimeSeconds = useCallback(() => {
    const session = sessionRef.current;
    return session?.hasTracks ? session.currentTimeSeconds : null;
  }, []);

  const setLiveAudioTrackGain = useCallback((streamIndex: number, gainDb: number) => {
    sessionRef.current?.setTrackGain(streamIndex, gainDb);
  }, []);

  const clearLiveAudioTrackGain = useCallback(
    (streamIndex: number) => {
      const track = audioTracks.find((candidate) => candidate.streamIndex === streamIndex);
      if (track)
        sessionRef.current?.setTrackGain(streamIndex, effectiveAudioTrackGainDb(track.processing));
    },
    [audioTracks],
  );

  const requiresLoudnessAnalysis = enabledTracks.some(
    (track) =>
      track.processing.loudnessNormalization !== undefined &&
      track.loudnessAnalysis.status !== "ready",
  );

  const isReady = !requiresLoudnessAnalysis && sourcePath !== null && media !== null;
  const hasActiveOutput = enabledTracks.length > 0 && typeof AudioContext !== "undefined";

  const adapter = useMemo<AudioPlaybackAdapter>(
    () => ({
      getCurrentTimeSeconds,
      hasActiveOutput,
      isReady,
      pause,
      resume,
      seek,
      setPlaybackRate,
      startAt,
    }),
    [
      getCurrentTimeSeconds,
      hasActiveOutput,
      isReady,
      pause,
      resume,
      seek,
      setPlaybackRate,
      startAt,
    ],
  );

  const controls = useMemo<AudioPlaybackContract>(
    () => ({ audioMeterRef, clearLiveAudioTrackGain, setLiveAudioTrackGain }),
    [clearLiveAudioTrackGain, setLiveAudioTrackGain],
  );

  return { adapter, controls };
}

export { useAudioPlaybackRuntime };
