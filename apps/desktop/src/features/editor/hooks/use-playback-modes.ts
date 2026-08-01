import { useRef, useState } from "react";

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

export function usePlaybackModes() {
  const modesRef = useRef({ loopEnabled: false, segmentEnabled: false });
  const boundaryHandledRef = useRef(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [segmentEnabled, setSegmentEnabled] = useState(false);

  function activeRange(trim: TrimRange) {
    return playbackRange(
      trim.sourceDurationMicros,
      trim.startMicros,
      trim.endMicros,
      modesRef.current.segmentEnabled,
    );
  }

  function startMicros(currentMicros: number, trim: TrimRange) {
    return playbackStartMicros(currentMicros, activeRange(trim));
  }

  function consumeBoundary(currentMicros: number, trim: TrimRange): PlaybackBoundaryResult {
    const action = playbackBoundaryAction(
      currentMicros,
      activeRange(trim),
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
