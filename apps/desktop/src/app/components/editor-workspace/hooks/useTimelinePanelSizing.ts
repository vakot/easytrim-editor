import { useLayoutEffect, useMemo } from "react";

import { usePanelRef } from "@/components/ui/resizable";

import {
  type TimelinePanelSizeConstraints,
  timelinePanelSizeConstraints,
} from "../lib/timeline-pane-sizing.utils";

const PENDING_SOURCE_CONSTRAINTS = {
  minSize: 170,
  defaultSize: 170,
  maxSize: "100%",
} as const;
const EMPTY_TIMELINE_CONSTRAINTS = timelinePanelSizeConstraints(0);

export function timelinePanelTargetSize(
  currentSize: number,
  constraints: TimelinePanelSizeConstraints,
): number {
  return Math.min(constraints.maxSize, Math.max(constraints.minSize, currentSize));
}

export function useTimelinePanelSizing(hasSource: boolean, audioTrackCount: number | null) {
  const panelRef = usePanelRef();
  const constraints = useMemo(
    () =>
      !hasSource
        ? EMPTY_TIMELINE_CONSTRAINTS
        : audioTrackCount === null
          ? PENDING_SOURCE_CONSTRAINTS
          : timelinePanelSizeConstraints(audioTrackCount),
    [audioTrackCount, hasSource],
  );

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    if (!hasSource) {
      if (!panel.isCollapsed()) {
        const currentSize = panel.getSize().inPixels;
        if (Math.abs(currentSize - EMPTY_TIMELINE_CONSTRAINTS.defaultSize) >= 1) {
          panel.resize(EMPTY_TIMELINE_CONSTRAINTS.defaultSize);
        }
      }
      return;
    }

    if (audioTrackCount === null) return;

    if (panel.isCollapsed()) {
      return;
    }

    const currentSize = panel.getSize().inPixels;
    const targetSize = timelinePanelTargetSize(
      currentSize,
      timelinePanelSizeConstraints(audioTrackCount),
    );

    if (Math.abs(currentSize - targetSize) >= 1) {
      panel.resize(targetSize);
    }
  }, [audioTrackCount, hasSource, panelRef]);

  return {
    constraints,
    collapsedSize: 0,
    initialDefaultSize: EMPTY_TIMELINE_CONSTRAINTS.defaultSize,
    panelRef,
  };
}
