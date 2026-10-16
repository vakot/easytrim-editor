import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  audioFilterPreviewPlaybackReported,
  type AudioFilterPreviewState,
  type AudioTrackState,
  selectAudioFilterPreview,
  selectAudioTracks,
} from "@/app/store/slices/audio-slice";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectPlaybackVolumePercent } from "@/app/store/slices/preferences-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import type { MediaInfo } from "@/domain/media";
import { releaseAudioPlaybackPreview } from "@/lib/tauri/media";

import type { AudioPlaybackAdapter } from "../contexts/audio-transport-context";
import { AudioPlaybackSession } from "../lib/audio-playback-session";
import { type AudioPlaybackChain, resolveAudioPlaybackTracks } from "../lib/audio-playback-tracks";
import type { WebAudioTrack } from "../lib/web-audio-engine";

const NO_CHAINS = new Map<number, AudioPlaybackChain>();

/**
 * Resolves playback processing against the previous resolution for the same media, so a track
 * can keep the audio it plays while its next chain is measured.
 */
function useResolvedAudioPlaybackTracks(
  tracks: AudioTrackState[],
  media: MediaInfo | null,
  preview: AudioFilterPreviewState | null,
) {
  const [resolved, setResolved] = useState(() => ({
    media,
    playback: resolveAudioPlaybackTracks(tracks, media?.audioStreams ?? [], preview, NO_CHAINS),
    preview,
    tracks,
  }));

  if (resolved.tracks === tracks && resolved.media === media && resolved.preview === preview) {
    return resolved.playback;
  }
  const playback = resolveAudioPlaybackTracks(
    tracks,
    media?.audioStreams ?? [],
    preview,
    resolved.media === media ? resolved.playback.chains : NO_CHAINS,
  );

  setResolved({ media, playback, preview, tracks });
  return playback;
}

/** Releases a stream's native preview, keeping the processing it now plays. */
function releasePreview(sourcePath: string, streamIndex: number, tracks: WebAudioTrack[]) {
  const kept = tracks.find((track) => track.streamIndex === streamIndex)?.selection;
  void releaseAudioPlaybackPreview(sourcePath, streamIndex, kept).catch(() => undefined);
}

function useAudioPlaybackRuntime(): AudioPlaybackAdapter {
  const dispatch = useAppDispatch();
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const sourcePath = useAppSelector(selectSourceSelection)?.sourcePath ?? null;
  const media = useAppSelector(selectSourceMedia);
  const audioTracks = useAppSelector(selectAudioTracks);
  const preview = useAppSelector(selectAudioFilterPreview);
  const playbackVolumePercent = useAppSelector(selectPlaybackVolumePercent);
  const sessionRef = useRef<AudioPlaybackSession | null>(null);
  const webAudioTracksRef = useRef<WebAudioTrack[]>([]);
  /** Streams playing preview audio, whose native preview is released once they stop. */
  const previewStreamsRef = useRef(new Set<number>());
  /** Streams that stopped auditioning drafts but may still play preview audio until they switch. */
  const releasingStreamsRef = useRef(new Set<number>());
  const previewRef = useRef(preview);
  const playbackErrorObserverRef = useRef<(() => void) | null>(null);
  const playbackRateRef = useRef(1);
  const playbackVolumePercentRef = useRef(playbackVolumePercent);

  const enabledTracks = useMemo(() => audioTracks.filter((track) => track.enabled), [audioTracks]);
  const playback = useResolvedAudioPlaybackTracks(enabledTracks, media, preview);
  const webAudioTracks = playback.tracks;

  useEffect(() => {
    if (!sourcePath || !media || typeof AudioContext === "undefined") return;
    const session = new AudioPlaybackSession(sourcePath, (streamIndex, revision, status) => {
      // Preview audio keeps playing until the committed processing replaces it; release it then.
      if (
        revision === undefined &&
        status !== "updating" &&
        releasingStreamsRef.current.delete(streamIndex)
      ) {
        releasePreview(sourcePath, streamIndex, webAudioTracksRef.current);
      }
      const current = previewRef.current;
      if (current?.streamIndex !== streamIndex || revision === undefined) return;
      dispatch(audioFilterPreviewPlaybackReported({ id: current.id, revision, status }));
    });

    sessionRef.current = session;
    previewStreamsRef.current = new Set();
    releasingStreamsRef.current = new Set();
    session.setPlaybackRate(playbackRateRef.current);
    const unregisterPlaybackErrorObserver = session.registerPlaybackErrorObserver(() => {
      playbackErrorObserverRef.current?.();
    });

    return () => {
      if (sessionRef.current === session) sessionRef.current = null;
      unregisterPlaybackErrorObserver();
      session.close();
    };
  }, [activeInstanceId, dispatch, media, sourcePath]);

  useEffect(() => {
    webAudioTracksRef.current = webAudioTracks;
    previewRef.current = preview;
    const session = sessionRef.current;

    // Native preview audio and sessions are released once a stream stops auditioning drafts and
    // its audible processing is no longer a draft; the processing it continues with is kept, so an
    // applied draft is not rendered again.
    const previewStreams = new Set(
      webAudioTracks.filter((track) => track.preview).map((track) => track.streamIndex),
    );

    for (const streamIndex of previewStreamsRef.current) {
      if (previewStreams.has(streamIndex)) continue;
      const playing = webAudioTracks.some((track) => track.streamIndex === streamIndex);
      if (session && playing) releasingStreamsRef.current.add(streamIndex);
      else if (sourcePath) releasePreview(sourcePath, streamIndex, webAudioTracks);
    }
    for (const streamIndex of previewStreams) releasingStreamsRef.current.delete(streamIndex);
    previewStreamsRef.current = previewStreams;

    if (session) {
      session.setDuration(media?.durationMicros ?? 0);
      session.setTracks(webAudioTracks);
    }

    // A preview that playback is not rendering has nothing to prepare.
    if (
      preview &&
      (!session || !webAudioTracks.some((track) => track.streamIndex === preview.streamIndex))
    ) {
      dispatch(
        audioFilterPreviewPlaybackReported({
          id: preview.id,
          revision: preview.revision,
          status: "ready",
        }),
      );
    }
  }, [activeInstanceId, dispatch, media, playback, preview, sourcePath, webAudioTracks]);

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

  const isReady = playback.ready && sourcePath !== null && media !== null;
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
