import { useContext } from "react";

import { EditorInteractionContext } from "@/app/editor-contracts-context";
import { useSourceDetails } from "@/app/hooks/useSourceDetails";
import { useTimelineTools } from "@/app/hooks/useTimelineTools";

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
    playheadMicros: interaction.playheadMicros,
    displayedPlayheadMicros: interaction.displayedPlayheadMicros,
    isPlaying: interaction.isPlaying,
    transportError: interaction.transportError,
    playbackRate: interaction.playbackRate,
    onLoadedMetadata: interaction.onLoadedMetadata,
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
  const source = useSourceDetails();
  const interaction = useEditorInteraction();
  return {
    trim: source.trim,
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

export { useSourceDetails, useTimelineTools };
