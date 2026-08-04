import { useRef } from "react";

import {
  playbackBoundaryAction,
  playbackRange,
  type PlaybackBoundaryAction,
  type PlaybackRange,
} from "@/domain/playback";
import type { TrimRange } from "@/domain/trim";

type ReachedBoundaryAction = Exclude<PlaybackBoundaryAction, { type: "continue" }>;

export type PlaybackBoundaryResult =
  { reached: false } | { reached: true; action: ReachedBoundaryAction | null };

export function usePlaybackModes({
  loopEnabled,
  segmentEnabled,
  onLoopEnabledChange,
  onSegmentEnabledChange,
}: {
  loopEnabled: boolean;
  segmentEnabled: boolean;
  onLoopEnabledChange: (enabled: boolean) => void;
  onSegmentEnabledChange: (enabled: boolean) => void;
}) {
  const playbackRangeRef = useRef<PlaybackRange | null>(null);
  const boundaryHandledRef = useRef(false);

  function activeRange(trim: TrimRange, playbackStartMicrosValue: number) {
    return playbackRange(
      trim.sourceDurationMicros,
      trim.startMicros,
      segmentEnabled && playbackStartMicrosValue >= trim.endMicros
        ? trim.sourceDurationMicros
        : trim.endMicros,
      segmentEnabled,
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
      loopEnabled,
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

  function toggleLoop() {
    const enabled = !loopEnabled;
    onLoopEnabledChange(enabled);
  }

  function toggleSegment() {
    const enabled = !segmentEnabled;
    boundaryHandledRef.current = false;
    playbackRangeRef.current = null;
    onSegmentEnabledChange(enabled);
    return enabled;
  }

  function resetBoundary() {
    boundaryHandledRef.current = false;
  }

  return {
    loopEnabled,
    segmentEnabled,
    startMicros,
    consumeBoundary,
    toggleLoop,
    toggleSegment,
    resetBoundary,
  };
}
