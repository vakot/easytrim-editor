import { useAppSelector } from "@/app/store/redux-hooks";
import { selectTrim } from "@/app/store/slices/trim-slice";

import { useTimelineEditing, useTimelinePlayhead } from "../contexts/timeline-runtime-contexts";

function useTimeline() {
  const playhead = useTimelinePlayhead();
  const editing = useTimelineEditing();
  return {
    trim: useAppSelector(selectTrim),
    playheadMicros: playhead.displayedPlayheadMicros,
    playheadRef: playhead.playheadRef,
    canSetSegmentStart: editing.canSetSegmentStart,
    canSetSegmentEnd: editing.canSetSegmentEnd,
    onChange: editing.onTrimBoundaryChange,
    onSetSegmentBoundary: editing.onSetSegmentBoundary,
    onMoveSegment: editing.onSegmentMove,
    onTrimDragStart: editing.onTrimDragStart,
    onTrimDragEnd: editing.onTrimDragEnd,
    onSegmentDragStart: editing.onSegmentDragStart,
    onSegmentDragEnd: editing.onSegmentDragEnd,
    onSeek: editing.onSeek,
    onScrubStart: editing.onScrubStart,
    onScrub: editing.onScrub,
    onScrubEnd: editing.onScrubEnd,
  };
}

export { useTimeline };
