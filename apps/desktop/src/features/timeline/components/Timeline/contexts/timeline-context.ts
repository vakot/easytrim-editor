import type * as React from "react";
import { createContext, useContext } from "react";

interface TimelineContextValue {
  disabled: boolean;
  durationMicros: number;
  /** The time under a pointer; Shift snaps it to nearby targets not named in `exclude`. */
  pointerMicros: (
    event: React.PointerEvent,
    exclude?: readonly string[],
  ) => { micros: number; snapped: boolean };
  /** Whether the current scrub snapped to a target; the scrubbed handle shows it. */
  scrubSnapped: boolean;
}

const TimelineContext = createContext<TimelineContextValue | null>(null);

function useTimeline() {
  const context = useContext(TimelineContext);
  if (!context) throw new Error("Timeline parts must be used within Timeline.Root.");
  return context;
}

export { TimelineContext, useTimeline };
