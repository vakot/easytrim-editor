import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { audioTrackPlaybackPreviewUrl, selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import {
  selectLoopPlaybackEnabled,
  selectSegmentPlaybackEnabled,
} from "@/app/store/slices/editor-tools-slice";
import { selectPlaybackSpeed } from "@/app/store/slices/playback-controls-slice";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim, trimChanged } from "@/app/store/slices/trim-slice";
import {
  commitActiveEditingInstanceDraft,
  handlePreviewPlaybackError as handlePreviewPlaybackErrorRequested,
} from "@/app/store/thunks/source-media-thunks";
import {
  audioTrackExternalPreviewStreamIndexes,
  effectiveAudioTrackGainDb,
} from "@/domain/audio-processing";
import { clampPlaybackMicros, frameDurationMicros } from "@/domain/playback";
import {
  canSetTrimBoundaryAtPlayhead,
  setTrimBoundaryAtPlayhead,
  type TrimBoundary,
  type TrimRange,
} from "@/domain/trim";
import {
  connectNativeAudioBinding,
  createStereoAudioMeterNodes,
  disconnectNativeAudioBinding,
  disconnectStereoAudioMeterNodes,
  getOrCreateNativeAudioBinding,
  isMonoAudioMix,
  type NativeAudioBinding,
  type StereoAudioMeterNodes,
  synchronizeAudioPosition,
} from "@/features/audio";
import {
  cancelPlaybackFrame,
  createSeekScheduler,
  type PlaybackFrameHandle,
  requestPlaybackFrame,
} from "@/features/preview";
import {
  cancelFrame,
  FRAME_SHUTTLE_PLAYBACK_RATE,
  type FrameShuttleDirection,
  syncPlayheadElements,
  useEditorTimelineShortcuts,
  useTimelineEditingCommands,
} from "@/features/timeline";
import { diagnostics } from "@/lib/diagnostics";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";

import {
  cancelPlaybackFrame,
  type PlaybackFrameHandle,
  requestPlaybackFrame,
} from "../lib/media-sync";
import { createSeekScheduler } from "../lib/seek-scheduler";

import { usePlaybackModes } from "./usePlaybackModes";

const EMPTY_TRIM: TrimRange = {
  startMicros: 0,
  endMicros: 0,
  sourceDurationMicros: 0,
};

const AUDIO_SYNC_INTERVAL_MS = 100;
const REVERSE_SHUTTLE_SEEK_INTERVAL_MS = 50;
const SHUTTLE_MAX_FRAME_DELTA_MS = 100;

