import { useContext } from "react";

import { EditorInteractionContext } from "@/app/contexts/editor-contracts-context";
import { useAppSelector } from "@/app/store/hooks";
import { selectTrim } from "@/app/store/slices/trim-slice";

function useEditorInteraction() {
  const value = useContext(EditorInteractionContext);
  if (!value) {
    throw new Error("Editor interaction contracts must be used within EditorContractsProvider.");
  }
  return value;
}

export function usePlayback() {
  const interaction = useEditorInteraction();
  return {
    videoRef: interaction.videoRef,
    audioPlayheadRef: interaction.audioPlayheadRef,
    displayedPlayheadMicros: interaction.displayedPlayheadMicros,
    isPlaying: interaction.isPlaying,
    isReady: interaction.isPlaybackReady,
    transportError: interaction.transportError,
    nativeLoopEnabled: interaction.nativeLoopEnabled,
    videoMuted: interaction.videoMuted,
    onLoadedMetadata: interaction.onLoadedMetadata,
    onCanPlay: interaction.onCanPlay,
    onPlay: interaction.onPlay,
    onPause: interaction.onPause,
    onTimeUpdate: interaction.onTimeUpdate,
    onEnded: interaction.onEnded,
    onScrubStart: interaction.onScrubStart,
    onScrub: interaction.onScrub,
    onScrubEnd: interaction.onScrubEnd,
    toggle: interaction.onTogglePlayback,
    stepFrame: interaction.onStepFrame,
    setSegmentBoundary: interaction.onSetSegmentBoundary,
    onCropToolOpenChange: interaction.onCropToolOpenChange,
    onPreviewPlaybackError: interaction.onPreviewPlaybackError,
  };
}

export function useTimeline() {
  const interaction = useEditorInteraction();
  const trim = useAppSelector(selectTrim);
  return {
    trim,
    playheadMicros: interaction.displayedPlayheadMicros,
    playheadRef: interaction.playheadRef,
    audioPlayheadRef: interaction.audioPlayheadRef,
    canSetSegmentStart: interaction.canSetSegmentStart,
    canSetSegmentEnd: interaction.canSetSegmentEnd,
    onChange: interaction.onTrimBoundaryChange,
    onMoveSegment: interaction.onSegmentMove,
    onTrimDragStart: interaction.onTrimDragStart,
    onTrimDragEnd: interaction.onTrimDragEnd,
    onSegmentDragStart: interaction.onSegmentDragStart,
    onSegmentDragEnd: interaction.onSegmentDragEnd,
    onSeek: interaction.onSeek,
    onScrubStart: interaction.onScrubStart,
    onScrub: interaction.onScrub,
    onScrubEnd: interaction.onScrubEnd,
  };
}
