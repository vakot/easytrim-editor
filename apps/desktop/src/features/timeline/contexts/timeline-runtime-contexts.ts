import { createContext, useContext } from "react";

interface TimelineFrameState {
  currentFrame: number;
  framesCount: number;
  setCurrentFrame: (frame: number) => void;
}

interface PlaybackTransport {
  isPlaying: boolean;
  pause: () => void;
  resumeAfterInteraction: (resumePlayback: boolean) => void;
  suspendForInteraction: () => boolean;
  toggle: () => void;
}

const TimelineFrameContext = createContext<TimelineFrameState | null>(null);
const PlaybackTransportContext = createContext<PlaybackTransport | null>(null);

function useTimelineFrameState() {
  const state = useContext(TimelineFrameContext);
  if (!state) throw new Error("Timeline frame state must be used within TimelinePlaybackProvider.");
  return state;
}

function usePlaybackTransport() {
  const transport = useContext(PlaybackTransportContext);
  if (!transport) throw new Error("Playback transport must be used within TimelinePlaybackProvider.");
  return transport;
}

export {
  PlaybackTransportContext,
  TimelineFrameContext,
  usePlaybackTransport,
  useTimelineFrameState,
};
export type { PlaybackTransport, TimelineFrameState };
