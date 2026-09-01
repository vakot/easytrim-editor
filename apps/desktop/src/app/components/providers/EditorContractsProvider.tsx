import { type ReactNode, useMemo } from "react";

import {
  EditorPlaybackContext,
  EditorTimelineCommandsContext,
  EditorTimelineStateContext,
} from "@/app/contexts/editor-contracts-context";
import { useEditorInteractionController } from "@/app/hooks/useEditorInteractionController";

export function EditorContractsProvider({ children }: { children: ReactNode }) {
  const interaction = useEditorInteractionController();
  const playback = useMemo(
    () => ({
      audioPlayheadRef: interaction.audioPlayheadRef,
      isPlaybackReady: interaction.isPlaybackReady,
      isPlaying: interaction.isPlaying,
      nativeLoopEnabled: interaction.nativeLoopEnabled,
      onCanPlay: interaction.onCanPlay,
      onCropToolOpenChange: interaction.onCropToolOpenChange,
      onEnded: interaction.onEnded,
      onLoadedMetadata: interaction.onLoadedMetadata,
      onPause: interaction.onPause,
      onPlay: interaction.onPlay,
      onPreviewPlaybackError: interaction.onPreviewPlaybackError,
      onSetSegmentBoundary: interaction.onSetSegmentBoundary,
      onShuttleEnd: interaction.onShuttleEnd,
      onShuttleStart: interaction.onShuttleStart,
      onStepFrame: interaction.onStepFrame,
      onTimeUpdate: interaction.onTimeUpdate,
      onTogglePlayback: interaction.onTogglePlayback,
      shuttleDirection: interaction.shuttleDirection,
      transportError: interaction.transportError,
      videoMuted: interaction.videoMuted,
      videoRef: interaction.videoRef,
    }),
    [
      interaction.audioPlayheadRef,
      interaction.isPlaybackReady,
      interaction.isPlaying,
      interaction.nativeLoopEnabled,
      interaction.onCanPlay,
      interaction.onCropToolOpenChange,
      interaction.onEnded,
      interaction.onLoadedMetadata,
      interaction.onPause,
      interaction.onPlay,
      interaction.onPreviewPlaybackError,
      interaction.onSetSegmentBoundary,
      interaction.onShuttleEnd,
      interaction.onShuttleStart,
      interaction.onStepFrame,
      interaction.onTimeUpdate,
      interaction.onTogglePlayback,
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
      interaction.onSegmentDragEnd,
      interaction.onSegmentDragStart,
      interaction.onSegmentMove,
      interaction.onTrimBoundaryChange,
      interaction.onTrimDragEnd,
      interaction.onTrimDragStart,
    ],
  );

  return (
    <EditorPlaybackContext.Provider value={playback}>
      <EditorTimelineCommandsContext.Provider value={timelineCommands}>
        <EditorTimelineStateContext.Provider value={timelineState}>
          {children}
        </EditorTimelineStateContext.Provider>
      </EditorTimelineCommandsContext.Provider>
    </EditorPlaybackContext.Provider>
  );
}
