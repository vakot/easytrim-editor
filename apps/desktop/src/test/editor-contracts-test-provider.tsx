import type { ReactNode, RefObject } from "react";

import {
  EditorPlaybackContext,
  type EditorPlaybackInteraction,
  type EditorTimelineCommands,
  EditorTimelineCommandsContext,
  type EditorTimelineState,
  EditorTimelineStateContext,
} from "@/app/contexts/editor-contracts-context";
import { AudioPlaybackContext, type AudioPlaybackContract } from "@/features/audio";

const videoRef: RefObject<HTMLVideoElement | null> = { current: null };
const playheadRef: RefObject<HTMLButtonElement | null> = { current: null };
const noOperation = () => undefined;

const playback = {
  isPlaybackReady: false,
  isPlaying: false,
  nativeLoopEnabled: false,
  onCanPlay: noOperation,
  onCropToolOpenChange: noOperation,
  onEnded: noOperation,
  onLoadedMetadata: noOperation,
  onPause: noOperation,
  onPausePlayback: noOperation,
  onPlay: noOperation,
  onPreviewPlaybackError: noOperation,
  onShuttleEnd: noOperation,
  onShuttleStart: noOperation,
  onStepFrame: noOperation,
  onTimeUpdate: noOperation,
  onTogglePlayback: noOperation,
  setMediaPlaybackRate: noOperation,
  setVideoElement: (element: HTMLVideoElement | null) => {
    videoRef.current = element;
  },
  shuttleDirection: 0,
  transportError: null,
  videoMuted: true,
  videoRef,
} satisfies EditorPlaybackInteraction;

const audioPlayback = {
  audioPlayheadRef: { current: null },
  audioMeterRef: { current: null },
  clearLiveAudioTrackGain: noOperation,
  setLiveAudioTrackGain: noOperation,
} satisfies AudioPlaybackContract;

const timelineState = {
  canSetSegmentEnd: false,
  canSetSegmentStart: false,
  displayedPlayheadMicros: 0,
  playheadRef,
} satisfies EditorTimelineState;

const timelineCommands = {
  onScrub: noOperation,
  onScrubEnd: noOperation,
  onScrubStart: noOperation,
  onSeek: noOperation,
  onSetSegmentBoundary: noOperation,
  onSegmentDragEnd: noOperation,
  onSegmentDragStart: noOperation,
  onSegmentMove: noOperation,
  onTrimBoundaryChange: noOperation,
  onTrimDragEnd: noOperation,
  onTrimDragStart: noOperation,
} satisfies EditorTimelineCommands;

function EditorContractsTestProvider({ children }: { children: ReactNode }) {
  return (
    <AudioPlaybackContext.Provider value={audioPlayback}>
      <EditorPlaybackContext.Provider value={playback}>
        <EditorTimelineCommandsContext.Provider value={timelineCommands}>
          <EditorTimelineStateContext.Provider value={timelineState}>
            {children}
          </EditorTimelineStateContext.Provider>
        </EditorTimelineCommandsContext.Provider>
      </EditorPlaybackContext.Provider>
    </AudioPlaybackContext.Provider>
  );
}

export { EditorContractsTestProvider };
