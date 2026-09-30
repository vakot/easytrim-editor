import { type ReactNode, useMemo } from "react";

import {
  EditorPlaybackContext,
  EditorTimelineCommandsContext,
  EditorTimelineStateContext,
} from "@/app/contexts/editor-contracts-context";
import { useEditorInteractionController } from "@/app/hooks/useEditorInteractionController";
import { AudioPlaybackContext, type AudioPlaybackContract } from "@/features/audio";

function EditorContractsProvider({ children }: { children: ReactNode }) {
  const interaction = useEditorInteractionController();
  const audioPlayback = useMemo<AudioPlaybackContract>(
    () => ({
      audioMeterRef: interaction.audioPlayback.audioMeterRef,
      audioPlayheadRef: interaction.audioPlayback.audioPlayheadRef,
      clearLiveAudioTrackGain: interaction.audioPlayback.clearLiveAudioTrackGain,
      setLiveAudioTrackGain: interaction.audioPlayback.setLiveAudioTrackGain,
    }),
    [
      interaction.audioPlayback.audioMeterRef,
      interaction.audioPlayback.audioPlayheadRef,
      interaction.audioPlayback.clearLiveAudioTrackGain,
      interaction.audioPlayback.setLiveAudioTrackGain,
    ],
  );

  const playback = useMemo(
    () => ({
      isPlaybackReady: interaction.isPlaybackReady,
      isPlaying: interaction.isPlaying,
      nativeLoopEnabled: interaction.nativeLoopEnabled,
      onCanPlay: interaction.onCanPlay,
      onCropToolOpenChange: interaction.onCropToolOpenChange,
      onEnded: interaction.onEnded,
      onLoadedMetadata: interaction.onLoadedMetadata,
      onPause: interaction.onPause,
      onPausePlayback: interaction.onPausePlayback,
      onPlay: interaction.onPlay,
      onPreviewPlaybackError: interaction.onPreviewPlaybackError,
      onShuttleEnd: interaction.onShuttleEnd,
      onShuttleStart: interaction.onShuttleStart,
      onStepFrame: interaction.onStepFrame,
      onTimeUpdate: interaction.onTimeUpdate,
      onTogglePlayback: interaction.onTogglePlayback,
      setMediaPlaybackRate: interaction.setMediaPlaybackRate,
      setVideoElement: interaction.setVideoElement,
      shuttleDirection: interaction.shuttleDirection,
      transportError: interaction.transportError,
      videoMuted: interaction.videoMuted,
      videoRef: interaction.videoRef,
    }),
    [
      interaction.isPlaybackReady,
      interaction.isPlaying,
      interaction.nativeLoopEnabled,
      interaction.onCanPlay,
      interaction.onCropToolOpenChange,
      interaction.onEnded,
      interaction.onLoadedMetadata,
      interaction.onPause,
      interaction.onPausePlayback,
      interaction.onPlay,
      interaction.onPreviewPlaybackError,
      interaction.onShuttleEnd,
      interaction.onShuttleStart,
      interaction.onStepFrame,
      interaction.onTimeUpdate,
      interaction.onTogglePlayback,
      interaction.setMediaPlaybackRate,
      interaction.setVideoElement,
      interaction.shuttleDirection,
      interaction.transportError,
      interaction.videoMuted,
      interaction.videoRef,
    ],
  );

  const timelineState = useMemo(
    () => ({
      canSetSegmentEnd: interaction.canSetSegmentEnd,
      canSetSegmentStart: interaction.canSetSegmentStart,
      displayedPlayheadMicros: interaction.displayedPlayheadMicros,
      playheadRef: interaction.playheadRef,
    }),
    [
      interaction.canSetSegmentEnd,
      interaction.canSetSegmentStart,
      interaction.displayedPlayheadMicros,
      interaction.playheadRef,
    ],
  );

  const timelineCommands = useMemo(
    () => ({
      onScrub: interaction.onScrub,
      onScrubEnd: interaction.onScrubEnd,
      onScrubStart: interaction.onScrubStart,
      onSeek: interaction.onSeek,
      onSetSegmentBoundary: interaction.onSetSegmentBoundary,
      onSegmentDragEnd: interaction.onSegmentDragEnd,
      onSegmentDragStart: interaction.onSegmentDragStart,
      onSegmentMove: interaction.onSegmentMove,
      onTrimBoundaryChange: interaction.onTrimBoundaryChange,
      onTrimDragEnd: interaction.onTrimDragEnd,
      onTrimDragStart: interaction.onTrimDragStart,
    }),
    [
      interaction.onScrub,
      interaction.onScrubEnd,
      interaction.onScrubStart,
      interaction.onSeek,
      interaction.onSetSegmentBoundary,
      interaction.onSegmentDragEnd,
      interaction.onSegmentDragStart,
      interaction.onSegmentMove,
      interaction.onTrimBoundaryChange,
      interaction.onTrimDragEnd,
      interaction.onTrimDragStart,
    ],
  );

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

export { EditorContractsProvider };
