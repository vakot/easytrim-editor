import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { usePanelRef } from "react-resizable-panels";

import {
  TIMELINE_FIXED_HEIGHT,
  timelinePanelSizeConstraints,
  type TimelinePanelSizeConstraints,
} from "../utils/timeline-pane-sizing";

const FALLBACK_CONSTRAINTS = {
  minSize: "10rem",
  defaultSize: "22rem",
  maxSize: "70%",
} as const;

export function timelinePanelTargetSize(
  currentSize: number,
  constraints: TimelinePanelSizeConstraints,
  initialize: boolean,
): number {
  if (initialize) {
    return constraints.defaultSize;
  }
  return Math.min(constraints.maxSize, Math.max(constraints.minSize, currentSize));
}

export function useTimelinePanelSizing(
  sourceId: string,
  audioTrackCount: number,
  isVisible: boolean,
) {
  const panelRef = usePanelRef();
  const initializedSourceRef = useRef<string | null>(null);
  const constraints = useMemo(
    () => timelinePanelSizeConstraints(audioTrackCount),
    [audioTrackCount],
  );

  const resetToDefault = useCallback(
    () => panelRef.current?.resize(constraints.defaultSize),
    [constraints.defaultSize, panelRef],
  );

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const currentSize = panel.getSize().inPixels;
    const targetSize = timelinePanelTargetSize(
      currentSize,
      constraints,
      initializedSourceRef.current === null,
    );

    initializedSourceRef.current = sourceId;
    if (Math.abs(currentSize - targetSize) >= 1) {
      panel.resize(targetSize);
    }
  }, [constraints, panelRef, sourceId]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    if (isVisible) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [isVisible, panelRef]);

  return {
    constraints,
    collapsedSize: TIMELINE_FIXED_HEIGHT,
    initialDefaultSize: FALLBACK_CONSTRAINTS.defaultSize,
    panelRef,
    resetToDefault,
  };
}
