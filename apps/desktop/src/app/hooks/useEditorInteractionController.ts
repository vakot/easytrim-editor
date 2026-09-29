import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { usePlaybackModes } from "@/app/hooks/usePlaybackModes";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks, selectMergeAudio } from "@/app/store/slices/audio-slice";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import {
  selectLoopPlaybackEnabled,
  selectSegmentPlaybackEnabled,
} from "@/app/store/slices/editor-tools-slice";
import { selectPlaybackSpeed } from "@/app/store/slices/playback-controls-slice";
import { selectPlaybackVolumePercent } from "@/app/store/slices/preferences-slice";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim, trimChanged } from "@/app/store/slices/trim-slice";
import {
  commitActiveEditingInstanceDraft,
  handlePreviewPlaybackError as handlePreviewPlaybackErrorRequested,
} from "@/app/store/thunks/source-media-thunks";
import { sameAudioTrackPreviewProcessing } from "@/domain/audio-processing";
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
  meterMixNormalization,
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
  editorShortcutFromEvent,
  FRAME_SHUTTLE_PLAYBACK_RATE,
  type FrameShuttleDirection,
  shortcutDispositionFromEvent,
  syncPlayheadElements,
} from "@/features/timeline";
import { diagnostics } from "@/lib/diagnostics";
import { isApplicationInteractionBlocked } from "@/lib/hotkeys.utils";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";

const EMPTY_TRIM: TrimRange = {
  startMicros: 0,
  endMicros: 0,
  sourceDurationMicros: 0,
};

const AUDIO_SYNC_INTERVAL_MS = 100;
const REVERSE_SHUTTLE_SEEK_INTERVAL_MS = 50;
const SHUTTLE_MAX_FRAME_DELTA_MS = 100;

function applyAudioTrackGain(
  streamIndex: number,
  gainDb: number,
  runtime: LiveAudioTrackGainRuntime,
): void {
  const linearGain = 10 ** (gainDb / 20);
  const externalAudioNode = runtime.audioNodes.get(streamIndex);
  if (externalAudioNode) externalAudioNode.gain.gain.value = linearGain;

  if (runtime.nativeAudioTrack?.streamIndex !== streamIndex || runtime.requiresProcessedPreview)
    return;

  const nativeGain = runtime.nativeAudioTrack.enabled ? linearGain : 0;
  if (runtime.nativeAudioBinding) {
    runtime.nativeAudioBinding.binding.gain.gain.value = nativeGain;
  } else if (runtime.videoElement) {
    runtime.videoElement.volume = Math.min(1, (runtime.playbackVolumePercent / 100) * nativeGain);
  }
}

interface LiveAudioTrackGainRuntime {
  audioNodes: Map<number, { gain: GainNode; source: MediaElementAudioSourceNode }>;
  nativeAudioBinding: { binding: NativeAudioBinding; element: HTMLVideoElement } | null;
  nativeAudioTrack: { enabled: boolean; streamIndex: number } | undefined;
  playbackVolumePercent: number;
  requiresProcessedPreview: boolean;
  videoElement: HTMLVideoElement | null;
}

function setGainNodeFromDb(gainNode: GainNode, gainDb: number): void {
  gainNode.gain.value = 10 ** (gainDb / 20);
}

