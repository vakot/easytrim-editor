import { useCallback, useEffect, useMemo, useRef } from "react";

import {
  type PlaybackBoundaryAction,
  playbackBoundaryAction,
  type PlaybackDirection,
  type PlaybackRange,
  playbackRange,
} from "@/domain/playback";
import type { TrimRange } from "@/domain/trim";

type ReachedBoundaryAction = Exclude<PlaybackBoundaryAction, { type: "continue" }>;

type PlaybackBoundaryResult =
  { reached: false } | { action: ReachedBoundaryAction | null; reached: true };

function usePlaybackModes({
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

  function consumeBoundaryInRange(
    currentMicros: number,
    range: PlaybackRange,
    direction: PlaybackDirection,
  ): PlaybackBoundaryResult {
    const action = playbackBoundaryAction(currentMicros, range, loopEnabledRef.current, direction);

    if (action.type === "continue") {
      boundaryHandledRef.current = false;
      return { reached: false };
    }
    if (boundaryHandledRef.current) {
      return { reached: true, action: null };
    }
    boundaryHandledRef.current = true;
    if (action.type === "restart") playbackRangeRef.current = range;
    return { reached: true, action };
  }

  const activeRange = useCallback((trim: TrimRange, playbackStartMicrosValue: number) => {
    return playbackRange(
      trim.sourceDurationMicros,
      trim.startMicros,
      segmentEnabledRef.current && playbackStartMicrosValue > trim.endMicros
        ? trim.sourceDurationMicros
        : trim.endMicros,
      segmentEnabledRef.current,
    );
  }, []);

  const startMicros = useCallback(
    (currentMicros: number, trim: TrimRange) => {
      const range = activeRange(trim, currentMicros);
      playbackRangeRef.current = range;
      return currentMicros;
    },
    [activeRange],
  );

  const consumeBoundary = useCallback(
    (
      currentMicros: number,
      trim: TrimRange,
      direction: PlaybackDirection = 1,
    ): PlaybackBoundaryResult => {
      return consumeBoundaryInRange(
        currentMicros,
        playbackRangeRef.current ?? activeRange(trim, trim.startMicros),
        direction,
      );
    },
    [activeRange],
  );

  const consumeSourceBoundary = useCallback(
    (
      currentMicros: number,
      sourceDurationMicros: number,
      direction: PlaybackDirection,
    ): PlaybackBoundaryResult => {
      return consumeBoundaryInRange(
        currentMicros,
        playbackRange(sourceDurationMicros, 0, sourceDurationMicros, false),
        direction,
      );
    },
    [],
  );

  const resetBoundary = useCallback(() => {
    boundaryHandledRef.current = false;
  }, []);

  return useMemo(
    () => ({ startMicros, consumeBoundary, consumeSourceBoundary, resetBoundary }),
    [consumeBoundary, consumeSourceBoundary, resetBoundary, startMicros],
  );
}

export { usePlaybackModes };
