import type { ReactNode, RefObject } from "react";

import type { TrimBoundary, TrimRange } from "@/domain/trim";
import type { FrameRate } from "@/lib/tauri/media";

export interface TrimTimelineProps {
  range: TrimRange;
  disabled?: boolean;
  playheadMicros: number;
  playheadRef: RefObject<HTMLButtonElement | null>;
  frameRate?: FrameRate;
  playbackControls: ReactNode;
  playbackTimecode: ReactNode;
  videoToolbar: ReactNode;
  onChange: (boundary: TrimBoundary, range: TrimRange) => TrimBoundary | null;
  onMoveSegment: (range: TrimRange) => TrimBoundary | null;
  onTrimDragStart: () => void;
  onTrimDragEnd: () => void;
  onSegmentDragStart: () => void;
  onSegmentDragEnd: () => void;
  onSeek: (micros: number) => void;
  onScrubStart: () => void;
  onScrub: (micros: number) => void;
  onScrubEnd: () => void;
}