interface EditorInteractionRuntime {
  audioMeterRef: React.RefObject<StereoAudioMeterNodes | null>;
  audioPlayheadRef: React.RefObject<HTMLDivElement | null>;
  canSetSegmentEnd: boolean;
  canSetSegmentStart: boolean;
  clearLiveAudioTrackGain: (streamIndex: number, committedGainDb: number) => void;
  displayedPlayheadMicros: number;
  isPlaybackReady: boolean;
  isPlaying: boolean;
  nativeLoopEnabled: boolean;
  onCanPlay: () => void;
  onCropToolOpenChange: (isOpen: boolean) => void;
  onEnded: () => void;
  onLoadedMetadata: () => void;
  onPause: () => void;
  onPausePlayback: () => void;
  onPlay: () => void;
  onPreviewPlaybackError: (previewKind: "source" | "proxy") => void;
  onScrub: (micros: number) => void;
  onScrubEnd: () => void;
  onScrubStart: () => void;
  onSeek: (micros: number) => void;
  onSegmentDragEnd: () => void;
  onSegmentDragStart: () => void;
  onSegmentMove: (nextTrim: TrimRange) => void;
  onSetSegmentBoundary: (boundary: TrimBoundary, origin?: DiagnosticOrigin) => void;
  onShuttleEnd: (origin?: DiagnosticOrigin) => void;
  onShuttleStart: (direction: FrameShuttleDirection, origin?: DiagnosticOrigin) => void;
  onStepFrame: (direction: -1 | 1, origin?: DiagnosticOrigin) => void;
  onTimeUpdate: (seconds: number) => void;
  onTogglePlayback: (origin?: DiagnosticOrigin) => void;
  onTrimBoundaryChange: (boundary: TrimBoundary, nextTrim: TrimRange) => void;
  onTrimDragEnd: () => void;
  onTrimDragStart: () => void;
  playheadRef: React.RefObject<HTMLButtonElement | null>;
  setLiveAudioTrackGain: (streamIndex: number, gainDb: number) => void;
  setMediaPlaybackRate: (rate: number) => void;
  setVideoElement: (element: HTMLVideoElement | null) => void;
  shuttleDirection: FrameShuttleDirection | 0;
  transportError: string | null;
  videoMuted: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

function useEditorInteractionController(): EditorInteractionRuntime {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const loopPlaybackEnabled = useAppSelector(selectLoopPlaybackEnabled);
  const segmentPlaybackEnabled = useAppSelector(selectSegmentPlaybackEnabled);
  const playbackSpeed = useAppSelector(selectPlaybackSpeed);
  const playbackVolumePercent = useAppSelector(selectPlaybackVolumePercent);
  const sourceSelection = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const trim = useAppSelector(selectTrim) ?? EMPTY_TRIM;
  const preview = useAppSelector(selectPreview);
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;
  const audioTracks = useAppSelector(selectAudioTracks);
  const mergeAudio = useAppSelector(selectMergeAudio);
  const audioPreviewUrls = useMemo(
    () =>
      Object.fromEntries(
        audioTracks.flatMap((track) =>
          track.preview.status === "ready" &&
          sameAudioTrackPreviewProcessing(track.processing, track.preview.descriptor.processing)
            ? [[track.streamIndex, track.preview.descriptor.url]]
            : [],
        ),
      ),
    [audioTracks],
  );

  const sourcePath = sourceSelection?.sourcePath ?? null;
  const sourceAudioStreams = media?.audioStreams ?? [];
  const enabledAudioTracks = audioTracks.filter((track) => track.enabled);
  const activeExternalAudioStreamCount = audioTracks.filter(
    (track) => track.enabled && audioPreviewUrls[track.streamIndex] !== undefined,
  ).length;

  const nativeAudioStreamIndex =
    sourceAudioStreams.find((stream) => stream.isDefault)?.streamIndex ??
    sourceAudioStreams[0]?.streamIndex;

  const selectedAudioTrack = enabledAudioTracks.length === 1 ? enabledAudioTracks[0] : undefined;

  const nativeAudioTrack =
    selectedAudioTrack?.streamIndex === nativeAudioStreamIndex ? selectedAudioTrack : undefined;

  const requiresProcessedPreview =
    enabledAudioTracks.length > 1 ||
    (enabledAudioTracks.length === 1 &&
      (nativeAudioTrack === undefined ||
        enabledAudioTracks[0]!.processing.loudnessNormalization !== undefined));

  const usesExternalAudio =
    requiresProcessedPreview && activeExternalAudioStreamCount === enabledAudioTracks.length;

  const previewKey =
    sourcePath && preview.status === "ready" ? `${sourcePath}:${preview.value.url}` : null;

  const [playheadMicros, setPlayheadMicros] = useState(trim.startMicros);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuttleDirection, setShuttleDirection] = useState<FrameShuttleDirection | 0>(0);
  const [transportError, setTransportError] = useState<string | null>(null);
  const [readyPreviewKey, setReadyPreviewKey] = useState<string | null>(null);
  const [audioReadiness, setAudioReadiness] = useState<{
    previewUrls: Map<number, string>;
    sourcePath: string | null;
  }>(() => ({ sourcePath: null, previewUrls: new Map() }));

