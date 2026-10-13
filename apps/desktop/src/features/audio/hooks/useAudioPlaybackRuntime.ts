import { type RefObject, useCallback, useEffect, useMemo, useRef } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectPlaybackVolumePercent } from "@/app/store/slices/preferences-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import {
  audioTrackPlaybackProcessing,
  type AudioTrackSelection,
  effectiveAudioTrackGainDb,
  getAudioTrackSignalEffect,
} from "@/domain/audio-processing";
import { decodeAudioPlaybackChunk } from "@/lib/tauri/media";

import type { StereoAudioMeterNodes } from "../lib/stereo-audio-meter";
import { WebAudioEngine, type WebAudioTrack } from "../lib/web-audio-engine";

function useAudioPlaybackRuntime({
  activeInstanceId,
  durationMicros,
  videoRef,
}: {
  activeInstanceId: string | null;
  durationMicros: number;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const sourcePath = useAppSelector(selectSourceSelection)?.sourcePath ?? null;
  const media = useAppSelector(selectSourceMedia);
  const audioTracks = useAppSelector(selectAudioTracks);
  const playbackVolumePercent = useAppSelector(selectPlaybackVolumePercent);
  const engineRef = useRef<WebAudioEngine | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioMeterRef = useRef<StereoAudioMeterNodes | null>(null);
  const lastVideoSyncAtRef = useRef(0);

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
          processing: audioTrackPlaybackProcessing(track.processing),
          streamIndex: track.streamIndex,
        };

        return [
          {
            gainDb: effectiveAudioTrackGainDb(track.processing),
            limiterProcessing:
              track.processing.loudnessNormalization === undefined
                ? getAudioTrackSignalEffect(track.processing, "limiter")
                : undefined,
            selection,
            streamIndex: track.streamIndex,
          },
        ];
      }),
    [enabledTracks],
  );

  useEffect(() => {
    if (!sourcePath || !media || typeof AudioContext === "undefined") return;
    const context = new AudioContext();
    const engine = new WebAudioEngine(
      context,
      (selection, startMicros, chunkDurationMicros, signal) =>
        decodeAudioPlaybackChunk(
          sourcePath,
          selection,
          startMicros,
          chunkDurationMicros,
          signal,
        ),
      () => undefined,
    );

    engineRef.current = engine;
    audioContextRef.current = context;
    audioMeterRef.current = engine.meter;

    return () => {
      if (engineRef.current === engine) engineRef.current = null;
      if (audioContextRef.current === context) audioContextRef.current = null;
      audioMeterRef.current = null;
      engine.close();
      void context.close().catch(() => undefined);
    };
  }, [activeInstanceId, media, sourcePath]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setDuration(durationMicros);
    engine.setTracks(webAudioTracks);
  }, [activeInstanceId, durationMicros, media, sourcePath, webAudioTracks]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setOutputGain(playbackVolumePercent / 100);
  }, [activeInstanceId, media, playbackVolumePercent, sourcePath]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setMono(
      webAudioTracks.length > 0 &&
        webAudioTracks.every(
          (track) =>
            media?.audioStreams.find((stream) => stream.streamIndex === track.streamIndex)
              ?.channels === 1,
        ),
    );
  }, [activeInstanceId, media, sourcePath, webAudioTracks]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = enabledTracks.length > 0;
    return () => {
      video.muted = false;
    };
  }, [enabledTracks.length, videoRef]);

  const pause = useCallback(() => engineRef.current?.pause(), []);

  const startAt = useCallback((seconds: number) => {
    const engine = engineRef.current;
    return engine ? engine.startAt(seconds) : Promise.resolve();
  }, []);

  const syncTo = useCallback((seconds: number, force = false) => {
    if (force) {
      engineRef.current?.seek(seconds);
      return;
    }
    const video = videoRef.current;
    if (!video || video.paused || video.ended) return;
    const now = performance.now();
    if (now - lastVideoSyncAtRef.current < 500) return;
    lastVideoSyncAtRef.current = now;
    if (Math.abs(video.currentTime - seconds) > 0.12) video.currentTime = seconds;
  }, [videoRef]);

  const setPlaybackRate = useCallback((rate: number) => {
    engineRef.current?.setPlaybackRate(rate);
  }, []);

  const resumeAudioContext = useCallback(
    () => audioContextRef.current?.resume() ?? Promise.resolve(),
    [],
  );

  const getCurrentTimeSeconds = useCallback(() => {
    const engine = engineRef.current;
    return engine?.hasTracks ? engine.currentTimeSeconds : null;
  }, []);

  const requestPlaybackFrame = useCallback(
    (callback: (timestamp: number, mediaTimeSeconds: number) => void) => {
      if (!engineRef.current?.hasTracks) return null;
      const frame = window.requestAnimationFrame((timestamp) => {
        callback(timestamp, engineRef.current?.currentTimeSeconds ?? 0);
      });

      return { cancel: () => window.cancelAnimationFrame(frame) };
    },
    [],
  );

  const setLiveAudioTrackGain = useCallback((streamIndex: number, gainDb: number) => {
    engineRef.current?.setTrackGain(streamIndex, gainDb);
  }, []);

  const clearLiveAudioTrackGain = useCallback(
    (streamIndex: number) => {
      const track = audioTracks.find((candidate) => candidate.streamIndex === streamIndex);
      if (track) engineRef.current?.setTrackGain(streamIndex, effectiveAudioTrackGainDb(track.processing));
    },
    [audioTracks],
  );

  const requiresLoudnessAnalysis = enabledTracks.some(
    (track) =>
      track.processing.loudnessNormalization !== undefined &&
      track.loudnessAnalysis.status !== "ready",
  );

  const isReady = !requiresLoudnessAnalysis && sourcePath !== null && media !== null;

  return {
    audioMeterRef,
    clearLiveAudioTrackGain,
    getCurrentTimeSeconds,
    isReady,
    pause,
    requestPlaybackFrame,
    resumeAudioContext,
    setLiveAudioTrackGain,
    setPlaybackRate,
    startAt,
    syncTo,
    usesWebAudio: enabledTracks.length > 0 && typeof AudioContext !== "undefined",
  };
}

export { useAudioPlaybackRuntime };
