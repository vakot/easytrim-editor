import { createContext, type RefObject, useContext } from "react";

import type { TrimBoundary, TrimRange } from "@/domain/trim";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";

import type { FrameShuttleDirection } from "../lib/editor-shortcuts";

interface TimelinePlayheadContract {
  displayedPlayheadMicros: number;
  playheadRef: RefObject<HTMLButtonElement | null>;
}

interface TimelineEditingContract {
  canSetSegmentEnd: boolean;
  canSetSegmentStart: boolean;
  onScrub: (micros: number) => void;
  onScrubEnd: () => void;
  onScrubStart: () => void;
  onSeek: (micros: number) => void;
  onSegmentDragEnd: () => void;
  onSegmentDragStart: () => void;
  onSegmentMove: (nextTrim: TrimRange) => void;
  onSetSegmentBoundary: (boundary: TrimBoundary, origin?: DiagnosticOrigin) => void;
  onTrimBoundaryChange: (boundary: TrimBoundary, nextTrim: TrimRange) => void;
  onTrimDragEnd: () => void;
  onTrimDragStart: () => void;
}

interface TimelineReadinessContract {
  canInteract: boolean;
}

interface TimelineTransportContract {
  isPlaying: boolean;
  pause: () => void;
  resumeAfterInteraction: (resumePlayback: boolean) => void;
  shuttleDirection: FrameShuttleDirection | 0;
  startShuttle: (direction: FrameShuttleDirection, origin?: DiagnosticOrigin) => void;
  stepFrame: (direction: -1 | 1, origin?: DiagnosticOrigin) => void;
  stopShuttle: (origin?: DiagnosticOrigin) => void;
  suspendForInteraction: () => boolean;
  toggle: (origin?: DiagnosticOrigin) => void;
  transportError: string | null;
}

const TimelinePlayheadContext = createContext<TimelinePlayheadContract | null>(null);
const TimelineEditingContext = createContext<TimelineEditingContract | null>(null);
const TimelineReadinessContext = createContext<TimelineReadinessContract | null>(null);
const TimelineTransportContext = createContext<TimelineTransportContract | null>(null);

function useRequiredContext<T>(context: React.Context<T | null>, message: string): T {
  const value = useContext(context);
  if (!value) throw new Error(message);
  return value;
}

function useTimelinePlayhead(): TimelinePlayheadContract {
  return useRequiredContext(
    TimelinePlayheadContext,
    "Timeline playhead must be used within TimelinePlaybackProvider.",
  );
}

function useTimelineEditing(): TimelineEditingContract {
  return useRequiredContext(
    TimelineEditingContext,
    "Timeline editing must be used within TimelinePlaybackProvider.",
  );
}

function useTimelineReadiness(): TimelineReadinessContract {
  return useRequiredContext(
    TimelineReadinessContext,
    "Timeline readiness must be used within TimelinePlaybackProvider.",
  );
}

function useTimelineTransport(): TimelineTransportContract {
  return useRequiredContext(
    TimelineTransportContext,
    "Timeline transport must be used within TimelinePlaybackProvider.",
  );
}

export {
  TimelineEditingContext,
  TimelinePlayheadContext,
  TimelineReadinessContext,
  TimelineTransportContext,
  useTimelineEditing,
  useTimelinePlayhead,
  useTimelineReadiness,
  useTimelineTransport,
};
export type {
  TimelineEditingContract,
  TimelinePlayheadContract,
  TimelineReadinessContract,
  TimelineTransportContract,
};