function usePreviewPlaybackRuntime() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const loopPlaybackEnabled = useAppSelector(selectLoopPlaybackEnabled);
  const segmentPlaybackEnabled = useAppSelector(selectSegmentPlaybackEnabled);
  const playbackSpeed = useAppSelector(selectPlaybackSpeed);
  const sourceSelection = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const trim = useAppSelector(selectTrim) ?? EMPTY_TRIM;
  const preview = useAppSelector(selectPreview);
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;
  const audioTracks = useAppSelector(selectAudioTracks);
  const routeNativeAudioStreamIndex =
    media?.audioStreams.find((stream) => stream.isDefault)?.streamIndex ??
    media?.audioStreams[0]?.streamIndex;

  const externalPreviewStreamIndexes = useMemo(
    () => new Set(audioTrackExternalPreviewStreamIndexes(audioTracks, routeNativeAudioStreamIndex)),
    [audioTracks, routeNativeAudioStreamIndex],
  );

  const audioPreviewUrls = useMemo(
    () =>
      Object.fromEntries(
        audioTracks.flatMap((track) => {
          const url = audioTrackPlaybackPreviewUrl(
            track,
            externalPreviewStreamIndexes.has(track.streamIndex),
          );

          return url ? [[track.streamIndex, url]] : [];
        }),
      ),
    [audioTracks, externalPreviewStreamIndexes],
  );

  const sourcePath = sourceSelection?.sourcePath ?? null;
  const previewKey =
    sourcePath && preview.status === "ready" ? `${sourcePath}:${preview.value.url}` : null;

  const [playheadMicros, setPlayheadMicros] = useState(trim.startMicros);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuttleDirection, setShuttleDirection] = useState<FrameShuttleDirection | 0>(0);
  const [transportError, setTransportError] = useState<string | null>(null);
  const [readyPreviewKey, setReadyPreviewKey] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const setVideoElement = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
  }, []);

  const seekSchedulerRef = useRef<ReturnType<typeof createSeekScheduler> | null>(null);
  const playheadRef = useRef<HTMLButtonElement>(null);

  const playbackFrameRef = useRef<PlaybackFrameHandle | null>(null);
  const reverseShuttleFrameRef = useRef<number | null>(null);
  const reverseShuttleLastFrameAtRef = useRef<number | null>(null);
  const reverseShuttleLastSeekAtRef = useRef(0);
  const scrubFrameRef = useRef<number | null>(null);
  const pendingScrubMicrosRef = useRef<number | null>(null);
  const frameStepSeekFrameRef = useRef<number | null>(null);
  const pendingFrameStepSeekMicrosRef = useRef<number | null>(null);
  const resumeAfterScrubRef = useRef(false);
  const timelineInteractionActiveRef = useRef(false);
  const playbackStartSequenceRef = useRef(0);
  const playbackRequestedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const shuttleDirectionRef = useRef<FrameShuttleDirection | 0>(0);
  const resumeAfterCropRef = useRef(false);
  const lastPlaybackCommitAtRef = useRef(0);
  const lastScrubCommitAtRef = useRef(-Infinity);
  const trimInteractionActiveRef = useRef(false);
  const lastAudioSyncAtRef = useRef(0);
  const trimRef = useRef(trim);
  const currentPlayheadMicrosRef = useRef(trim.startMicros);
  const activePlaybackRate = shuttleDirection === 1 ? FRAME_SHUTTLE_PLAYBACK_RATE : playbackSpeed;
  const audioPlayback = useAudioPlaybackRuntime({
    activeInstanceId,
    isPreviewReady: previewKey !== null && readyPreviewKey === previewKey,
    playbackRate: activePlaybackRate,
    previewKey,
    videoRef,
  });

  const {
    audioMeterRef,
    audioPlayheadRef,
    clearLiveAudioTrackGain,
    isReady: isAudioReady,
    pause: pauseAudioPlayback,
    resumeAt: resumeAudioAt,
    resumeAudioContext,
    setPlaybackRate: setAudioPlaybackRate,
    startAt: startAudioAt,
    syncTo: syncAudioPlayback,
    usesExternalAudio,
  } = audioPlayback;

  const isPlaybackReady = previewKey !== null && readyPreviewKey === previewKey && isAudioReady;

  const isPlaybackReadyRef = useRef(isPlaybackReady);
  const nativeLoopEnabled =
    isPlaybackReady &&
    shuttleDirection === 0 &&
    loopPlaybackEnabled &&
    !segmentPlaybackEnabled &&
    !usesExternalAudio;

  const nativeLoopEnabledRef = useRef(nativeLoopEnabled);
  useEffect(() => {
    trimRef.current = trim;
    if (currentPlayheadMicrosRef.current > trim.sourceDurationMicros) {
      currentPlayheadMicrosRef.current = trim.sourceDurationMicros;
      setPlayheadMicros(trim.sourceDurationMicros);
    }
  }, [trim]);

  useEffect(() => {
    isPlaybackReadyRef.current = isPlaybackReady;
    nativeLoopEnabledRef.current = nativeLoopEnabled;
  }, [isPlaybackReady, nativeLoopEnabled]);

  const playbackModes = usePlaybackModes({
    loopEnabled: loopPlaybackEnabled,
    segmentEnabled: segmentPlaybackEnabled,
  });

  const displayedPlayheadMicros = clampPlaybackMicros(playheadMicros, trim.sourceDurationMicros);

  useEffect(() => {
    playbackStartSequenceRef.current += 1;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    videoRef.current?.pause();
    pauseAudioPlayback();
    cancelPlaybackFrame(playbackFrameRef);
    cancelFrame(reverseShuttleFrameRef);
    cancelFrame(scrubFrameRef);
    cancelFrame(frameStepSeekFrameRef);
    pendingScrubMicrosRef.current = null;
    pendingFrameStepSeekMicrosRef.current = null;
    timelineInteractionActiveRef.current = false;
    trimInteractionActiveRef.current = false;
    resumeAfterScrubRef.current = false;
    seekSchedulerRef.current?.dispose();
    seekSchedulerRef.current = null;
    shuttleDirectionRef.current = 0;
    // Source replacement is an explicit transport reset, not persisted editor state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShuttleDirection(0);
    setIsPlaying(false);
    setTransportError(null);
    // Snapshot activation restores the selected segment, so preview should begin at its boundary.
    currentPlayheadMicrosRef.current = trimRef.current.startMicros;
    setPlayheadMicros(trimRef.current.startMicros);
  }, [activeInstanceId, pauseAudioPlayback, previewKey, sourcePath]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = activePlaybackRate;
    for (const audio of audioElementsRef.current.values()) audio.playbackRate = activePlaybackRate;
  }, [audioPreviewUrls, playbackSpeed, shuttleDirection]);

  useEffect(() => {
    if (!sourcePath || audioTracks.length === 0 || typeof AudioContext === "undefined") {
      cleanupAudioRuntime();
      cleanupStaleNativeAudioBindings(videoRef.current);
      return;
    }
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    let audioMix = audioMixRef.current;
    if (!audioMix) {
      audioMix = context.createGain();
      audioMixRef.current = audioMix;
      const playbackOutputGain = context.createGain();
      playbackOutputGainRef.current = playbackOutputGain;
      audioMeterRef.current = createStereoAudioMeterNodes(context, audioMix);
      audioMix.connect(playbackOutputGain);
      playbackOutputGain.connect(context.destination);
    }

    const activeExternalAudioUrls = usesExternalAudio
      ? Object.fromEntries(
          Object.entries(audioPreviewUrls).filter(([streamIndexText]) =>
            enabledAudioTracks.some((track) => track.streamIndex === Number(streamIndexText)),
          ),
        )
      : {};

    const activeStreamIndexes = new Set(Object.keys(activeExternalAudioUrls).map(Number));
    for (const streamIndex of audioElementsRef.current.keys()) {
      if (!activeStreamIndexes.has(streamIndex)) removeAudioRuntime(streamIndex);
    }
    for (const [streamIndexText, url] of Object.entries(activeExternalAudioUrls)) {
      const streamIndex = Number(streamIndexText);
      const existingElement = audioElementsRef.current.get(streamIndex);
      if (existingElement?.src === url) continue;
      if (existingElement) removeAudioRuntime(streamIndex);
      const element = new Audio();
      element.crossOrigin = "anonymous";
      element.src = url;
      element.preload = "auto";
      element.playbackRate = playbackSpeed;
      element.setAttribute("aria-hidden", "true");
      element.style.display = "none";
      const markReady = () => {
        setAudioReadiness((current) => {
          const previewUrls =
            current.sourcePath === sourcePath
              ? new Map(current.previewUrls)
              : new Map<number, string>();

          if (previewUrls.get(streamIndex) === url) return current;
          previewUrls.set(streamIndex, url);
          return { sourcePath, previewUrls };
        });
      };

      element.addEventListener("canplay", markReady, { once: true });
      audioReadyListenersRef.current.set(streamIndex, markReady);
      document.body.appendChild(element);
      const audioSource = context.createMediaElementSource(element);
      const gain = context.createGain();
      const track = audioTracks.find((candidate) => candidate.streamIndex === streamIndex);
      const gainDb = track
        ? track.processing.loudnessNormalization === undefined
          ? (liveAudioTrackGainsRef.current.get(streamIndex) ?? track.processing.gainDb)
          : effectiveAudioTrackGainDb(track.processing)
        : 0;

      setGainNodeFromDb(gain, track?.enabled === false ? Number.NEGATIVE_INFINITY : gainDb);
      audioSource.connect(gain).connect(audioMix);
      audioElementsRef.current.set(streamIndex, element);
      audioNodesRef.current.set(streamIndex, { source: audioSource, gain });
      if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) markReady();
    }

    const video = videoRef.current;
    cleanupStaleNativeAudioBindings(video);
    if (!video || requiresProcessedPreview) {
      disconnectCurrentNativeAudioRoute();
    } else {
      const binding = getOrCreateNativeAudioBinding(nativeAudioBindingsRef.current, context, video);
      connectNativeAudioBinding(binding, audioMix);
      nativeAudioBindingRef.current = { element: video, binding };
    }
  }, [
    audioPreviewUrls,
    audioTracks,
    enabledAudioTracks,
    cleanupAudioRuntime,
    cleanupStaleNativeAudioBindings,
    disconnectCurrentNativeAudioRoute,
    readyPreviewKey,
    removeAudioRuntime,
    sourcePath,
    playbackSpeed,
    requiresProcessedPreview,
    usesExternalAudio,
  ]);

  useEffect(() => {
    const meter = audioMeterRef.current;
    if (!meter) return;

    const audioStreams = media?.audioStreams ?? [];
    meter.isMono = isMonoAudioMix(
      audioTracks
        .filter((track) => track.enabled)
        .map(
          (track) =>
            audioStreams.find((stream) => stream.streamIndex === track.streamIndex)?.channels,
        ),
    );
  }, [audioTracks, media?.audioStreams]);

  useEffect(() => {
    const playbackOutputGain = playbackOutputGainRef.current;
    if (playbackOutputGain && audioContextRef.current) {
      const context = audioContextRef.current;
      const now = context.currentTime;
      const gain = playbackOutputGain.gain;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(playbackVolumePercent / 100, now + 0.025);
    }
    for (const track of audioTracks) {
      const node = audioNodesRef.current.get(track.streamIndex);
      if (node) {
        const gainDb =
          track.processing.loudnessNormalization === undefined
            ? (liveAudioTrackGainsRef.current.get(track.streamIndex) ?? track.processing.gainDb)
            : effectiveAudioTrackGainDb(track.processing);

        node.gain.gain.value = track.enabled ? 10 ** (gainDb / 20) : 0;
      }
    }
    if (nativeAudioBindingRef.current) {
      const gainDb = nativeAudioTrack
        ? nativeAudioTrack.processing.loudnessNormalization === undefined
          ? (liveAudioTrackGainsRef.current.get(nativeAudioTrack.streamIndex) ??
            nativeAudioTrack.processing.gainDb)
          : effectiveAudioTrackGainDb(nativeAudioTrack.processing)
        : 0;

      nativeAudioBindingRef.current.binding.gain.gain.value =
        nativeAudioTrack?.enabled && !requiresProcessedPreview ? 10 ** (gainDb / 20) : 0;
    } else if (videoRef.current) {
      const gainDb = nativeAudioTrack
        ? nativeAudioTrack.processing.loudnessNormalization === undefined
          ? (liveAudioTrackGainsRef.current.get(nativeAudioTrack.streamIndex) ??
            nativeAudioTrack.processing.gainDb)
          : effectiveAudioTrackGainDb(nativeAudioTrack.processing)
        : 0;

      const trackGain =
        nativeAudioTrack?.enabled && !requiresProcessedPreview ? 10 ** (gainDb / 20) : 0;

      const combinedGain = (playbackVolumePercent / 100) * trackGain;

      videoRef.current.volume = Math.min(1, combinedGain);
    }
  }, [
    audioPreviewUrls,
    audioTracks,
    nativeAudioTrack,
    playbackVolumePercent,
    readyPreviewKey,
    requiresProcessedPreview,
  ]);

  const stopPlayheadAnimation = useCallback(() => cancelPlaybackFrame(playbackFrameRef), []);
  const handlePlaybackStartFailure = useCallback(() => {
    playbackStartSequenceRef.current += 1;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    shuttleDirectionRef.current = 0;
    cancelFrame(reverseShuttleFrameRef);
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.playbackRate = playbackSpeed;
    }
    setAudioPlaybackRate(playbackSpeed);
    pauseAudioPlayback();
    setIsPlaying(false);
    setShuttleDirection(0);
    stopPlayheadAnimation();
    setTransportError(t("preview.messages.playbackFailed"));
  }, [
    pauseAudioPlayback,
    setAudioPlaybackRate,
    playbackSpeed,
    setIsPlaying,
    setShuttleDirection,
    setTransportError,
    stopPlayheadAnimation,
    t,
  ]);

  const resumeExternalAudioPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.paused) return;

    const startSequence = playbackStartSequenceRef.current;
    const seconds = video.currentTime;
    void resumeAudioAt(seconds).catch(() => {
      if (startSequence !== playbackStartSequenceRef.current) return;
      handlePlaybackStartFailure();
    });
  }, [handlePlaybackStartFailure, resumeAudioAt]);

  useEffect(() => {
    if (!usesExternalAudio || !isPlaybackReady || !isPlayingRef.current) return;
    resumeExternalAudioPlayback();
  }, [isPlaybackReady, resumeExternalAudioPlayback, usesExternalAudio]);

  const scheduleVideoSeek = useCallback(
    (micros: number, approximate: boolean, onSettled?: () => void) => {
      const video = videoRef.current;
      if (!video) return;
      if (seekSchedulerRef.current?.video !== video) {
        seekSchedulerRef.current?.dispose();
        seekSchedulerRef.current = createSeekScheduler(video);
      }
      seekSchedulerRef.current.seek(micros / 1_000_000, approximate, onSettled);
    },
    [],
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
              syncAudioPlayback(micros / 1_000_000, true);
              if (isPlayingRef.current) resumeExternalAudioPlayback();
            },
      );
    },
    [pauseAudioPlayback, resumeExternalAudioPlayback, scheduleVideoSeek, syncAudioPlayback],
  );

  const flushFrameStepSeek = useCallback(() => {
    cancelFrame(frameStepSeekFrameRef);
    const pendingMicros = pendingFrameStepSeekMicrosRef.current;
    pendingFrameStepSeekMicrosRef.current = null;
    if (pendingMicros !== null) applyMediaSeek(pendingMicros);
  }, [applyMediaSeek]);

  const queueFrameStepSeek = useCallback(
    (micros: number) => {
      const clamped = clampPlaybackMicros(micros, trimRef.current.sourceDurationMicros);
      currentPlayheadMicrosRef.current = clamped;
      syncPlayheadElements(
        playheadRef.current,
        audioPlayheadRef.current,
        clamped,
        trimRef.current.sourceDurationMicros,
      );
      setPlayheadMicros(clamped);

      if (!seekSchedulerRef.current?.isPending && frameStepSeekFrameRef.current === null) {
        applyMediaSeek(clamped);
        return;
      }
      pendingFrameStepSeekMicrosRef.current = clamped;
      if (frameStepSeekFrameRef.current !== null) return;
      frameStepSeekFrameRef.current = requestAnimationFrame(() => {
        frameStepSeekFrameRef.current = null;
        const pendingMicros = pendingFrameStepSeekMicrosRef.current;
        pendingFrameStepSeekMicrosRef.current = null;
        if (pendingMicros !== null) applyMediaSeek(pendingMicros);
      });
    },
    [applyMediaSeek, audioPlayheadRef, setPlayheadMicros],
  );

  const commitSeek = useCallback(
    (micros: number, seekMedia = true, publish = true) => {
      flushFrameStepSeek();
      const clamped = clampPlaybackMicros(micros, trimRef.current.sourceDurationMicros);
      currentPlayheadMicrosRef.current = clamped;
      syncPlayheadElements(
        playheadRef.current,
        audioPlayheadRef.current,
        clamped,
        trimRef.current.sourceDurationMicros,
      );
      if (publish) setPlayheadMicros(clamped);
      if (seekMedia) applyMediaSeek(clamped);
    },
    [applyMediaSeek, audioPlayheadRef, flushFrameStepSeek, setPlayheadMicros],
  );

  const startMediaPlayback = useCallback(() => {
    flushFrameStepSeek();
    const video = videoRef.current;
    if (!video || !isPlaybackReadyRef.current) return;
    const startMicros = currentPlayheadMicrosRef.current;
    const startSequence = ++playbackStartSequenceRef.current;
    playbackRequestedRef.current = true;
    setTransportError(null);
    void resumeAudioContext().catch(() => {
      if (startSequence !== playbackStartSequenceRef.current) return;
      handlePlaybackStartFailure();
    });
    scheduleVideoSeek(startMicros, false, () => {
      if (startSequence !== playbackStartSequenceRef.current) return;
      void Promise.all([video.play(), startAudioAt(startMicros / 1_000_000)]).catch(() => {
        if (startSequence !== playbackStartSequenceRef.current) return;
        handlePlaybackStartFailure();
      });
    });
  }, [
    flushFrameStepSeek,
    handlePlaybackStartFailure,
    resumeAudioContext,
    startAudioAt,
    scheduleVideoSeek,
    setTransportError,
  ]);

  const handlePlaybackBoundary = useCallback(
    (currentMicros: number): boolean => {
      if (shuttleDirectionRef.current !== 0) return false;
      const boundary = playbackModes.consumeBoundary(currentMicros, trimRef.current);
      if (!boundary.reached) return false;
      if (!boundary.action) return true;
      if (boundary.action.type === "restart") {
        commitSeek(boundary.action.positionMicros);
        if (videoRef.current?.paused) startMediaPlayback();
        return true;
      }
      playbackStartSequenceRef.current += 1;
      playbackRequestedRef.current = false;
      isPlayingRef.current = false;
      videoRef.current?.pause();
      pauseAudioPlayback();
      setIsPlaying(false);
      stopPlayheadAnimation();
      commitSeek(boundary.action.positionMicros);
      return true;
    },
    [
      commitSeek,
      pauseAudioPlayback,
      playbackModes,
      setIsPlaying,
      startMediaPlayback,
      stopPlayheadAnimation,
    ],
  );

  const startPlayheadAnimation = useCallback(() => {
    stopPlayheadAnimation();
    const update = (timestamp: number, mediaTimeSeconds: number) => {
      const video = videoRef.current;
      if (!video || video.paused) {
        playbackFrameRef.current = null;
        return;
      }
      if (seekSchedulerRef.current?.isPending || video.seeking) {
        playbackFrameRef.current = requestPlaybackFrame(video, update);
        return;
      }
      const currentMicros = clampPlaybackMicros(
        mediaTimeSeconds * 1_000_000,
        trimRef.current.sourceDurationMicros,
      );

      currentPlayheadMicrosRef.current = currentMicros;
      syncPlayheadElements(
        playheadRef.current,
        audioPlayheadRef.current,
        currentMicros,
        trimRef.current.sourceDurationMicros,
      );
      if (timestamp - lastPlaybackCommitAtRef.current >= 100) {
        lastPlaybackCommitAtRef.current = timestamp;
        setPlayheadMicros(currentMicros);
      }
      if (timestamp - lastAudioSyncAtRef.current >= AUDIO_SYNC_INTERVAL_MS) {
        lastAudioSyncAtRef.current = timestamp;
        syncAudioPlayback(mediaTimeSeconds);
      }
      if (!nativeLoopEnabledRef.current && handlePlaybackBoundary(currentMicros)) {
        playbackFrameRef.current = video.paused ? null : requestPlaybackFrame(video, update);
        return;
      }
      playbackFrameRef.current = requestPlaybackFrame(video, update);
    };

    const video = videoRef.current;
    if (video) playbackFrameRef.current = requestPlaybackFrame(video, update);
  }, [audioPlayheadRef, handlePlaybackBoundary, stopPlayheadAnimation, syncAudioPlayback]);

  useEffect(() => {
    return () => {
      playbackStartSequenceRef.current += 1;
      cancelPlaybackFrame(playbackFrameRef);
      cancelFrame(reverseShuttleFrameRef);
      cancelFrame(scrubFrameRef);
      pendingFrameStepSeekMicrosRef.current = null;
      seekSchedulerRef.current?.dispose();
      seekSchedulerRef.current = null;
    };
  }, []);

  const setMediaPlaybackRate = useCallback(
    (rate: number) => {
      if (videoRef.current) videoRef.current.playbackRate = rate;
      setAudioPlaybackRate(rate);
    },
    [setAudioPlaybackRate],
  );

  const handleShuttleEnd = useCallback(
    (origin: DiagnosticOrigin = { type: "internal" }) => {
      flushFrameStepSeek();
      const direction = shuttleDirectionRef.current;
      if (direction === 0) return;

      const video = videoRef.current;
      const finalMicros =
        direction === 1 && video && !video.seeking && !seekSchedulerRef.current?.isPending
          ? video.currentTime * 1_000_000
          : currentPlayheadMicrosRef.current;

      shuttleDirectionRef.current = 0;
      cancelFrame(reverseShuttleFrameRef);
      reverseShuttleLastFrameAtRef.current = null;
      playbackStartSequenceRef.current += 1;
      playbackRequestedRef.current = false;
      isPlayingRef.current = false;
      video?.pause();
      pauseAudioPlayback();
      setIsPlaying(false);
      setShuttleDirection(0);
      stopPlayheadAnimation();
      setMediaPlaybackRate(playbackSpeed);
      commitSeek(finalMicros);
      diagnostics.event("timeline.shuttle.completed", {
        data: { direction },
        origin,
      });
    },
    [
      commitSeek,
      flushFrameStepSeek,
      pauseAudioPlayback,
      playbackSpeed,
      setIsPlaying,
      setShuttleDirection,
      setMediaPlaybackRate,
      stopPlayheadAnimation,
    ],
  );

  const startReverseShuttleAnimation = useCallback(() => {
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
      syncPlayheadElements(
        playheadRef.current,
        audioPlayheadRef.current,
        currentMicros,
        trimRef.current.sourceDurationMicros,
      );
      if (timestamp - lastPlaybackCommitAtRef.current >= 100) {
        lastPlaybackCommitAtRef.current = timestamp;
        setPlayheadMicros(currentMicros);
      }

      const video = videoRef.current;
      if (
        video &&
        (shuttleRestarted ||
          (!video.seeking &&
            timestamp - reverseShuttleLastSeekAtRef.current >= REVERSE_SHUTTLE_SEEK_INTERVAL_MS))
      ) {
        reverseShuttleLastSeekAtRef.current = timestamp;
        scheduleVideoSeek(currentMicros, true);
      }

      if (boundary.reached && !shuttleRestarted) {
        handleShuttleEnd({ type: "internal", id: "source-start" });
        return;
      }
      reverseShuttleFrameRef.current = requestAnimationFrame(update);
    };

    reverseShuttleFrameRef.current = requestAnimationFrame(update);
  }, [audioPlayheadRef, handleShuttleEnd, playbackModes, scheduleVideoSeek]);

  const handleShuttleStart = useCallback(
    (direction: FrameShuttleDirection, origin: DiagnosticOrigin = { type: "internal" }) => {
      if (!isPlaybackReadyRef.current || shuttleDirectionRef.current === direction) return;
      if (shuttleDirectionRef.current !== 0) handleShuttleEnd(origin);
      flushFrameStepSeek();

      playbackStartSequenceRef.current += 1;
      playbackRequestedRef.current = false;
      isPlayingRef.current = false;
      videoRef.current?.pause();
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
        setMediaPlaybackRate(FRAME_SHUTTLE_PLAYBACK_RATE);
        startMediaPlayback();
        return;
      }

      setMediaPlaybackRate(playbackSpeed);
      startReverseShuttleAnimation();
    },
    [
      handleShuttleEnd,
      flushFrameStepSeek,
      pauseAudioPlayback,
      playbackModes,
      playbackSpeed,
      setIsPlaying,
      setShuttleDirection,
      setMediaPlaybackRate,
      startMediaPlayback,
      startReverseShuttleAnimation,
      stopPlayheadAnimation,
    ],
  );

  const queueScrubSeek = useCallback(
    (micros: number) => {
      pendingScrubMicrosRef.current = clampPlaybackMicros(
        micros,
        trimRef.current.sourceDurationMicros,
      );
      if (scrubFrameRef.current !== null) return;
      scrubFrameRef.current = requestAnimationFrame((timestamp) => {
        scrubFrameRef.current = null;
        const pendingMicros = pendingScrubMicrosRef.current;
        pendingScrubMicrosRef.current = null;
        if (pendingMicros !== null) {
          const publish =
            trimInteractionActiveRef.current || timestamp - lastScrubCommitAtRef.current >= 100;

          if (publish) lastScrubCommitAtRef.current = timestamp;
          commitSeek(pendingMicros, true, publish);
        }
      });
    },
    [commitSeek],
  );

  const flushScrubSeek = useCallback(() => {
    cancelFrame(scrubFrameRef);
    const pendingMicros = pendingScrubMicrosRef.current;
    pendingScrubMicrosRef.current = null;
    commitSeek(pendingMicros ?? currentPlayheadMicrosRef.current, false);
  }, [commitSeek]);

  const handleScrubStart = useCallback(() => {
    flushFrameStepSeek();
    if (shuttleDirectionRef.current !== 0) handleShuttleEnd();
    diagnostics.event("timeline.seek.started", {
      data: { source: "timeline" },
      origin: { type: "timeline", id: "timeline.scrub" },
    });
    timelineInteractionActiveRef.current = true;
    lastScrubCommitAtRef.current = -Infinity;
    playbackStartSequenceRef.current += 1;
    resumeAfterScrubRef.current = playbackRequestedRef.current || isPlayingRef.current;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    videoRef.current?.pause();
    pauseAudioPlayback();
    setIsPlaying(false);
    stopPlayheadAnimation();
  }, [
    flushFrameStepSeek,
    handleShuttleEnd,
    pauseAudioPlayback,
    setIsPlaying,
    stopPlayheadAnimation,
  ]);

  const handleScrubEnd = useCallback(() => {
    flushScrubSeek();
    diagnostics.event("timeline.seek.completed", {
      data: { micros: currentPlayheadMicrosRef.current },
      origin: { type: "timeline", id: "timeline.scrub" },
    });
    timelineInteractionActiveRef.current = false;
    trimInteractionActiveRef.current = false;
    // A fast/keyframe seek is only for dragging; release always lands precisely.
    if (resumeAfterScrubRef.current) {
      resumeAfterScrubRef.current = false;
      playbackModes.startMicros(currentPlayheadMicrosRef.current, trimRef.current);
      playbackModes.resetBoundary();
      startMediaPlayback();
    } else {
      applyMediaSeek(currentPlayheadMicrosRef.current);
    }
  }, [applyMediaSeek, flushScrubSeek, playbackModes, startMediaPlayback]);

  const timelineEditing = useTimelineEditingCommands({
    currentPlayheadMicrosRef,
    onScrubEnd: handleScrubEnd,
    onScrubStart: handleScrubStart,
    trimInteractionActiveRef,
    trimRef,
  });

  const handleTogglePlayback = useCallback(
    (origin: DiagnosticOrigin = { type: "internal" }) => {
      if (shuttleDirectionRef.current !== 0) {
        handleShuttleEnd(origin);
        return;
      }
      diagnostics.action("playback.toggle.requested", origin, {
        playing: playbackRequestedRef.current || isPlayingRef.current,
      });
      const video = videoRef.current;
      if (!video || !isPlaybackReadyRef.current) {
        diagnostics.event("playback.toggle.ignored", {
          data: { reason: !video ? "video_unavailable" : "preview_not_ready" },
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
        video.pause();
        return;
      }
      const startMicros = playbackModes.startMicros(
        currentPlayheadMicrosRef.current,
        trimRef.current,
      );

      if (startMicros !== currentPlayheadMicrosRef.current) commitSeek(startMicros);
      playbackModes.resetBoundary();
      startMediaPlayback();
    },
    [commitSeek, handleShuttleEnd, playbackModes, setTransportError, startMediaPlayback],
  );

  const handlePausePlayback = useCallback(() => {
    if (shuttleDirectionRef.current !== 0) {
      handleShuttleEnd({ type: "internal", id: "scene-navigation" });
    }
    playbackStartSequenceRef.current += 1;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    resumeAfterScrubRef.current = false;
    videoRef.current?.pause();
    pauseAudioPlayback();
    setIsPlaying(false);
    stopPlayheadAnimation();
  }, [handleShuttleEnd, pauseAudioPlayback, setIsPlaying, stopPlayheadAnimation]);

  const handleStepFrame = useCallback(
    (direction: -1 | 1, origin: DiagnosticOrigin = { type: "internal" }) => {
      if (shuttleDirectionRef.current !== 0) handleShuttleEnd(origin);
      diagnostics.action("timeline.frame-step.requested", origin, { direction });
      playbackStartSequenceRef.current += 1;
      playbackRequestedRef.current = false;
      isPlayingRef.current = false;
      videoRef.current?.pause();
      setIsPlaying(false);
      stopPlayheadAnimation();
      const baseMicros = pendingFrameStepSeekMicrosRef.current ?? currentPlayheadMicrosRef.current;
      queueFrameStepSeek(baseMicros + direction * frameDurationMicros(frameRate));
    },
    [frameRate, handleShuttleEnd, queueFrameStepSeek, setIsPlaying, stopPlayheadAnimation],
  );

  const onTimeUpdate = useCallback(
    (seconds: number) => {
      if (
        shuttleDirectionRef.current !== 0 ||
        timelineInteractionActiveRef.current ||
        pendingFrameStepSeekMicrosRef.current !== null ||
        seekSchedulerRef.current?.isPending ||
        videoRef.current?.seeking
      )
        return;
      const currentMicros = clampPlaybackMicros(
        seconds * 1_000_000,
        trimRef.current.sourceDurationMicros,
      );

      if (isPlayingRef.current) {
        handlePlaybackBoundary(currentMicros);
        return;
      }
      currentPlayheadMicrosRef.current = currentMicros;
      syncPlayheadElements(
        playheadRef.current,
        audioPlayheadRef.current,
        currentMicros,
        trimRef.current.sourceDurationMicros,
      );
      setPlayheadMicros(currentMicros);
      if (currentMicros >= trimRef.current.sourceDurationMicros) stopPlayheadAnimation();
    },
    [audioPlayheadRef, handlePlaybackBoundary, setPlayheadMicros, stopPlayheadAnimation],
  );

  const onPause = useCallback(() => {
    if (playbackRequestedRef.current && seekSchedulerRef.current?.isPending) return;
    if (isPlayingRef.current) {
      void videoRef.current?.play().catch(() => undefined);
      return;
    }
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    setIsPlaying(false);
    pauseAudioPlayback();
    stopPlayheadAnimation();
    if (videoRef.current) onTimeUpdate(videoRef.current.currentTime);
    diagnostics.event("playback.state.changed", {
      data: { status: "paused" },
      origin: { type: "internal" },
    });
  }, [onTimeUpdate, pauseAudioPlayback, setIsPlaying, stopPlayheadAnimation]);

  const onCropToolOpenChange = useCallback(
    (isOpen: boolean) => {
      diagnostics.event(isOpen ? "crop.tool.opened" : "crop.tool.closed", {
        origin: { type: "button", id: "crop.tool" },
      });
      if (isOpen) {
        if (shuttleDirectionRef.current !== 0) {
          handleShuttleEnd({ type: "internal", id: "crop-tool" });
          return;
        }
        resumeAfterCropRef.current = playbackRequestedRef.current || isPlayingRef.current;
        if (!resumeAfterCropRef.current) return;
        playbackStartSequenceRef.current += 1;
        playbackRequestedRef.current = false;
        isPlayingRef.current = false;
        videoRef.current?.pause();
        pauseAudioPlayback();
        setIsPlaying(false);
        stopPlayheadAnimation();
        return;
      }
      if (resumeAfterCropRef.current) {
        resumeAfterCropRef.current = false;
        startMediaPlayback();
      }
    },
    [handleShuttleEnd, pauseAudioPlayback, setIsPlaying, startMediaPlayback, stopPlayheadAnimation],
  );

  const onPreviewPlaybackError = useCallback(
    (previewKind: "source" | "proxy") => {
      if (shuttleDirectionRef.current !== 0)
        handleShuttleEnd({ type: "internal", id: "preview-error" });
      playbackStartSequenceRef.current += 1;
      playbackRequestedRef.current = false;
      isPlayingRef.current = false;
      videoRef.current?.pause();
      pauseAudioPlayback();
      setIsPlaying(false);
      stopPlayheadAnimation();
      if (sourcePath) void dispatch(handlePreviewPlaybackErrorRequested(sourcePath, previewKind));
    },
    [
      dispatch,
      handleShuttleEnd,
      pauseAudioPlayback,
      setIsPlaying,
      sourcePath,
      stopPlayheadAnimation,
    ],
  );

  const onLoadedMetadata = useCallback(() => {
    commitSeek(currentPlayheadMicrosRef.current);
  }, [commitSeek]);

  const onCanPlay = useCallback(() => {
    if (previewKey) setReadyPreviewKey(previewKey);
  }, [previewKey, setReadyPreviewKey]);

  const onPlay = useCallback(() => {
    playbackRequestedRef.current = true;
    if (shuttleDirectionRef.current !== 0) {
      if (shuttleDirectionRef.current === 1) startPlayheadAnimation();
      return;
    }
    isPlayingRef.current = true;
    setIsPlaying(true);
    startPlayheadAnimation();
    diagnostics.event("playback.state.changed", {
      data: { status: "playing" },
      origin: { type: "internal" },
    });
  }, [setIsPlaying, startPlayheadAnimation]);

  const onEnded = useCallback(() => {
    diagnostics.event("playback.state.changed", {
      data: { status: "ended" },
      origin: { type: "internal" },
    });
    if (shuttleDirectionRef.current !== 0) {
      if (shuttleDirectionRef.current === 1) {
        const boundary = playbackModes.consumeSourceBoundary(
          trimRef.current.sourceDurationMicros,
          trimRef.current.sourceDurationMicros,
          1,
        );

        const boundaryAction = boundary.reached ? boundary.action : null;
        if (boundaryAction?.type === "restart") {
          commitSeek(boundaryAction.positionMicros);
          playbackModes.resetBoundary();
          startMediaPlayback();
          return;
        }
      }
      handleShuttleEnd({ type: "internal", id: "source-end" });
      return;
    }
    if (videoRef.current) handlePlaybackBoundary(videoRef.current.currentTime * 1_000_000);
  }, [commitSeek, handlePlaybackBoundary, handleShuttleEnd, playbackModes, startMediaPlayback]);

  useEditorTimelineShortcuts(
    {
      enabled: isPlaybackReady,
      onSetSegmentBoundary: timelineEditing.onSetSegmentBoundary,
      onShuttleEnd: handleShuttleEnd,
      onShuttleStart: handleShuttleStart,
      onStepFrame: handleStepFrame,
      onTogglePlayback: handleTogglePlayback,
    },
    timelineInteractionActiveRef,
  );

  return {
    videoRef,
    playheadRef,
    displayedPlayheadMicros,
    isPlaying,
    isPlaybackReady,
    transportError,
    nativeLoopEnabled,
    shuttleDirection,
    videoMuted: usesExternalAudio && typeof AudioContext === "undefined",
    onLoadedMetadata,
    onCanPlay,
    onPlay,
    onPause,
    onPausePlayback: handlePausePlayback,
    onTimeUpdate,
    onEnded,
    onTogglePlayback: handleTogglePlayback,
    onStepFrame: handleStepFrame,
    onShuttleStart: handleShuttleStart,
    onShuttleEnd: handleShuttleEnd,
    onSetSegmentBoundary: timelineEditing.onSetSegmentBoundary,
    onTrimBoundaryChange: timelineEditing.onTrimBoundaryChange,
    onSegmentMove: timelineEditing.onSegmentMove,
    onTrimDragStart: timelineEditing.onTrimDragStart,
    onTrimDragEnd: timelineEditing.onTrimDragEnd,
    onSegmentDragStart: timelineEditing.onSegmentDragStart,
    onSegmentDragEnd: timelineEditing.onSegmentDragEnd,
    onSeek: commitSeek,
    onScrubStart: handleScrubStart,
    onScrub: queueScrubSeek,
    onScrubEnd: handleScrubEnd,
    onCropToolOpenChange,
    onPreviewPlaybackError,
    setMediaPlaybackRate,
    audioPlayback: {
      audioMeterRef,
      audioPlayheadRef,
      setLiveAudioTrackGain: audioPlayback.setLiveAudioTrackGain,
      clearLiveAudioTrackGain,
    },
    setVideoElement,
    canSetSegmentStart: canSetTrimBoundaryAtPlayhead(trim, "start", displayedPlayheadMicros),
    canSetSegmentEnd: canSetTrimBoundaryAtPlayhead(trim, "end", displayedPlayheadMicros),
  };
}

export { usePreviewPlaybackRuntime };
