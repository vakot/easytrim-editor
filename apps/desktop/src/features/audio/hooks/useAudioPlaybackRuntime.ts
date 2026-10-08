import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppSelector, useAppStore } from "@/app/store/redux-hooks";
import {
  audioTrackPlaybackPreviewUrl,
  type AudioTrackState,
  selectAudioTracks,
} from "@/app/store/slices/audio-slice";
import { selectPlaybackVolumePercent } from "@/app/store/slices/preferences-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import {
  audioTrackExternalPreviewStreamIndexes,
  audioTrackPreviewRuntimeGainDb,
  type AudioTrackProcessing,
  audioTrackRequiresProcessedPreview,
  effectiveAudioTrackGainDb,
} from "@/domain/audio-processing";

import {
  connectPlaybackAudioGraph,
  disconnectAudioTrackRuntime,
  updateAudioTrackLimiter,
} from "../lib/audio-playback-graph";
import { getAudioTrackRuntimeLimiter } from "../lib/audio-playback-runtime";
import { synchronizeAudioPosition } from "../lib/audio-sync";
import {
  connectNativeAudioBinding,
  disconnectNativeAudioBinding,
  getOrCreateNativeAudioBinding,
  type NativeAudioBinding,
} from "../lib/native-audio-runtime";
import {
  disconnectStereoAudioMeterNodes,
  isMonoAudioMix,
  type StereoAudioMeterNodes,
} from "../lib/stereo-audio-meter";

interface LiveAudioTrackGainRuntime {
  audioNodes: Map<
    number,
    { gain: GainNode; limiter: WaveShaperNode | null; source: MediaElementAudioSourceNode }
  >;
  audioTracks: AudioTrackState[];
  nativeAudioBinding: { binding: NativeAudioBinding; element: HTMLVideoElement } | null;
  nativeAudioTrack: { enabled: boolean; streamIndex: number } | undefined;
  nativeAudioStreamIndex: number | undefined;
  playbackVolumePercent: number;
  requiresProcessedPreview: boolean;
  videoElement: HTMLVideoElement | null;
}

function applyAudioTrackGain(
  streamIndex: number,
  gainDb: number,
  runtime: LiveAudioTrackGainRuntime,
  allowMutedTrackPreview = false,
  audioContext?: AudioContext | null,
  audioMix?: GainNode | null,
): void {
  const externalAudioNode = runtime.audioNodes.get(streamIndex);
  const track = runtime.audioTracks.find((candidate) => candidate.streamIndex === streamIndex);
  const runtimeGainDb = track
    ? audioTrackPreviewRuntimeGainDb(track.processing, previewProcessingForTrack(track), gainDb)
    : gainDb;

  if (externalAudioNode) {
    externalAudioNode.gain.gain.value = 10 ** (runtimeGainDb / 20);
    if (track && audioContext && audioMix) {
      updateAudioTrackLimiter(
        audioContext,
        externalAudioNode,
        audioMix,
        getAudioTrackRuntimeLimiter(track.processing, previewProcessingForTrack(track), gainDb),
      );
    }
  }

  if (runtime.nativeAudioTrack?.streamIndex !== streamIndex || runtime.requiresProcessedPreview)
    return;

  const linearGain = 10 ** (gainDb / 20);
  const nativeGain = runtime.nativeAudioTrack.enabled || allowMutedTrackPreview ? linearGain : 0;
  if (runtime.nativeAudioBinding) {
    runtime.nativeAudioBinding.binding.gain.gain.value = nativeGain;
  } else if (runtime.videoElement) {
    runtime.videoElement.volume = Math.min(1, (runtime.playbackVolumePercent / 100) * nativeGain);
  }
}

function setGainNodeFromDb(gainNode: GainNode, gainDb: number): void {
  gainNode.gain.value = 10 ** (gainDb / 20);
}

