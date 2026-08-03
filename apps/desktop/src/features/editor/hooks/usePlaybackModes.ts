import { useRef, useState } from "react";

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

export function usePlaybackModes() {
  const modesRef = useRef({ loopEnabled: true, segmentEnabled: true });
  const playbackRangeRef = useRef<PlaybackRange | null>(null);
  const boundaryHandledRef = useRef(false);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [segmentEnabled, setSegmentEnabled] = useState(true);

  function activeRange(trim: TrimRange, playbackStartMicros: number) {
    return playbackRange(
      trim.sourceDurationMicros,
      trim.startMicros,
      modesRef.current.segmentEnabled && playbackStartMicros >= trim.endMicros
        ? trim.sourceDurationMicros
        : trim.endMicros,
      modesRef.current.segmentEnabled,
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
      modesRef.current.loopEnabled,
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
    const enabled = !modesRef.current.loopEnabled;
    modesRef.current.loopEnabled = enabled;
    setLoopEnabled(enabled);
  }

  function toggleSegment() {
    const enabled = !modesRef.current.segmentEnabled;
    modesRef.current.segmentEnabled = enabled;
    boundaryHandledRef.current = false;
    playbackRangeRef.current = null;
    setSegmentEnabled(enabled);
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