  const videoRef = useRef<HTMLVideoElement>(null);
  const setVideoElement = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
  }, []);

  const seekSchedulerRef = useRef<ReturnType<typeof createSeekScheduler> | null>(null);
  const audioElementsRef = useRef(new Map<number, HTMLAudioElement>());
  const audioReadyListenersRef = useRef(new Map<number, () => void>());
  const audioContextRef = useRef<AudioContext | null>(null);
  const deferredAudioCleanupRef = useRef<number | null>(null);
  const audioNodesRef = useRef(
    new Map<number, { gain: GainNode; source: MediaElementAudioSourceNode }>(),
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
  const playheadRef = useRef<HTMLButtonElement>(null);
  const audioPlayheadRef = useRef<HTMLDivElement>(null);
  const liveAudioTrackGainRuntimeRef = useRef<LiveAudioTrackGainRuntime | null>(null);

  useEffect(() => {
    liveAudioTrackGainRuntimeRef.current = {
      audioNodes: audioNodesRef.current,
      nativeAudioBinding: nativeAudioBindingRef.current,
      nativeAudioTrack,
      playbackVolumePercent,
      requiresProcessedPreview,
      videoElement: videoRef.current,
    };
  }, [nativeAudioTrack, playbackVolumePercent, requiresProcessedPreview]);

  const setLiveAudioTrackGain = useCallback((streamIndex: number, gainDb: number) => {
    const runtime = liveAudioTrackGainRuntimeRef.current;
    if (!runtime) return;
    liveAudioTrackGainsRef.current.set(streamIndex, gainDb);
    applyAudioTrackGain(streamIndex, gainDb, {
      ...runtime,
      audioNodes: audioNodesRef.current,
      nativeAudioBinding: nativeAudioBindingRef.current,
      videoElement: videoRef.current,
    });
  }, []);

  const clearLiveAudioTrackGain = useCallback((streamIndex: number, committedGainDb: number) => {
    const runtime = liveAudioTrackGainRuntimeRef.current;
    if (!runtime) return;
    liveAudioTrackGainsRef.current.delete(streamIndex);
    applyAudioTrackGain(streamIndex, committedGainDb, {
      ...runtime,
      audioNodes: audioNodesRef.current,
      nativeAudioBinding: nativeAudioBindingRef.current,
      videoElement: videoRef.current,
    });
  }, []);

  const playbackFrameRef = useRef<PlaybackFrameHandle | null>(null);
  const reverseShuttleFrameRef = useRef<number | null>(null);
  const reverseShuttleLastFrameAtRef = useRef<number | null>(null);
  const reverseShuttleLastSeekAtRef = useRef(0);
  const scrubFrameRef = useRef<number | null>(null);
  const pendingScrubMicrosRef = useRef<number | null>(null);
  const frameStepSeekFrameRef = useRef<number | null>(null);
  const pendingFrameStepSeekMicrosRef = useRef<number | null>(null);
  const trimCommitFrameRef = useRef<number | null>(null);
  const pendingTrimCommitRef = useRef<TrimRange | null>(null);
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
  const playbackRateRef = useRef<number>(playbackSpeed);
  const isPlaybackReady =
    previewKey !== null &&
    readyPreviewKey === previewKey &&
    (!requiresProcessedPreview ||
      (usesExternalAudio &&
        audioReadiness.sourcePath === sourcePath &&
        activeExternalAudioStreamCount === enabledAudioTracks.length &&
        enabledAudioTracks.every(
          (track) =>
            audioReadiness.previewUrls.get(track.streamIndex) ===
            audioPreviewUrls[track.streamIndex],
        )));

  const isPlaybackReadyRef = useRef(isPlaybackReady);
  const nativeLoopEnabled =
    isPlaybackReady &&
    shuttleDirection === 0 &&
    loopPlaybackEnabled &&
    !segmentPlaybackEnabled &&
    !usesExternalAudio;

  const nativeLoopEnabledRef = useRef(nativeLoopEnabled);
  const shortcutActionsRef = useRef<{
    enabled: boolean;
    setSegmentBoundary: (boundary: TrimBoundary, origin?: DiagnosticOrigin) => void;
    startShuttle: (direction: FrameShuttleDirection, origin?: DiagnosticOrigin) => void;
    stepFrame: (direction: -1 | 1, origin?: DiagnosticOrigin) => void;
    stopShuttle: (origin?: DiagnosticOrigin) => void;
    togglePlayback: (origin?: DiagnosticOrigin) => void;
  } | null>(null);

  const removeAudioRuntime = useCallback(
    (streamIndex: number) => {
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
      node?.source.disconnect();
      node?.gain.disconnect();
      audioNodesRef.current.delete(streamIndex);
    },
    [setAudioReadiness],
  );

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
    if (nativeAudioBindingRef.current?.element !== currentVideo) {
      nativeAudioBindingRef.current = null;
    }
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
    cancelPlaybackFrame(playbackFrameRef);
    cancelFrame(reverseShuttleFrameRef);
    cancelFrame(scrubFrameRef);
    cancelFrame(frameStepSeekFrameRef);
    cancelFrame(trimCommitFrameRef);
    pendingScrubMicrosRef.current = null;
    pendingFrameStepSeekMicrosRef.current = null;
    pendingTrimCommitRef.current = null;
    timelineInteractionActiveRef.current = false;
    trimInteractionActiveRef.current = false;
    resumeAfterScrubRef.current = false;
    seekSchedulerRef.current?.dispose();
    seekSchedulerRef.current = null;
    shuttleDirectionRef.current = 0;
    cleanupAudioRuntime();
    // Source replacement is an explicit transport reset, not persisted editor state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShuttleDirection(0);
    setIsPlaying(false);
    setTransportError(null);
    // Snapshot activation restores the selected segment, so preview should begin at its boundary.
    currentPlayheadMicrosRef.current = trimRef.current.startMicros;
    setPlayheadMicros(trimRef.current.startMicros);
  }, [activeInstanceId, cleanupAudioRuntime, previewKey, sourcePath]);

  useEffect(() => {
    const activePlaybackRate = shuttleDirection === 1 ? FRAME_SHUTTLE_PLAYBACK_RATE : playbackSpeed;

    playbackRateRef.current = activePlaybackRate;

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
      const gainDb =
        liveAudioTrackGainsRef.current.get(streamIndex) ?? track?.processing.gainDb ?? 0;

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

    const exportAudioTracks = audioTracks.filter((track) => track.enabled);

    const audioStreams = media?.audioStreams ?? [];
    meter.normalizationGain.gain.value = meterMixNormalization(
      mergeAudio && usesExternalAudio,
      exportAudioTracks.length,
    );
    meter.isMono = isMonoAudioMix(
      exportAudioTracks.map(
        (track) =>
          audioStreams.find((stream) => stream.streamIndex === track.streamIndex)?.channels,
      ),
    );
  }, [audioTracks, mergeAudio, media?.audioStreams, usesExternalAudio]);

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
          liveAudioTrackGainsRef.current.get(track.streamIndex) ?? track.processing.gainDb;

        node.gain.gain.value = track.enabled ? 10 ** (gainDb / 20) : 0;
      }
    }
    if (nativeAudioBindingRef.current) {
      const gainDb = nativeAudioTrack
        ? (liveAudioTrackGainsRef.current.get(nativeAudioTrack.streamIndex) ??
          nativeAudioTrack.processing.gainDb)
        : 0;

      nativeAudioBindingRef.current.binding.gain.gain.value =
        nativeAudioTrack?.enabled && !requiresProcessedPreview ? 10 ** (gainDb / 20) : 0;
    } else if (videoRef.current) {
      const gainDb = nativeAudioTrack
        ? (liveAudioTrackGainsRef.current.get(nativeAudioTrack.streamIndex) ??
          nativeAudioTrack.processing.gainDb)
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

  useEffect(() => {
    let heldDirection: FrameShuttleDirection | 0 = 0;
    let shuttleStarted = false;

    function releaseHeldFrameShortcut(origin: DiagnosticOrigin) {
      if (shuttleStarted) shortcutActionsRef.current?.stopShuttle(origin);
      heldDirection = 0;
      shuttleStarted = false;
    }

    function handleEditorShortcut(event: globalThis.KeyboardEvent) {
      if (isApplicationInteractionBlocked() || timelineInteractionActiveRef.current) return;
      const actions = shortcutActionsRef.current;
      const shortcut = editorShortcutFromEvent(event);
      if (!actions?.enabled || !shortcut) return;
      if (event.defaultPrevented || shortcutDispositionFromEvent(event) !== "timeline") return;
      event.preventDefault();
      event.stopPropagation();
      const origin = { type: "hotkey" as const, id: event.key };
      const shuttleDirection =
        shortcut === "previous-frame" ? -1 : shortcut === "next-frame" ? 1 : 0;

      if (shuttleDirection !== 0) {
        if (event.repeat) {
          if (heldDirection === shuttleDirection && !shuttleStarted) {
            shuttleStarted = true;
            actions.startShuttle(shuttleDirection, origin);
          }
          return;
        }
        if (heldDirection !== 0) releaseHeldFrameShortcut(origin);
        heldDirection = shuttleDirection;
        actions.stepFrame(shuttleDirection, origin);
        return;
      }

      if (event.repeat) return;
      if (heldDirection !== 0) releaseHeldFrameShortcut(origin);
      if (shortcut === "toggle-playback") actions.togglePlayback(origin);
      if (shortcut === "set-segment-start") actions.setSegmentBoundary("start", origin);
      if (shortcut === "set-segment-end") actions.setSegmentBoundary("end", origin);
    }

    function handleEditorShortcutRelease(event: globalThis.KeyboardEvent) {
      const shortcut = editorShortcutFromEvent(event);
      const releasedDirection =
        shortcut === "previous-frame" ? -1 : shortcut === "next-frame" ? 1 : 0;

      if (releasedDirection === 0 || releasedDirection !== heldDirection) return;
      event.preventDefault();
      event.stopPropagation();
      releaseHeldFrameShortcut({ type: "hotkey", id: event.key });
    }

    function handleWindowBlur() {
      if (heldDirection !== 0) releaseHeldFrameShortcut({ type: "internal", id: "window-blur" });
    }

    window.addEventListener("keydown", handleEditorShortcut, true);
    window.addEventListener("keyup", handleEditorShortcutRelease, true);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleEditorShortcut, true);
      window.removeEventListener("keyup", handleEditorShortcutRelease, true);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  const stopPlayheadAnimation = useCallback(() => cancelPlaybackFrame(playbackFrameRef), []);
  const pauseAudioPlayback = useCallback(() => {
    for (const audio of audioElementsRef.current.values()) audio.pause();
  }, []);

  const syncAudioPlayback = useCallback((seconds: number, force = false) => {
    for (const audio of audioElementsRef.current.values())
      synchronizeAudioPosition(audio, seconds, playbackRateRef.current, force);
  }, []);

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
    playbackRateRef.current = playbackSpeed;
    for (const audio of audioElementsRef.current.values()) audio.playbackRate = playbackSpeed;
    pauseAudioPlayback();
    setIsPlaying(false);
    setShuttleDirection(0);
    stopPlayheadAnimation();
    setTransportError(t("preview.messages.playbackFailed"));
  }, [
    pauseAudioPlayback,
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
    syncAudioPlayback(seconds, true);
    const audio = [...audioElementsRef.current.values()];
    const resumeAudioContext = audioContextRef.current?.resume() ?? Promise.resolve();
    void Promise.all([resumeAudioContext, ...audio.map((element) => element.play())]).catch(() => {
      if (startSequence !== playbackStartSequenceRef.current) return;
      handlePlaybackStartFailure();
    });
  }, [handlePlaybackStartFailure, syncAudioPlayback]);

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
    [applyMediaSeek, setPlayheadMicros],
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
    [applyMediaSeek, flushFrameStepSeek, setPlayheadMicros],
  );

  const startMediaPlayback = useCallback(() => {
    flushFrameStepSeek();
    const video = videoRef.current;
    if (!video || !isPlaybackReadyRef.current) return;
    const startMicros = currentPlayheadMicrosRef.current;
    const startSequence = ++playbackStartSequenceRef.current;
    playbackRequestedRef.current = true;
    setTransportError(null);
    const resumeAudioContext = audioContextRef.current?.resume() ?? Promise.resolve();
    // Resume the audio context within the user gesture, but do not play stale seek frames.
    void resumeAudioContext.catch(() => {
      if (startSequence !== playbackStartSequenceRef.current) return;
      handlePlaybackStartFailure();
    });
    scheduleVideoSeek(startMicros, false, () => {
      if (startSequence !== playbackStartSequenceRef.current) return;
      syncAudioPlayback(startMicros / 1_000_000, true);
      const media = [video, ...audioElementsRef.current.values()];
      void Promise.all(media.map((element) => element.play())).catch(() => {
        if (startSequence !== playbackStartSequenceRef.current) return;
        handlePlaybackStartFailure();
      });
    });
  }, [
    flushFrameStepSeek,
    handlePlaybackStartFailure,
    scheduleVideoSeek,
    setTransportError,
    syncAudioPlayback,
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
  }, [handlePlaybackBoundary, stopPlayheadAnimation, syncAudioPlayback]);

  useEffect(() => {
    if (deferredAudioCleanupRef.current !== null) {
      window.clearTimeout(deferredAudioCleanupRef.current);
      deferredAudioCleanupRef.current = null;
    }

    return () => {
      playbackStartSequenceRef.current += 1;
      cancelPlaybackFrame(playbackFrameRef);
      cancelFrame(reverseShuttleFrameRef);
      cancelFrame(scrubFrameRef);
      cancelFrame(trimCommitFrameRef);
      pendingFrameStepSeekMicrosRef.current = null;
      seekSchedulerRef.current?.dispose();
      seekSchedulerRef.current = null;

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

  const setMediaPlaybackRate = useCallback((rate: number) => {
    playbackRateRef.current = rate;
    if (videoRef.current) videoRef.current.playbackRate = rate;
    for (const audio of audioElementsRef.current.values()) audio.playbackRate = rate;
  }, []);

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
  }, [handleShuttleEnd, playbackModes, scheduleVideoSeek]);

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

  const flushTrimCommit = useCallback(() => {
    cancelFrame(trimCommitFrameRef);
    const pendingTrim = pendingTrimCommitRef.current;
    pendingTrimCommitRef.current = null;
    if (pendingTrim && sourcePath) dispatch(trimChanged({ trim: pendingTrim }));
  }, [dispatch, sourcePath]);

  const queueTrimCommit = useCallback(
    (nextTrim: TrimRange) => {
      pendingTrimCommitRef.current = nextTrim;
      if (trimCommitFrameRef.current !== null) return;
      trimCommitFrameRef.current = requestAnimationFrame(() => {
        trimCommitFrameRef.current = null;
        const pendingTrim = pendingTrimCommitRef.current;
        pendingTrimCommitRef.current = null;
        if (pendingTrim && sourcePath) dispatch(trimChanged({ trim: pendingTrim }));
      });
    },
    [dispatch, sourcePath],
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

  const handleSetSegmentBoundary = useCallback(
    (boundary: TrimBoundary, origin: DiagnosticOrigin = { type: "internal" }) => {
      diagnostics.action("timeline.trim-boundary.requested", origin, { boundary });
      if (!sourcePath) {
        diagnostics.event("timeline.trim-boundary.ignored", {
          data: { boundary, reason: "source_unavailable" },
          origin,
          result: "ignored",
        });
        return;
      }
      const currentMicros = currentPlayheadMicrosRef.current;
      if (!canSetTrimBoundaryAtPlayhead(trimRef.current, boundary, currentMicros)) {
        diagnostics.event("timeline.trim-boundary.ignored", {
          data: { boundary, reason: "outside_trim_range" },
          origin,
          result: "ignored",
        });
        return;
      }
      const nextTrim = setTrimBoundaryAtPlayhead(trimRef.current, boundary, currentMicros);
      trimRef.current = nextTrim;
      flushTrimCommit();
      dispatch(trimChanged({ trim: nextTrim }));
      diagnostics.event("timeline.trim-boundary.changed", {
        data: { boundary, micros: currentMicros },
        origin,
      });
    },
    [dispatch, flushTrimCommit, sourcePath],
  );

  const handleTrimBoundaryChange = useCallback(
    (_boundary: TrimBoundary, nextTrim: TrimRange) => {
      trimRef.current = nextTrim;
      queueTrimCommit(nextTrim);
    },
    [queueTrimCommit],
  );

  const handleSegmentMove = useCallback(
    (nextTrim: TrimRange) => {
      trimRef.current = nextTrim;
      queueTrimCommit(nextTrim);
    },
    [queueTrimCommit],
  );

  const handleSegmentDragStart = useCallback(() => {
    trimInteractionActiveRef.current = true;
    handleScrubStart();
  }, [handleScrubStart]);

  const handleSegmentDragEnd = useCallback(() => {
    flushTrimCommit();
    dispatch(commitActiveEditingInstanceDraft());
    handleScrubEnd();
  }, [dispatch, flushTrimCommit, handleScrubEnd]);

  const handleTrimDragEnd = useCallback(() => {
    flushTrimCommit();
    dispatch(commitActiveEditingInstanceDraft());
    handleScrubEnd();
  }, [dispatch, flushTrimCommit, handleScrubEnd]);

  const handleTrimDragStart = useCallback(() => {
    trimInteractionActiveRef.current = true;
    handleScrubStart();
  }, [handleScrubStart]);

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
    [handlePlaybackBoundary, setPlayheadMicros, stopPlayheadAnimation],
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

  useEffect(() => {
    shortcutActionsRef.current = {
      enabled: isPlaybackReady,
      togglePlayback: handleTogglePlayback,
      stepFrame: handleStepFrame,
      startShuttle: handleShuttleStart,
      stopShuttle: handleShuttleEnd,
      setSegmentBoundary: handleSetSegmentBoundary,
    };
  }, [
    handleSetSegmentBoundary,
    handleShuttleEnd,
    handleShuttleStart,
    handleStepFrame,
    handleTogglePlayback,
    isPlaybackReady,
  ]);

  return {
    videoRef,
    playheadRef,
    audioPlayheadRef,
    displayedPlayheadMicros,
    isPlaying,
    audioMeterRef,
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
    onSetSegmentBoundary: handleSetSegmentBoundary,
    onTrimBoundaryChange: handleTrimBoundaryChange,
    onSegmentMove: handleSegmentMove,
    onTrimDragStart: handleTrimDragStart,
    onTrimDragEnd: handleTrimDragEnd,
    onSegmentDragStart: handleSegmentDragStart,
    onSegmentDragEnd: handleSegmentDragEnd,
    onSeek: commitSeek,
    onScrubStart: handleScrubStart,
    onScrub: queueScrubSeek,
    onScrubEnd: handleScrubEnd,
    onCropToolOpenChange,
    onPreviewPlaybackError,
    setMediaPlaybackRate,
    setLiveAudioTrackGain,
    clearLiveAudioTrackGain,
    setVideoElement,
    canSetSegmentStart: canSetTrimBoundaryAtPlayhead(trim, "start", displayedPlayheadMicros),
    canSetSegmentEnd: canSetTrimBoundaryAtPlayhead(trim, "end", displayedPlayheadMicros),
  };
}

export { useEditorInteractionController };

export type { EditorInteractionRuntime };
