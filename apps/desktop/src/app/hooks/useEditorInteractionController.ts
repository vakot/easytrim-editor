import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { usePlaybackModes } from "@/app/hooks/usePlaybackModes";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectAudioPreviews,
  selectAudioTracks,
  selectMasterAudio,
} from "@/app/store/slices/audio-slice";
import {
  selectLoopPlaybackEnabled,
  selectPlaybackSpeed,
  selectSegmentPlaybackEnabled,
  selectSnapPlaybackEnabled,
} from "@/app/store/slices/editor-tools-slice";
import { selectPreview } from "@/app/store/slices/preview-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim, trimChanged } from "@/app/store/slices/trim-slice";
import { handlePreviewPlaybackError as handlePreviewPlaybackErrorRequested } from "@/app/store/thunks/source-media-thunks";
import { clampPlaybackMicros, frameDurationMicros } from "@/domain/playback";
import {
  canSetTrimBoundaryAtPlayhead,
  playheadAfterSegmentMove,
  playheadFollowAfterTrimBoundaryMove,
  setTrimBoundaryAtPlayhead,
  type TrimBoundary,
  type TrimRange,
} from "@/domain/trim";
import {
  connectNativeAudioBinding,
  disconnectNativeAudioBinding,
  getOrCreateNativeAudioBinding,
  type NativeAudioBinding,
  synchronizeAudioPosition,
} from "@/features/audio";
import {
  cancelPlaybackFrame,
  type PlaybackFrameHandle,
  requestPlaybackFrame,
  seekVideo,
} from "@/features/preview";
import {
  cancelFrame,
  editorShortcutFromEvent,
  isShortcutBlockedTarget,
  syncPlayheadElements,
} from "@/features/timeline";
import { isApplicationDialogOpen } from "@/lib/hotkeys.utils";
import { seekMediaIfNeeded } from "@/lib/media-element.utils";

const EMPTY_TRIM: TrimRange = {
  startMicros: 0,
  endMicros: 0,
  sourceDurationMicros: 0,
};

const AUDIO_SYNC_INTERVAL_MS = 100;

