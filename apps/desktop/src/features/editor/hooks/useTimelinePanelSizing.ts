import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { usePanelRef } from "react-resizable-panels";

import type { TimelinePanelSizeConstraints } from "../utils/timeline-pane-sizing";

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

export function useTimelinePanelSizing(sourceId: string) {
  const panelRef = usePanelRef();
  const initializedSourceRef = useRef<string | null>(null);
  const measuredSourceRef = useRef<string | null>(null);
  const [measuredConstraints, setMeasuredConstraints] =
    useState<TimelinePanelSizeConstraints | null>(null);

  const handleSizeConstraintsChange = useCallback(
    (next: TimelinePanelSizeConstraints) => {
      measuredSourceRef.current = sourceId;
      setMeasuredConstraints(next);
    },
    [sourceId],
  );

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !measuredConstraints || measuredSourceRef.current !== sourceId) {
      return;
    }

    const currentSize = panel.getSize().inPixels;
    const targetSize = timelinePanelTargetSize(
      currentSize,
      measuredConstraints,
      initializedSourceRef.current === null,
    );

    initializedSourceRef.current = sourceId;
    if (Math.abs(currentSize - targetSize) >= 1) {
      panel.resize(targetSize);
    }
  }, [measuredConstraints, panelRef, sourceId]);

  return {
    constraints: measuredConstraints ?? FALLBACK_CONSTRAINTS,
    panelRef,
    onSizeConstraintsChange: handleSizeConstraintsChange,
  };
}
