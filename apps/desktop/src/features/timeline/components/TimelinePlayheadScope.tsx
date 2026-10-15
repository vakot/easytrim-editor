import type { CSSProperties, ReactNode } from "react";

import { usePlaybackPosition, useTimelinePlayback } from "@/features/playback";

import { percentOf } from "./Timeline/lib/timeline-scale";

/**
 * Publishes the playhead position as `--timeline-playhead-position` so views aligned with the
 * timeline axis can follow it in CSS. It adds no box of its own; only it re-renders as the
 * playhead moves, never its children.
 */
function TimelinePlayheadScope({ children }: { children: ReactNode }) {
  const { durationMicros } = useTimelinePlayback();
  const percent = usePlaybackPosition((micros) => percentOf(micros, durationMicros));

  return (
    <div
      className="contents"
      data-slot="timeline-playhead-scope"
      style={{ "--timeline-playhead-position": `${percent}%` } as CSSProperties}
    >
      {children}
    </div>
  );
}

export { TimelinePlayheadScope };