export interface EditorInteractionRuntime {
  audioPlayheadRef: React.RefObject<HTMLDivElement | null>;
  canSetSegmentEnd: boolean;
  canSetSegmentStart: boolean;
  displayedPlayheadMicros: number;
  isPlaybackReady: boolean;
  isPlaying: boolean;
  nativeLoopEnabled: boolean;
  onCanPlay: () => void;
  onCropToolOpenChange: (isOpen: boolean) => void;
  onEnded: () => void;
  onLoadedMetadata: () => void;
  onPause: () => void;
  onPlay: () => void;
  onPreviewPlaybackError: (previewKind: "source" | "proxy") => void;
  onScrub: (micros: number) => void;
  onScrubEnd: () => void;
  onScrubStart: () => void;
  onSeek: (micros: number) => void;
  onSegmentDragEnd: () => void;
  onSegmentDragStart: () => void;
  onSegmentMove: (nextTrim: TrimRange) => TrimBoundary | null;
  onSetSegmentBoundary: (boundary: TrimBoundary) => void;
  onStepFrame: (direction: -1 | 1) => void;
  onTimeUpdate: (seconds: number) => void;
  onTogglePlayback: () => void;
  onTrimBoundaryChange: (boundary: TrimBoundary, nextTrim: TrimRange) => TrimBoundary | null;
  onTrimDragEnd: () => void;
  onTrimDragStart: () => void;
  playheadRef: React.RefObject<HTMLButtonElement | null>;
  transportError: string | null;
  videoMuted: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function useEditorInteractionController(): EditorInteractionRuntime {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const snapPlaybackEnabled = useAppSelector(selectSnapPlaybackEnabled);
  const loopPlaybackEnabled = useAppSelector(selectLoopPlaybackEnabled);
  const segmentPlaybackEnabled = useAppSelector(selectSegmentPlaybackEnabled);
  const playbackSpeed = useAppSelector(selectPlaybackSpeed);
  const sourceSelection = useAppSelector(selectSourceSelection);
  const media = useAppSelector(selectSourceMedia);
  const trim = useAppSelector(selectTrim) ?? EMPTY_TRIM;
  const preview = useAppSelector(selectPreview);
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;
  const audioTracks = useAppSelector(selectAudioTracks);
  const masterAudio = useAppSelector(selectMasterAudio);
  const audioPreviewState = useAppSelector(selectAudioPreviews);
  const audioPreviewUrls = useMemo(
    () =>
      Object.fromEntries(
        (audioPreviewState?.previews ?? []).map((preview) => [preview.streamIndex, preview.url]),
      ),
    [audioPreviewState?.previews],
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

  const usesExternalAudio =
    audioPreviewState?.status === "ready" &&
    activeExternalAudioStreamCount === enabledAudioTracks.length &&
    enabledAudioTracks.length > 0 &&
    (enabledAudioTracks.length > 1 || nativeAudioTrack === undefined);

  const previewKey =
    sourcePath && preview.status === "ready" ? `${sourcePath}:${preview.value.url}` : null;

  const [playheadMicros, setPlayheadMicros] = useState(trim.startMicros);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transportError, setTransportError] = useState<string | null>(null);
  const [readyPreviewKey, setReadyPreviewKey] = useState<string | null>(null);
  const [audioReadiness, setAudioReadiness] = useState<{
    sourcePath: string | null;
    streamIndexes: Set<number>;
  }>(() => ({ sourcePath: null, streamIndexes: new Set() }));

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioElementsRef = useRef(new Map<number, HTMLAudioElement>());
  const audioReadyListenersRef = useRef(new Map<number, () => void>());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioNodesRef = useRef(
    new Map<number, { gain: GainNode; source: MediaElementAudioSourceNode }>(),
  );

  const nativeAudioBindingsRef = useRef(new Map<HTMLVideoElement, NativeAudioBinding>());
  const nativeAudioBindingRef = useRef<{
    binding: NativeAudioBinding;
    element: HTMLVideoElement;
  } | null>(null);

  const masterGainRef = useRef<GainNode | null>(null);
  const playheadRef = useRef<HTMLButtonElement>(null);
  const audioPlayheadRef = useRef<HTMLDivElement>(null);
  const playbackFrameRef = useRef<PlaybackFrameHandle | null>(null);
  const scrubFrameRef = useRef<number | null>(null);
  const pendingScrubMicrosRef = useRef<number | null>(null);
  const trimCommitFrameRef = useRef<number | null>(null);
  const pendingTrimCommitRef = useRef<TrimRange | null>(null);
  const resumeAfterScrubRef = useRef(false);
  const timelineInteractionActiveRef = useRef(false);
  const playbackStartSequenceRef = useRef(0);
  const playbackRequestedRef = useRef(false);
  const isPlayingRef = useRef(false);
  const resumeAfterCropRef = useRef(false);
  const lastPlaybackCommitAtRef = useRef(0);
  const lastAudioSyncAtRef = useRef(0);
  const trimRef = useRef(trim);
  const currentPlayheadMicrosRef = useRef(trim.startMicros);
  const segmentDragActiveRef = useRef(false);
  const segmentFollowBoundaryRef = useRef<TrimBoundary | null>(null);
  const playbackRateRef = useRef(playbackSpeed);
  const isPlaybackReady =
    previewKey !== null &&
    readyPreviewKey === previewKey &&
    audioPreviewState?.status !== "loading" &&
    (!usesExternalAudio ||
      (audioReadiness.sourcePath === sourcePath &&
        audioReadiness.streamIndexes.size === activeExternalAudioStreamCount));

  const isPlaybackReadyRef = useRef(isPlaybackReady);
  const nativeLoopEnabled =
    isPlaybackReady && loopPlaybackEnabled && !segmentPlaybackEnabled && !usesExternalAudio;

  const nativeLoopEnabledRef = useRef(nativeLoopEnabled);
  const shortcutActionsRef = useRef<{
    enabled: boolean;
    setSegmentBoundary: (boundary: TrimBoundary) => void;
    stepFrame: (direction: -1 | 1) => void;
    togglePlayback: () => void;
  } | null>(null);

  const removeAudioRuntime = useCallback((streamIndex: number) => {
    const element = audioElementsRef.current.get(streamIndex);
    if (element) {
      element.pause();
      const readyListener = audioReadyListenersRef.current.get(streamIndex);
      if (readyListener) element.removeEventListener("canplay", readyListener);
      element.remove();
    }
    audioElementsRef.current.delete(streamIndex);
    audioReadyListenersRef.current.delete(streamIndex);
    setAudioReadiness((current) => {
      if (!current.streamIndexes.has(streamIndex)) return current;
      const streamIndexes = new Set(current.streamIndexes);
      streamIndexes.delete(streamIndex);
      return { ...current, streamIndexes };
    });
    const node = audioNodesRef.current.get(streamIndex);
    node?.source.disconnect();
    node?.gain.disconnect();
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
    disconnectCurrentNativeAudioRoute();
    masterGainRef.current?.disconnect();
    masterGainRef.current = null;
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
    playbackRateRef.current = playbackSpeed;
  }, [isPlaybackReady, nativeLoopEnabled, playbackSpeed]);

  const playbackModes = usePlaybackModes({
    loopEnabled: loopPlaybackEnabled,
    segmentEnabled: segmentPlaybackEnabled,
  });

  const displayedPlayheadMicros = clampPlaybackMicros(playheadMicros, trim.sourceDurationMicros);

  useEffect(() => {
    playbackStartSequenceRef.current += 1;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    currentPlayheadMicrosRef.current = 0;
    videoRef.current?.pause();
    cancelPlaybackFrame(playbackFrameRef);
    cleanupAudioRuntime();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReadyPreviewKey(null);
    setAudioReadiness({ sourcePath: null, streamIndexes: new Set() });
    // Source replacement is an explicit transport reset, not persisted editor state.
    setIsPlaying(false);
    setTransportError(null);
    setPlayheadMicros(0);
  }, [cleanupAudioRuntime, previewKey, sourcePath]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = playbackSpeed;
    for (const audio of audioElementsRef.current.values()) audio.playbackRate = playbackSpeed;
  }, [audioPreviewUrls, playbackSpeed]);

