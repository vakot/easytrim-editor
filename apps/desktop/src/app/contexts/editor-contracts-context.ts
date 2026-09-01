import { createContext } from "react";

import type { EditorInteractionRuntime } from "@/app/hooks/useEditorInteractionController";

export type EditorPlaybackInteraction = Pick<
  EditorInteractionRuntime,
  | "audioPlayheadRef"
  | "isPlaybackReady"
  | "isPlaying"
  | "nativeLoopEnabled"
  | "onCanPlay"
  | "onCropToolOpenChange"
  | "onEnded"
  | "onLoadedMetadata"
  | "onPause"
  | "onPlay"
  | "onPreviewPlaybackError"
  | "onSetSegmentBoundary"
  | "onStepFrame"
  | "onTimeUpdate"
  | "onTogglePlayback"
  | "transportError"
  | "videoMuted"
  | "videoRef"
>;

export type EditorTimelineState = Pick<
  EditorInteractionRuntime,
  "canSetSegmentEnd" | "canSetSegmentStart" | "displayedPlayheadMicros" | "playheadRef"
>;

export type EditorTimelineCommands = Pick<
  EditorInteractionRuntime,
  | "onScrub"
  | "onScrubEnd"
  | "onScrubStart"
  | "onSeek"
  | "onSegmentDragEnd"
  | "onSegmentDragStart"
  | "onSegmentMove"
  | "onTrimBoundaryChange"
  | "onTrimDragEnd"
  | "onTrimDragStart"
>;

export const EditorPlaybackContext = createContext<EditorPlaybackInteraction | null>(null);
export const EditorTimelineCommandsContext = createContext<EditorTimelineCommands | null>(null);
export const EditorTimelineStateContext = createContext<EditorTimelineState | null>(null);
