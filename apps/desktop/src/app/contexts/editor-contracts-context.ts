import type { RefObject } from "react";
import { createContext } from "react";

import type { TrimBoundary, TrimRange } from "@/domain/trim";
import type { StereoAudioMeterNodes } from "@/features/audio";
import type { FrameShuttleDirection } from "@/features/timeline";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";

export interface EditorPlaybackInteraction {
  audioMeterRef: RefObject<StereoAudioMeterNodes | null>;
  audioPlayheadRef: RefObject<HTMLDivElement | null>;
  clearLiveAudioTrackGain: (streamIndex: number, committedGainDb: number) => void;
  isPlaybackReady: boolean;
  isPlaying: boolean;
  nativeLoopEnabled: boolean;
  onCanPlay: () => void;
  onCropToolOpenChange: (isOpen: boolean) => void;
  onEnded: () => void;
  onLoadedMetadata: () => void;
  onPause: () => void;
  onPausePlayback: () => void;
  onPlay: () => void;
  onPreviewPlaybackError: (previewKind: "source" | "proxy") => void;
  onShuttleEnd: (origin?: DiagnosticOrigin) => void;
  onShuttleStart: (direction: FrameShuttleDirection, origin?: DiagnosticOrigin) => void;
  onStepFrame: (direction: -1 | 1, origin?: DiagnosticOrigin) => void;
  onTimeUpdate: (seconds: number) => void;
  onTogglePlayback: (origin?: DiagnosticOrigin) => void;
  setLiveAudioTrackGain: (streamIndex: number, gainDb: number) => void;
  setMediaPlaybackRate: (rate: number) => void;
  setVideoElement: (element: HTMLVideoElement | null) => void;
  shuttleDirection: FrameShuttleDirection | 0;
  transportError: string | null;
  videoMuted: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
}

export interface EditorTimelineState {
  canSetSegmentEnd: boolean;
  canSetSegmentStart: boolean;
  displayedPlayheadMicros: number;
  playheadRef: RefObject<HTMLButtonElement | null>;
}

export interface EditorTimelineCommands {
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

export const EditorPlaybackContext = createContext<EditorPlaybackInteraction | null>(null);
export const EditorTimelineCommandsContext = createContext<EditorTimelineCommands | null>(null);
export const EditorTimelineStateContext = createContext<EditorTimelineState | null>(null);
