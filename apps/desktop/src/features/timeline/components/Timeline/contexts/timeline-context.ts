import type * as React from "react";
import { createContext, useContext } from "react";

interface TimelineContextValue {
  disabled: boolean;
  durationMicros: number;
  /** The time under a pointer; Shift snaps it to nearby targets other than `exclude`. */
  pointerMicros: (event: React.PointerEvent, exclude?: number) => number;
}

const TimelineContext = createContext<TimelineContextValue | null>(null);

function useTimeline() {
  const context = useContext(TimelineContext);
  if (!context) throw new Error("Timeline parts must be used within Timeline.Root.");
  return context;
}

export { TimelineContext, useTimeline };