function previewProcessingForTrack(track: AudioTrackState): AudioTrackProcessing {
  return "descriptor" in track.preview && track.preview.descriptor
    ? track.preview.descriptor.processing
    : { gainDb: 0 };
}

function useAudioPlaybackRuntime({
  activeInstanceId,
  isPreviewReady,
  playbackRate,
  previewKey,
  videoRef,
}: {
  activeInstanceId: string | null;
  isPreviewReady: boolean;
  playbackRate: number;
  previewKey: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const store = useAppStore();
  const sourcePath = useAppSelector(selectSourceSelection)?.sourcePath ?? null;
  const media = useAppSelector(selectSourceMedia);
  const audioTracks = useAppSelector(selectAudioTracks);
  const playbackVolumePercent = useAppSelector(selectPlaybackVolumePercent);
  const enabledAudioTracks = audioTracks.filter((track) => track.enabled);
  const nativeAudioStreamIndex =
    media?.audioStreams.find((stream) => stream.isDefault)?.streamIndex ??
    media?.audioStreams[0]?.streamIndex;

  const externalPreviewStreamIndexes = useMemo(
    () => new Set(audioTrackExternalPreviewStreamIndexes(audioTracks, nativeAudioStreamIndex)),
    [audioTracks, nativeAudioStreamIndex],
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

  const activeExternalAudioStreamCount = audioTracks.filter(
    (track) => track.enabled && audioPreviewUrls[track.streamIndex] !== undefined,
  ).length;

  const selectedAudioTrack = enabledAudioTracks.length === 1 ? enabledAudioTracks[0] : undefined;
  const nativeAudioTrack =
    selectedAudioTrack?.streamIndex === nativeAudioStreamIndex ? selectedAudioTrack : undefined;

  const requiresProcessedPreview =
    enabledAudioTracks.length > 1 ||
    (enabledAudioTracks.length === 1 &&
      (nativeAudioTrack === undefined ||
        audioTrackRequiresProcessedPreview(enabledAudioTracks[0]!.processing)));

  const usesExternalAudio =
    requiresProcessedPreview && activeExternalAudioStreamCount === enabledAudioTracks.length;

  const [audioReadiness, setAudioReadiness] = useState<{
    previewUrls: Map<number, string>;
    sourcePath: string | null;
  }>(() => ({ sourcePath: null, previewUrls: new Map() }));

  const audioElementsRef = useRef(new Map<number, HTMLAudioElement>());
  const audioReadyListenersRef = useRef(new Map<number, () => void>());
  const audioContextRef = useRef<AudioContext | null>(null);
  const deferredAudioCleanupRef = useRef<number | null>(null);
  const audioNodesRef = useRef(
    new Map<
      number,
      { gain: GainNode; limiter: WaveShaperNode | null; source: MediaElementAudioSourceNode }
    >(),
  );

  const liveAudioTrackGainsRef = useRef(new Map<number, number>());
  const nativeAudioBindingsRef = useRef(new Map<HTMLVideoElement, NativeAudioBinding>());
  const nativeAudioBindingRef = useRef<{
    binding: NativeAudioBinding;
    element: HTMLVideoElement;
  } | null>(null);

  const audioMixRef = useRef<GainNode | null>(null);
  const audioMeterRef = useRef<StereoAudioMeterNodes | null>(null);
  const playbackOutputGainRef = useRef<GainNode | null>(null);
  const audioPlayheadRef = useRef<HTMLDivElement>(null);
  const liveAudioTrackGainRuntimeRef = useRef<LiveAudioTrackGainRuntime | null>(null);

  useEffect(() => {
    liveAudioTrackGainRuntimeRef.current = {
      audioTracks,
      audioNodes: audioNodesRef.current,
      nativeAudioBinding: nativeAudioBindingRef.current,
      nativeAudioTrack,
      nativeAudioStreamIndex,
      playbackVolumePercent,
      requiresProcessedPreview,
      videoElement: videoRef.current,
    };
  }, [audioTracks, nativeAudioTrack, playbackVolumePercent, requiresProcessedPreview, videoRef]);

  const setLiveAudioTrackGain = useCallback(
    (streamIndex: number, gainDb: number) => {
      const runtime = liveAudioTrackGainRuntimeRef.current;
      if (!runtime) return;
      liveAudioTrackGainsRef.current.set(streamIndex, gainDb);
      applyAudioTrackGain(
        streamIndex,
        gainDb,
        {
          ...runtime,
          audioNodes: audioNodesRef.current,
          nativeAudioBinding: nativeAudioBindingRef.current,
          videoElement: videoRef.current,
        },
        true,
        audioContextRef.current,
        audioMixRef.current,
      );
    },
    [videoRef],
  );

  const clearLiveAudioTrackGain = useCallback(
    (streamIndex: number) => {
      liveAudioTrackGainsRef.current.delete(streamIndex);
      const runtime = liveAudioTrackGainRuntimeRef.current;
      if (!runtime) return;

      const audioTracks = selectAudioTracks(store.getState());
      const track = audioTracks.find((candidate) => candidate.streamIndex === streamIndex);
      const committedGainDb = track?.enabled
        ? (track.processing.gainDb ?? 0)
        : Number.NEGATIVE_INFINITY;
      const enabledAudioTracks = audioTracks.filter((candidate) => candidate.enabled);
      const selectedAudioTrack =
        enabledAudioTracks.length === 1 ? enabledAudioTracks[0] : undefined;
      const nativeAudioTrack = audioTracks.find(
        (candidate) => candidate.streamIndex === runtime.nativeAudioStreamIndex,
      );
      const usesNativeAudioTrack =
        selectedAudioTrack?.streamIndex === runtime.nativeAudioStreamIndex;
      const requiresProcessedPreview =
        enabledAudioTracks.length > 1 ||
        (enabledAudioTracks.length === 1 &&
          (!usesNativeAudioTrack ||
            audioTrackRequiresProcessedPreview(enabledAudioTracks[0]!.processing)));

      applyAudioTrackGain(
        streamIndex,
        committedGainDb,
        {
          ...runtime,
          audioTracks,
          audioNodes: audioNodesRef.current,
          nativeAudioBinding: nativeAudioBindingRef.current,
          nativeAudioTrack,
          requiresProcessedPreview,
          videoElement: videoRef.current,
        },
        true,
        audioContextRef.current,
        audioMixRef.current,
      );
    },
    [store, videoRef],
  );

  const removeAudioRuntime = useCallback((streamIndex: number) => {
    const element = audioElementsRef.current.get(streamIndex);
    if (element) {
      element.pause();
      const readyListener = audioReadyListenersRef.current.get(streamIndex);
      if (readyListener) element.removeEventListener("canplay", readyListener);
      element.removeAttribute("src");
      element.load();
      element.remove();
    }
    audioElementsRef.current.delete(streamIndex);
    audioReadyListenersRef.current.delete(streamIndex);
    setAudioReadiness((current) => {
      if (!current.previewUrls.has(streamIndex)) return current;
      const previewUrls = new Map(current.previewUrls);
      previewUrls.delete(streamIndex);
      return { ...current, previewUrls };
    });
    const node = audioNodesRef.current.get(streamIndex);
    if (node) disconnectAudioTrackRuntime(node);
    audioNodesRef.current.delete(streamIndex);
  }, []);

  const disconnectCurrentNativeAudioRoute = useCallback(() => {
    const currentBinding = nativeAudioBindingRef.current;
    if (!currentBinding) return;
    disconnectNativeAudioBinding(currentBinding.binding);
    nativeAudioBindingRef.current = null;
  }, []);

  const cleanupStaleNativeAudioBindings = useCallback((currentVideo: HTMLVideoElement | null) => {
    for (const [element, binding] of nativeAudioBindingsRef.current) {
      if (element === currentVideo) continue;
      disconnectNativeAudioBinding(binding);
      nativeAudioBindingsRef.current.delete(element);
    }
    if (nativeAudioBindingRef.current?.element !== currentVideo)
      nativeAudioBindingRef.current = null;
  }, []);

  const cleanupAllNativeAudioBindings = useCallback(() => {
    for (const binding of nativeAudioBindingsRef.current.values()) {
      disconnectNativeAudioBinding(binding);
    }
    nativeAudioBindingsRef.current.clear();
    nativeAudioBindingRef.current = null;
  }, []);

  const cleanupAudioRuntime = useCallback(() => {
    for (const streamIndex of audioElementsRef.current.keys()) removeAudioRuntime(streamIndex);
    liveAudioTrackGainsRef.current.clear();
    disconnectCurrentNativeAudioRoute();
    disconnectStereoAudioMeterNodes(audioMeterRef.current);
    audioMeterRef.current = null;
    audioMixRef.current?.disconnect();
    audioMixRef.current = null;
    playbackOutputGainRef.current?.disconnect();
    playbackOutputGainRef.current = null;
  }, [disconnectCurrentNativeAudioRoute, removeAudioRuntime]);

  const previousRuntimeIdentityRef = useRef({ activeInstanceId, previewKey });
  useEffect(() => {
    if (
      previousRuntimeIdentityRef.current.activeInstanceId === activeInstanceId &&
      previousRuntimeIdentityRef.current.previewKey === previewKey
    )
      return;
    previousRuntimeIdentityRef.current = { activeInstanceId, previewKey };
    cleanupAudioRuntime();
  }, [activeInstanceId, cleanupAudioRuntime, previewKey]);

  useEffect(() => {
    if (deferredAudioCleanupRef.current !== null) {
      window.clearTimeout(deferredAudioCleanupRef.current);
      deferredAudioCleanupRef.current = null;
    }
    return () => {
      deferredAudioCleanupRef.current = window.setTimeout(() => {
        deferredAudioCleanupRef.current = null;
        cleanupAudioRuntime();
        cleanupAllNativeAudioBindings();
        const audioContext = audioContextRef.current;
        audioContextRef.current = null;
        void audioContext?.close().catch(() => undefined);
      }, 0);
    };
  }, [cleanupAllNativeAudioBindings, cleanupAudioRuntime]);

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
      const { meter, outputGain: playbackOutputGain } = connectPlaybackAudioGraph(
        context,
        audioMix,
      );

      playbackOutputGainRef.current = playbackOutputGain;
      audioMeterRef.current = meter;
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
      element.playbackRate = playbackRate;
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

      const track = audioTracks.find((candidate) => candidate.streamIndex === streamIndex);
      const audioSource = context.createMediaElementSource(element);
      const gain = context.createGain();
      const previewProcessing = track ? previewProcessingForTrack(track) : { gainDb: 0 };
      const gainDb = track
        ? audioTrackPreviewRuntimeGainDb(
            track.processing,
            previewProcessing,
            liveAudioTrackGainsRef.current.get(streamIndex) ?? track.processing.gainDb,
          )
        : 0;

      setGainNodeFromDb(gain, track?.enabled === false ? Number.NEGATIVE_INFINITY : gainDb);
      audioSource.connect(gain);
      gain.connect(audioMix);
      const node: {
        gain: GainNode;
        limiter: WaveShaperNode | null;
        source: MediaElementAudioSourceNode;
      } = { limiter: null, gain, source: audioSource };

      updateAudioTrackLimiter(
        context,
        node,
        audioMix,
        track
          ? getAudioTrackRuntimeLimiter(
              track.processing,
              previewProcessing,
              liveAudioTrackGainsRef.current.get(streamIndex),
            )
          : undefined,
      );
      audioElementsRef.current.set(streamIndex, element);
      audioNodesRef.current.set(streamIndex, node);
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
    isPreviewReady,
    removeAudioRuntime,
    sourcePath,
    playbackRate,
    requiresProcessedPreview,
    usesExternalAudio,
    videoRef,
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
    const context = audioContextRef.current;
    if (!context) return;
    const outputGain = playbackOutputGainRef.current;
    if (outputGain) {
      const now = context.currentTime;
      outputGain.gain.cancelScheduledValues(now);
      outputGain.gain.setValueAtTime(outputGain.gain.value, now);
      outputGain.gain.linearRampToValueAtTime(playbackVolumePercent / 100, now + 0.025);
    }

    for (const track of audioTracks) {
      const node = audioNodesRef.current.get(track.streamIndex);
      if (!node) continue;
      const gainDb = audioTrackPreviewRuntimeGainDb(
        track.processing,
        previewProcessingForTrack(track),
        liveAudioTrackGainsRef.current.get(track.streamIndex) ?? track.processing.gainDb,
      );

      node.gain.gain.value = track.enabled ? 10 ** (gainDb / 20) : 0;
      const audioMix = audioMixRef.current;
      if (audioMix)
        updateAudioTrackLimiter(
          context,
          node,
          audioMix,
          getAudioTrackRuntimeLimiter(track.processing, previewProcessingForTrack(track)),
        );
    }

    const gainDb = nativeAudioTrack
      ? nativeAudioTrack.processing.loudnessNormalization === undefined
        ? (liveAudioTrackGainsRef.current.get(nativeAudioTrack.streamIndex) ??
          nativeAudioTrack.processing.gainDb)
        : effectiveAudioTrackGainDb(nativeAudioTrack.processing)
      : 0;

    if (nativeAudioBindingRef.current) {
      nativeAudioBindingRef.current.binding.gain.gain.value =
        nativeAudioTrack?.enabled && !requiresProcessedPreview ? 10 ** (gainDb / 20) : 0;
      if (videoRef.current) videoRef.current.volume = 1;
    } else if (videoRef.current) {
      const trackGain =
        nativeAudioTrack?.enabled && !requiresProcessedPreview ? 10 ** (gainDb / 20) : 0;

      videoRef.current.volume = Math.min(1, (playbackVolumePercent / 100) * trackGain);
    }
  }, [audioTracks, nativeAudioTrack, playbackVolumePercent, requiresProcessedPreview, videoRef]);

  const pause = useCallback(() => {
    for (const audio of audioElementsRef.current.values()) audio.pause();
  }, []);

  const syncTo = useCallback((seconds: number, force = false) => {
    for (const audio of audioElementsRef.current.values())
      synchronizeAudioPosition(audio, seconds, audio.playbackRate, force);
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    for (const audio of audioElementsRef.current.values()) audio.playbackRate = rate;
  }, []);

  const resumeAudioContext = useCallback(
    () => audioContextRef.current?.resume() ?? Promise.resolve(),
    [],
  );

  const startAt = useCallback(
    (seconds: number): Promise<void[]> => {
      syncTo(seconds, true);
      return Promise.all([...audioElementsRef.current.values()].map((element) => element.play()));
    },
    [syncTo],
  );

  const resumeAt = useCallback(
    (seconds: number) =>
      Promise.all([resumeAudioContext().then(() => undefined), startAt(seconds)]),
    [resumeAudioContext, startAt],
  );

  const isReady =
    !requiresProcessedPreview ||
    (usesExternalAudio &&
      audioReadiness.sourcePath === sourcePath &&
      activeExternalAudioStreamCount === enabledAudioTracks.length &&
      enabledAudioTracks.every(
        (track) =>
          audioReadiness.previewUrls.get(track.streamIndex) === audioPreviewUrls[track.streamIndex],
      ));

  return {
    audioMeterRef,
    audioPlayheadRef,
    clearLiveAudioTrackGain,
    isReady,
    pause,
    resumeAt,
    resumeAudioContext,
    setLiveAudioTrackGain,
    setPlaybackRate,
    startAt,
    syncTo,
    usesExternalAudio,
  };
}

export { useAudioPlaybackRuntime };
