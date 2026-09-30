import type { ReactNode, RefObject } from "react";

// eslint-disable-next-line no-restricted-imports -- Test runtime provider supplies feature-owned contexts.
import {
  AudioPlaybackContext,
  type AudioPlaybackContract,
} from "@/features/audio/contexts/audio-playback-context";
// eslint-disable-next-line no-restricted-imports -- Test runtime provider supplies feature-owned contexts.
import {
  AudioTransportContext,
  type AudioTransportContract,
} from "@/features/audio/contexts/audio-transport-context";
// eslint-disable-next-line no-restricted-imports -- Test runtime provider supplies feature-owned contexts.
import {
  PreviewRuntimeContext,
  type PreviewRuntimeContract,
} from "@/features/preview/contexts/preview-runtime-context";
// eslint-disable-next-line no-restricted-imports -- Test runtime provider supplies feature-owned contexts.
import {
  TimelineEditingContext,
  type TimelineEditingContract,
  TimelinePlayheadContext,
  type TimelinePlayheadContract,
  TimelineReadinessContext,
  type TimelineReadinessContract,
  TimelineTransportContext,
  type TimelineTransportContract,
} from "@/features/timeline/contexts/timeline-runtime-contexts";

const noOperation = () => undefined;
const videoRef: RefObject<HTMLVideoElement | null> = { current: null };
const playheadRef: RefObject<HTMLButtonElement | null> = { current: null };

const timelineEditing = {
  canSetSegmentEnd: false,
  canSetSegmentStart: false,
  onScrub: noOperation,
  onScrubEnd: noOperation,
  onScrubStart: noOperation,
  onSeek: noOperation,
  onSegmentDragEnd: noOperation,
  onSegmentDragStart: noOperation,
  onSegmentMove: noOperation,
  onSetSegmentBoundary: noOperation,
  onTrimBoundaryChange: noOperation,
  onTrimDragEnd: noOperation,
  onTrimDragStart: noOperation,
} satisfies TimelineEditingContract;

const timelinePlayhead = {
  displayedPlayheadMicros: 0,
  playheadRef,
} satisfies TimelinePlayheadContract;

const timelineReadiness = { canInteract: false } satisfies TimelineReadinessContract;

const timelineTransport = {
  isPlaying: false,
  pause: noOperation,
  resumeAfterInteraction: noOperation,
  shuttleDirection: 0,
  stepFrame: noOperation,
  startShuttle: noOperation,
  stopShuttle: noOperation,
  suspendForInteraction: () => false,
  toggle: noOperation,
  transportError: null,
} satisfies TimelineTransportContract;

const preview = {
  isPreviewReady: false,
  isNativeLoopEnabled: false,
  onEnded: noOperation,
  onLoadedMetadata: noOperation,
  onPause: noOperation,
  onPlay: noOperation,
  onPlaybackError: noOperation,
  onTimeUpdate: noOperation,
  onCanPlay: noOperation,
  onPreviewPlaybackError: noOperation,
  previewKey: null,
  getMediaState: () => null,
  isSeekPending: () => false,
  pauseMedia: noOperation,
  playMedia: async () => undefined,
  requestPlaybackFrame: () => null,
  registerMediaObserver: () => noOperation,
  seekMedia: noOperation,
  setNativeLoopEnabled: noOperation,
  setPlaybackRate: noOperation,
  setVideoElement: (element: HTMLVideoElement | null) => {
    if (videoRef.current && videoRef.current !== element) videoRef.current.pause();
    videoRef.current = element;
  },
  videoRef,
} satisfies PreviewRuntimeContract;

const audioPlayback = {
  audioMeterRef: { current: null },
  audioPlayheadRef: { current: null },
  clearLiveAudioTrackGain: noOperation,
  setLiveAudioTrackGain: noOperation,
} satisfies AudioPlaybackContract;

function EditorRuntimeTestProvider({
  children,
  usesExternalAudio = false,
}: {
  children: ReactNode;
  usesExternalAudio?: boolean;
}) {
  const audioTransport = {
    isReady: false,
    pause: noOperation,
    resumeAt: async () => [undefined, []],
    resumeAudioContext: async () => undefined,
    setPlaybackRate: noOperation,
    startAt: async () => [],
    syncTo: noOperation,
    usesExternalAudio,
  } satisfies AudioTransportContract;

  return (
    <PreviewRuntimeContext.Provider value={preview}>
      <AudioPlaybackContext.Provider value={audioPlayback}>
        <AudioTransportContext.Provider value={audioTransport}>
          <TimelinePlayheadContext.Provider value={timelinePlayhead}>
            <TimelineEditingContext.Provider value={timelineEditing}>
              <TimelineReadinessContext.Provider value={timelineReadiness}>
                <TimelineTransportContext.Provider value={timelineTransport}>
                  {children}
                </TimelineTransportContext.Provider>
              </TimelineReadinessContext.Provider>
            </TimelineEditingContext.Provider>
          </TimelinePlayheadContext.Provider>
        </AudioTransportContext.Provider>
      </AudioPlaybackContext.Provider>
    </PreviewRuntimeContext.Provider>
  );
}

export { EditorRuntimeTestProvider };
