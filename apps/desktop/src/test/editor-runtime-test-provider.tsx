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
  PlaybackTransportContext,
  type PlaybackTransport,
  TimelineFrameContext,
  type TimelineFrameState,
} from "@/features/timeline/contexts/timeline-runtime-contexts";

const noOperation = () => undefined;
const videoRef: RefObject<HTMLVideoElement | null> = { current: null };
const timelineTransport = {
  isPlaying: false,
  setIsPlaying: noOperation,
} satisfies PlaybackTransport;

const timelineFrameState = {
  currentFrame: 0,
  framesCount: 0,
  setCurrentFrame: noOperation,
} satisfies TimelineFrameState;

const preview = {
  isPreviewReady: false,
  onEnded: noOperation,
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
  setPlaybackRate: noOperation,
  setVideoElement: (element: HTMLVideoElement | null) => {
    if (videoRef.current && videoRef.current !== element) videoRef.current.pause();
    videoRef.current = element;
  },
  videoRef,
} satisfies PreviewRuntimeContract;

const audioPlayback = {
  audioMeterRef: { current: null },
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
          <TimelineFrameContext.Provider value={timelineFrameState}>
            <PlaybackTransportContext.Provider value={timelineTransport}>
              {children}
            </PlaybackTransportContext.Provider>
          </TimelineFrameContext.Provider>
        </AudioTransportContext.Provider>
      </AudioPlaybackContext.Provider>
    </PreviewRuntimeContext.Provider>
  );
}

export { EditorRuntimeTestProvider };
