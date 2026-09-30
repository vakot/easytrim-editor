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
import { PreviewRuntimeContext } from "@/features/preview/contexts/preview-runtime-context";
// eslint-disable-next-line no-restricted-imports -- Test runtime provider supplies feature-owned contexts.
import {
  TimelinePlaybackContext,
  type TimelinePlaybackContract,
} from "@/features/timeline/contexts/timeline-playback-context";

const noOperation = () => undefined;
const videoRef: RefObject<HTMLVideoElement | null> = { current: null };
const playheadRef: RefObject<HTMLButtonElement | null> = { current: null };

const timelinePlayback = {
  canInteract: false,
  canSetSegmentEnd: false,
  canSetSegmentStart: false,
  displayedPlayheadMicros: 0,
  isPlaying: false,
  onEnded: noOperation,
  onLoadedMetadata: noOperation,
  onPause: noOperation,
  onPlay: noOperation,
  onScrub: noOperation,
  onScrubEnd: noOperation,
  onScrubStart: noOperation,
  onSeek: noOperation,
  onSegmentDragEnd: noOperation,
  onSegmentDragStart: noOperation,
  onSegmentMove: noOperation,
  onSetSegmentBoundary: noOperation,
  onTimeUpdate: noOperation,
  onTrimBoundaryChange: noOperation,
  onTrimDragEnd: noOperation,
  onTrimDragStart: noOperation,
  pause: noOperation,
  playheadRef,
  shuttleDirection: 0,
  transportError: null,
  stepFrame: noOperation,
  startShuttle: noOperation,
  stopShuttle: noOperation,
  toggle: noOperation,
} satisfies TimelinePlaybackContract;

const preview = {
  isPreviewReady: false,
  onCanPlay: noOperation,
  onPreviewPlaybackError: noOperation,
  previewKey: null,
  setVideoElement: (element: HTMLVideoElement | null) => {
    videoRef.current = element;
  },
  videoRef,
};

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
          <TimelinePlaybackContext.Provider value={timelinePlayback}>
            {children}
          </TimelinePlaybackContext.Provider>
        </AudioTransportContext.Provider>
      </AudioPlaybackContext.Provider>
    </PreviewRuntimeContext.Provider>
  );
}

export { EditorRuntimeTestProvider };
