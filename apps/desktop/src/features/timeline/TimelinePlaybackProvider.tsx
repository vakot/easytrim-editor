import { type ReactNode, useMemo } from "react";

import {
  TimelineEditingContext,
  TimelinePlayheadContext,
  TimelineReadinessContext,
  TimelineTransportContext,
} from "./contexts/timeline-runtime-contexts";
import { useTimelinePlaybackController } from "./hooks/useTimelinePlaybackController";

function TimelinePlaybackProvider({ children }: { children: ReactNode }) {
  const runtime = useTimelinePlaybackController();
  const playhead = useMemo(
    () => ({
      displayedPlayheadMicros: runtime.displayedPlayheadMicros,
      playheadRef: runtime.playheadRef,
    }),
    [runtime.displayedPlayheadMicros, runtime.playheadRef],
  );

  const editing = useMemo(
    () => ({
      canSetSegmentEnd: runtime.canSetSegmentEnd,
      canSetSegmentStart: runtime.canSetSegmentStart,
      onScrub: runtime.onScrub,
      onScrubEnd: runtime.onScrubEnd,
      onScrubStart: runtime.onScrubStart,
      onSeek: runtime.onSeek,
      onSegmentDragEnd: runtime.onSegmentDragEnd,
      onSegmentDragStart: runtime.onSegmentDragStart,
      onSegmentMove: runtime.onSegmentMove,
      onSetSegmentBoundary: runtime.onSetSegmentBoundary,
      onTrimBoundaryChange: runtime.onTrimBoundaryChange,
      onTrimDragEnd: runtime.onTrimDragEnd,
      onTrimDragStart: runtime.onTrimDragStart,
    }),
    [
      runtime.canSetSegmentEnd,
      runtime.canSetSegmentStart,
      runtime.onScrub,
      runtime.onScrubEnd,
      runtime.onScrubStart,
      runtime.onSeek,
      runtime.onSegmentDragEnd,
      runtime.onSegmentDragStart,
      runtime.onSegmentMove,
      runtime.onSetSegmentBoundary,
      runtime.onTrimBoundaryChange,
      runtime.onTrimDragEnd,
      runtime.onTrimDragStart,
    ],
  );

  const readiness = useMemo(() => ({ canInteract: runtime.canInteract }), [runtime.canInteract]);
  const transport = useMemo(
    () => ({
      isPlaying: runtime.isPlaying,
      pause: runtime.pause,
      resumeAfterInteraction: runtime.resumeAfterInteraction,
      shuttleDirection: runtime.shuttleDirection,
      startShuttle: runtime.startShuttle,
      stepFrame: runtime.stepFrame,
      stopShuttle: runtime.stopShuttle,
      suspendForInteraction: runtime.suspendForInteraction,
      toggle: runtime.toggle,
      transportError: runtime.transportError,
    }),
    [
      runtime.isPlaying,
      runtime.pause,
      runtime.resumeAfterInteraction,
      runtime.shuttleDirection,
      runtime.startShuttle,
      runtime.stepFrame,
      runtime.stopShuttle,
      runtime.suspendForInteraction,
      runtime.toggle,
      runtime.transportError,
    ],
  );

  return (
    <TimelinePlayheadContext.Provider value={playhead}>
      <TimelineEditingContext.Provider value={editing}>
        <TimelineReadinessContext.Provider value={readiness}>
          <TimelineTransportContext.Provider value={transport}>
            {children}
          </TimelineTransportContext.Provider>
        </TimelineReadinessContext.Provider>
      </TimelineEditingContext.Provider>
    </TimelinePlayheadContext.Provider>
  );
}

export { TimelinePlaybackProvider };
