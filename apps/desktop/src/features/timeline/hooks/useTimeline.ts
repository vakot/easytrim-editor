import { useAppSelector } from "@/app/store/redux-hooks";
import { selectTrim } from "@/app/store/slices/trim-slice";

import { useTimelinePlayback } from "../contexts/timeline-playback-context";

function useTimeline() {
  const playback = useTimelinePlayback();
  return {
    trim: useAppSelector(selectTrim),
    playheadMicros: playback.displayedPlayheadMicros,
    playheadRef: playback.playheadRef,
    canSetSegmentStart: playback.canSetSegmentStart,
    canSetSegmentEnd: playback.canSetSegmentEnd,
    onChange: playback.onTrimBoundaryChange,
    onSetSegmentBoundary: playback.onSetSegmentBoundary,
    onMoveSegment: playback.onSegmentMove,
    onTrimDragStart: playback.onTrimDragStart,
    onTrimDragEnd: playback.onTrimDragEnd,
    onSegmentDragStart: playback.onSegmentDragStart,
    onSegmentDragEnd: playback.onSegmentDragEnd,
    onSeek: playback.onSeek,
    onScrubStart: playback.onScrubStart,
    onScrub: playback.onScrub,
    onScrubEnd: playback.onScrubEnd,
  };
}

export { useTimeline };
