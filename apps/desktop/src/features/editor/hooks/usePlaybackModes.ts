import { useRef } from "react";

import {
  playbackBoundaryAction,
  playbackRange,
  playbackStartMicros,
  type PlaybackBoundaryAction,
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
  const boundaryHandledRef = useRef(false);

  function activeRange(trim: TrimRange) {
    return playbackRange(
      trim.sourceDurationMicros,
      trim.startMicros,
      trim.endMicros,
      segmentEnabled,
    );
  }

  function startMicros(currentMicros: number, trim: TrimRange) {
    return playbackStartMicros(currentMicros, activeRange(trim));
  }

  function consumeBoundary(currentMicros: number, trim: TrimRange): PlaybackBoundaryResult {
    const action = playbackBoundaryAction(currentMicros, activeRange(trim), loopEnabled);
    if (action.type === "continue") {
      boundaryHandledRef.current = false;
      return { reached: false };
    }
    if (boundaryHandledRef.current) {
      return { reached: true, action: null };
    }
    boundaryHandledRef.current = true;
    return { reached: true, action };
  }

  function toggleLoop() {
    const enabled = !loopEnabled;
    onLoopEnabledChange(enabled);
  }

  function toggleSegment() {
    const enabled = !segmentEnabled;
    boundaryHandledRef.current = false;
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
