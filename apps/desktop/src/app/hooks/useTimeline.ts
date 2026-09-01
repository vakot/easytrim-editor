import { useContext } from "react";

import {
  EditorTimelineCommandsContext,
  EditorTimelineStateContext,
} from "@/app/contexts/editor-contracts-context";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectTrim } from "@/app/store/slices/trim-slice";

export function useTimelineState() {
  const state = useContext(EditorTimelineStateContext);
  if (!state) {
    throw new Error("Timeline state must be used within EditorContractsProvider.");
  }
  return state;
}

export function useTimelineCommands() {
  const commands = useContext(EditorTimelineCommandsContext);
  if (!commands) {
    throw new Error("Timeline commands must be used within EditorContractsProvider.");
  }
  return commands;
}

export function useTimeline() {
  const state = useTimelineState();
  const commands = useTimelineCommands();
  const trim = useAppSelector(selectTrim);
  return {
    trim,
    playheadMicros: state.displayedPlayheadMicros,
    playheadRef: state.playheadRef,
    canSetSegmentStart: state.canSetSegmentStart,
    canSetSegmentEnd: state.canSetSegmentEnd,
    onChange: commands.onTrimBoundaryChange,
    onMoveSegment: commands.onSegmentMove,
    onTrimDragStart: commands.onTrimDragStart,
    onTrimDragEnd: commands.onTrimDragEnd,
    onSegmentDragStart: commands.onSegmentDragStart,
    onSegmentDragEnd: commands.onSegmentDragEnd,
    onSeek: commands.onSeek,
    onScrubStart: commands.onScrubStart,
    onScrub: commands.onScrub,
    onScrubEnd: commands.onScrubEnd,
  };
}
