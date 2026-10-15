import { type CSSProperties, type ReactNode, useCallback, useState } from "react";

import { usePlaybackPosition, useTimelinePlayback } from "@/features/playback";

import { TimelineAxisContext } from "../contexts/timeline-axis-context";

import { percentOf } from "./Timeline";

/**
 * Publishes the timeline playhead and selection as CSS custom properties so views aligned with
 * the timeline axis can follow them in pure CSS:
 *
 * - `--timeline-playhead-position`: the playhead, from the left edge;
 * - `--timeline-selection-start`: the selection start, from the left edge;
 * - `--timeline-selection-end-inset`: the selection end, from the right edge.
 *
 * It adds no box of its own; only it re-renders as they move, never its children.
 */
function TimelineAxisScope({ children }: { children: ReactNode }) {
  const { durationMicros } = useTimelinePlayback();
  const playheadPercent = usePlaybackPosition((micros) => percentOf(micros, durationMicros));
  const [selectionStartPercent, setSelectionStartPercent] = useState(0);
  const [selectionEndPercent, setSelectionEndPercent] = useState(100);

  const publishSelection = useCallback((startPercent: number, endPercent: number) => {
    setSelectionStartPercent(startPercent);
    setSelectionEndPercent(endPercent);
  }, []);

  return (
    <TimelineAxisContext.Provider value={publishSelection}>
      <div
        className="contents"
        data-slot="timeline-axis-scope"
        style={
          {
            "--timeline-playhead-position": `${playheadPercent}%`,
            "--timeline-selection-start": `${selectionStartPercent}%`,
            "--timeline-selection-end-inset": `${100 - selectionEndPercent}%`,
          } as CSSProperties
        }
      >
        {children}
      </div>
    </TimelineAxisContext.Provider>
  );
}

export { TimelineAxisScope };
