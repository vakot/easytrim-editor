import { useAppSelector } from "@/app/store/redux-hooks";
import { selectTrim } from "@/app/store/slices/trim-slice";

import { useEditorInteraction } from "./useEditorInteraction";

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