  useEffect(() => {
    if (!sourcePath || audioTracks.length === 0 || typeof AudioContext === "undefined") {
      cleanupAudioRuntime();
      cleanupStaleNativeAudioBindings(videoRef.current);
      return;
    }
    const context = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = context;
    let masterGain = masterGainRef.current;
    if (!masterGain) {
      masterGain = context.createGain();
      masterGainRef.current = masterGain;
      masterGain.connect(context.destination);
    }

    const activeExternalAudioUrls = usesExternalAudio
      ? Object.fromEntries(
          Object.entries(audioPreviewUrls).filter(([streamIndexText]) =>
            audioTracks.some(
              (track) => track.streamIndex === Number(streamIndexText) && track.enabled,
            ),
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
          const indexes =
            current.sourcePath === sourcePath ? new Set(current.streamIndexes) : new Set<number>();

          if (indexes.has(streamIndex)) return current;
          indexes.add(streamIndex);
          return { sourcePath, streamIndexes: indexes };
        });
      };

      element.addEventListener("canplay", markReady, { once: true });
      audioReadyListenersRef.current.set(streamIndex, markReady);
      document.body.appendChild(element);
      const audioSource = context.createMediaElementSource(element);
      const gain = context.createGain();
      audioSource.connect(gain).connect(masterGain);
      audioElementsRef.current.set(streamIndex, element);
      audioNodesRef.current.set(streamIndex, { source: audioSource, gain });
      if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) markReady();
    }

    const video = videoRef.current;
    cleanupStaleNativeAudioBindings(video);
    if (!video) {
      disconnectCurrentNativeAudioRoute();
    } else {
      const binding = getOrCreateNativeAudioBinding(nativeAudioBindingsRef.current, context, video);
      connectNativeAudioBinding(binding, masterGain);
      nativeAudioBindingRef.current = { element: video, binding };
    }
  }, [
    audioPreviewUrls,
    audioTracks,
    cleanupAudioRuntime,
    cleanupStaleNativeAudioBindings,
    disconnectCurrentNativeAudioRoute,
    readyPreviewKey,
    removeAudioRuntime,
    sourcePath,
    playbackSpeed,
    usesExternalAudio,
  ]);

  useEffect(() => {
    const masterGain = masterGainRef.current;
    if (masterGain)
      masterGain.gain.value = masterAudio.enabled ? masterAudio.volumePercent / 50 : 0;
    for (const track of audioTracks) {
      const node = audioNodesRef.current.get(track.streamIndex);
      if (node) node.gain.gain.value = track.enabled ? track.volumePercent / 50 : 0;
    }
    if (nativeAudioBindingRef.current) {
      nativeAudioBindingRef.current.binding.gain.gain.value = nativeAudioTrack?.enabled
        ? nativeAudioTrack.volumePercent / 50
        : 0;
    } else if (videoRef.current && nativeAudioTrack) {
      const combinedGain =
        (masterAudio.enabled ? masterAudio.volumePercent / 50 : 0) *
        (nativeAudioTrack.enabled ? nativeAudioTrack.volumePercent / 50 : 0);

      videoRef.current.volume = Math.min(1, combinedGain);
    }
  }, [
    audioPreviewUrls,
    audioTracks,
    nativeAudioTrack,
    readyPreviewKey,
    masterAudio.enabled,
    masterAudio.volumePercent,
  ]);

  useEffect(() => {
    function handleEditorShortcut(event: globalThis.KeyboardEvent) {
      if (isApplicationDialogOpen() || timelineInteractionActiveRef.current) return;
      const actions = shortcutActionsRef.current;
      const shortcut = editorShortcutFromEvent(event);
      if (!actions?.enabled || !shortcut) return;
      const isPriorityShortcut = shortcut === "toggle-playback";
      if (!isPriorityShortcut && (event.defaultPrevented || isShortcutBlockedTarget(event.target)))
        return;
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat && shortcut !== "previous-frame" && shortcut !== "next-frame") return;
      if (shortcut === "toggle-playback") actions.togglePlayback();
      if (shortcut === "previous-frame") actions.stepFrame(-1);
      if (shortcut === "next-frame") actions.stepFrame(1);
      if (shortcut === "set-segment-start") actions.setSegmentBoundary("start");
      if (shortcut === "set-segment-end") actions.setSegmentBoundary("end");
    }
    window.addEventListener("keydown", handleEditorShortcut, true);
    return () => window.removeEventListener("keydown", handleEditorShortcut, true);
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
    videoRef.current?.pause();
    pauseAudioPlayback();
    setIsPlaying(false);
    stopPlayheadAnimation();
    setTransportError(t("preview.messages.playbackFailed"));
  }, [pauseAudioPlayback, stopPlayheadAnimation, t]);

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

  const commitSeek = useCallback((micros: number) => {
    const clamped = clampPlaybackMicros(micros, trimRef.current.sourceDurationMicros);
    currentPlayheadMicrosRef.current = clamped;
    syncPlayheadElements(
      playheadRef.current,
      audioPlayheadRef.current,
      clamped,
      trimRef.current.sourceDurationMicros,
    );
    setPlayheadMicros(clamped);
    seekVideo(videoRef.current, clamped);
    for (const audio of audioElementsRef.current.values())
      seekMediaIfNeeded(audio, clamped / 1_000_000);
  }, []);

  const startMediaPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isPlaybackReadyRef.current) return;
    const startMicros = currentPlayheadMicrosRef.current;
    const startSequence = ++playbackStartSequenceRef.current;
    playbackRequestedRef.current = true;
    setTransportError(null);
    seekVideo(video, startMicros);
    syncAudioPlayback(startMicros / 1_000_000, true);
    const media = [video, ...audioElementsRef.current.values()];
    const resumeAudioContext = audioContextRef.current?.resume() ?? Promise.resolve();
    void Promise.all([resumeAudioContext, ...media.map((element) => element.play())]).catch(() => {
      if (startSequence !== playbackStartSequenceRef.current) return;
      handlePlaybackStartFailure();
    });
  }, [handlePlaybackStartFailure, syncAudioPlayback]);

  const handlePlaybackBoundary = useCallback(
    (currentMicros: number): boolean => {
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
    [commitSeek, pauseAudioPlayback, playbackModes, startMediaPlayback, stopPlayheadAnimation],
  );

  const startPlayheadAnimation = useCallback(() => {
    stopPlayheadAnimation();
    const update = (timestamp: number, mediaTimeSeconds: number) => {
      const video = videoRef.current;
      if (!video || video.paused) {
        playbackFrameRef.current = null;
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

  useEffect(
    () => () => {
      playbackStartSequenceRef.current += 1;
      cancelPlaybackFrame(playbackFrameRef);
      cancelFrame(scrubFrameRef);
      cancelFrame(trimCommitFrameRef);
      cleanupAudioRuntime();
      cleanupAllNativeAudioBindings();
      void audioContextRef.current?.close();
    },
    [cleanupAllNativeAudioBindings, cleanupAudioRuntime],
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
      scrubFrameRef.current = requestAnimationFrame(() => {
        scrubFrameRef.current = null;
        const pendingMicros = pendingScrubMicrosRef.current;
        pendingScrubMicrosRef.current = null;
        if (pendingMicros !== null) commitSeek(pendingMicros);
      });
    },
    [commitSeek],
  );

  const flushScrubSeek = useCallback(() => {
    cancelFrame(scrubFrameRef);
    const pendingMicros = pendingScrubMicrosRef.current;
    pendingScrubMicrosRef.current = null;
    if (pendingMicros !== null) commitSeek(pendingMicros);
  }, [commitSeek]);

  const handleScrubStart = useCallback(() => {
    timelineInteractionActiveRef.current = true;
    playbackStartSequenceRef.current += 1;
    resumeAfterScrubRef.current = playbackRequestedRef.current || isPlayingRef.current;
    playbackRequestedRef.current = false;
    isPlayingRef.current = false;
    videoRef.current?.pause();
    pauseAudioPlayback();
    setIsPlaying(false);
    stopPlayheadAnimation();
  }, [pauseAudioPlayback, stopPlayheadAnimation]);

  const handleScrubEnd = useCallback(() => {
    flushScrubSeek();
    timelineInteractionActiveRef.current = false;
    if (resumeAfterScrubRef.current) {
      resumeAfterScrubRef.current = false;
      playbackModes.startMicros(currentPlayheadMicrosRef.current, trimRef.current);
      playbackModes.resetBoundary();
      startMediaPlayback();
    }
  }, [flushScrubSeek, playbackModes, startMediaPlayback]);

  const handleTogglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isPlaybackReadyRef.current) return;
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
  }, [commitSeek, playbackModes, startMediaPlayback]);

  const handleStepFrame = useCallback(
    (direction: -1 | 1) => {
      playbackStartSequenceRef.current += 1;
      playbackRequestedRef.current = false;
      isPlayingRef.current = false;
      videoRef.current?.pause();
      setIsPlaying(false);
      stopPlayheadAnimation();
      commitSeek(currentPlayheadMicrosRef.current + direction * frameDurationMicros(frameRate));
    },
    [commitSeek, frameRate, stopPlayheadAnimation],
  );

  const handleSetSegmentBoundary = useCallback(
    (boundary: TrimBoundary) => {
      if (!sourcePath) return;
      const currentMicros = currentPlayheadMicrosRef.current;
      if (!canSetTrimBoundaryAtPlayhead(trimRef.current, boundary, currentMicros)) return;
      const nextTrim = setTrimBoundaryAtPlayhead(trimRef.current, boundary, currentMicros);
      trimRef.current = nextTrim;
      flushTrimCommit();
      dispatch(trimChanged({ trim: nextTrim }));
    },
    [dispatch, flushTrimCommit, sourcePath],
  );

  const handleTrimBoundaryChange = useCallback(
    (boundary: TrimBoundary, nextTrim: TrimRange) => {
      const currentMicros = currentPlayheadMicrosRef.current;
      const follow = snapPlaybackEnabled
        ? playheadFollowAfterTrimBoundaryMove(trimRef.current, nextTrim, boundary, currentMicros)
        : { playheadMicros: currentMicros, boundary: null };

      trimRef.current = nextTrim;
      queueTrimCommit(nextTrim);
      if (follow.playheadMicros !== currentMicros) queueScrubSeek(follow.playheadMicros);
      return follow.boundary;
    },
    [queueScrubSeek, queueTrimCommit, snapPlaybackEnabled],
  );

  const handleSegmentMove = useCallback(
    (nextTrim: TrimRange) => {
      const currentMicros = currentPlayheadMicrosRef.current;
      const follow =
        snapPlaybackEnabled && segmentDragActiveRef.current
          ? playheadAfterSegmentMove(
              trimRef.current,
              nextTrim,
              currentMicros,
              segmentFollowBoundaryRef.current,
            )
          : { playheadMicros: currentMicros, boundary: null };

      segmentFollowBoundaryRef.current = follow.boundary;
      trimRef.current = nextTrim;
      queueTrimCommit(nextTrim);
      if (follow.playheadMicros !== currentMicros) queueScrubSeek(follow.playheadMicros);
      return follow.boundary;
    },
    [queueScrubSeek, queueTrimCommit, snapPlaybackEnabled],
  );

  const handleSegmentDragStart = useCallback(() => {
    segmentDragActiveRef.current = true;
    segmentFollowBoundaryRef.current = null;
    handleScrubStart();
  }, [handleScrubStart]);

  const handleSegmentDragEnd = useCallback(() => {
    segmentDragActiveRef.current = false;
    segmentFollowBoundaryRef.current = null;
    flushTrimCommit();
    handleScrubEnd();
  }, [flushTrimCommit, handleScrubEnd]);

  const handleTrimDragEnd = useCallback(() => {
    flushTrimCommit();
    handleScrubEnd();
  }, [flushTrimCommit, handleScrubEnd]);

  const onTimeUpdate = useCallback(
    (seconds: number) => {
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
      syncAudioPlayback(seconds, true);
      if (currentMicros >= trimRef.current.sourceDurationMicros) stopPlayheadAnimation();
    },
    [handlePlaybackBoundary, stopPlayheadAnimation, syncAudioPlayback],
  );

  const onPause = useCallback(() => {
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
  }, [onTimeUpdate, pauseAudioPlayback, stopPlayheadAnimation]);

  const onCropToolOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
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
    [pauseAudioPlayback, startMediaPlayback, stopPlayheadAnimation],
  );

  const onPreviewPlaybackError = useCallback(
    (previewKind: "source" | "proxy") => {
      playbackStartSequenceRef.current += 1;
      playbackRequestedRef.current = false;
      isPlayingRef.current = false;
      videoRef.current?.pause();
      pauseAudioPlayback();
      setIsPlaying(false);
      stopPlayheadAnimation();
      if (sourcePath) void dispatch(handlePreviewPlaybackErrorRequested(sourcePath, previewKind));
    },
    [dispatch, pauseAudioPlayback, sourcePath, stopPlayheadAnimation],
  );

  useEffect(() => {
    shortcutActionsRef.current = {
      enabled: isPlaybackReady,
      togglePlayback: handleTogglePlayback,
      stepFrame: handleStepFrame,
      setSegmentBoundary: handleSetSegmentBoundary,
    };
  }, [handleSetSegmentBoundary, handleStepFrame, handleTogglePlayback, isPlaybackReady]);

  return {
    videoRef,
    playheadRef,
    audioPlayheadRef,
    displayedPlayheadMicros,
    isPlaying,
    isPlaybackReady,
    transportError,
    nativeLoopEnabled,
    videoMuted: usesExternalAudio && typeof AudioContext === "undefined",
    onLoadedMetadata: () => commitSeek(displayedPlayheadMicros),
    onCanPlay: () => {
      if (previewKey) setReadyPreviewKey(previewKey);
    },
    onPlay: () => {
      playbackRequestedRef.current = true;
      isPlayingRef.current = true;
      setIsPlaying(true);
      startPlayheadAnimation();
    },
    onPause,
    onTimeUpdate,
    onEnded: () => {
      if (videoRef.current) handlePlaybackBoundary(videoRef.current.currentTime * 1_000_000);
    },
    onTogglePlayback: handleTogglePlayback,
    onStepFrame: handleStepFrame,
    onSetSegmentBoundary: handleSetSegmentBoundary,
    onTrimBoundaryChange: handleTrimBoundaryChange,
    onSegmentMove: handleSegmentMove,
    onTrimDragStart: handleScrubStart,
    onTrimDragEnd: handleTrimDragEnd,
    onSegmentDragStart: handleSegmentDragStart,
    onSegmentDragEnd: handleSegmentDragEnd,
    onSeek: commitSeek,
    onScrubStart: handleScrubStart,
    onScrub: queueScrubSeek,
    onScrubEnd: handleScrubEnd,
    onCropToolOpenChange,
    onPreviewPlaybackError,
    canSetSegmentStart: canSetTrimBoundaryAtPlayhead(trim, "start", displayedPlayheadMicros),
    canSetSegmentEnd: canSetTrimBoundaryAtPlayhead(trim, "end", displayedPlayheadMicros),
  };
}
