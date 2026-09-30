import { createContext, type RefObject, useContext } from "react";

import type { TrimBoundary, TrimRange } from "@/domain/trim";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";

import type { FrameShuttleDirection } from "../lib/editor-shortcuts";

interface TimelinePlaybackContract {
  canInteract: boolean;
  canSetSegmentEnd: boolean;
  canSetSegmentStart: boolean;
  displayedPlayheadMicros: number;
  isPlaying: boolean;
  onEnded: () => void;
  onLoadedMetadata: () => void;
  onPause: () => void;
  onPlay: () => void;
  onScrub: (micros: number) => void;
  onScrubEnd: () => void;
  onScrubStart: () => void;
  onSeek: (micros: number) => void;
  onSegmentDragEnd: () => void;
  onSegmentDragStart: () => void;
  onSegmentMove: (nextTrim: TrimRange) => void;
  onSetSegmentBoundary: (boundary: TrimBoundary, origin?: DiagnosticOrigin) => void;
  onTimeUpdate: (seconds: number) => void;
  onTrimBoundaryChange: (boundary: TrimBoundary, nextTrim: TrimRange) => void;
  onTrimDragEnd: () => void;
  onTrimDragStart: () => void;
  pause: () => void;
  playheadRef: RefObject<HTMLButtonElement | null>;
  shuttleDirection: FrameShuttleDirection | 0;
  startShuttle: (direction: FrameShuttleDirection, origin?: DiagnosticOrigin) => void;
  stepFrame: (direction: -1 | 1, origin?: DiagnosticOrigin) => void;
  stopShuttle: (origin?: DiagnosticOrigin) => void;
  toggle: (origin?: DiagnosticOrigin) => void;
  transportError: string | null;
}

const TimelinePlaybackContext = createContext<TimelinePlaybackContract | null>(null);

function useTimelinePlayback(): TimelinePlaybackContract {
  const runtime = useContext(TimelinePlaybackContext);
  if (!runtime) throw new Error("Timeline playback must be used within TimelinePlaybackProvider.");
  return runtime;
}

export { TimelinePlaybackContext, useTimelinePlayback };
export type { TimelinePlaybackContract };
