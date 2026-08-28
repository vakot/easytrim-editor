import { useEffect, useRef } from "react";

import {
  type PlaybackBoundaryAction,
  playbackBoundaryAction,
  type PlaybackRange,
  playbackRange,
} from "@/domain/playback";
import type { TrimRange } from "@/domain/trim";

type ReachedBoundaryAction = Exclude<PlaybackBoundaryAction, { type: "continue" }>;

type PlaybackBoundaryResult =
  { reached: false } | { reached: true; action: ReachedBoundaryAction | null };

export function usePlaybackModes({
  loopEnabled,
  segmentEnabled,
}: {
  loopEnabled: boolean;
  segmentEnabled: boolean;
}) {
  const playbackRangeRef = useRef<PlaybackRange | null>(null);
  const boundaryHandledRef = useRef(false);
  const loopEnabledRef = useRef(loopEnabled);
  const segmentEnabledRef = useRef(segmentEnabled);
  useEffect(() => {
    loopEnabledRef.current = loopEnabled;
    segmentEnabledRef.current = segmentEnabled;
  }, [loopEnabled, segmentEnabled]);

  function activeRange(trim: TrimRange, playbackStartMicrosValue: number) {
    return playbackRange(
      trim.sourceDurationMicros,
      trim.startMicros,
      segmentEnabledRef.current && playbackStartMicrosValue > trim.endMicros
        ? trim.sourceDurationMicros
        : trim.endMicros,
      segmentEnabledRef.current,
    );
  }

  function startMicros(currentMicros: number, trim: TrimRange) {
    const range = activeRange(trim, currentMicros);
    playbackRangeRef.current = range;
    return currentMicros;
  }

  function consumeBoundary(currentMicros: number, trim: TrimRange): PlaybackBoundaryResult {
    const action = playbackBoundaryAction(
      currentMicros,
      playbackRangeRef.current ?? activeRange(trim, trim.startMicros),
      loopEnabledRef.current,
    );

    if (action.type === "continue") {
      boundaryHandledRef.current = false;
      return { reached: false };
    }
    if (boundaryHandledRef.current) {
      return { reached: true, action: null };
    }
    boundaryHandledRef.current = true;
    if (action.type === "restart") {
      playbackRangeRef.current = activeRange(trim, trim.startMicros);
    }
    return { reached: true, action };
  }

  function resetBoundary() {
    boundaryHandledRef.current = false;
  }

  return {
    startMicros,
    consumeBoundary,
    resetBoundary,
  };
}
