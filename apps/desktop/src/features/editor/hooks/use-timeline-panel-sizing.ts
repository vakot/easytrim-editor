import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { usePanelRef } from "react-resizable-panels";

import type { TimelinePanelSizeConstraints } from "../utils/timeline-pane-sizing";

const FALLBACK_CONSTRAINTS = {
  minSize: "10rem",
  defaultSize: "22rem",
  maxSize: "70%",
} as const;

export function useTimelinePanelSizing(sourceId: string) {
  const panelRef = usePanelRef();
  const initializedSourceRef = useRef<string | null>(null);
  const [measuredConstraints, setMeasuredConstraints] =
    useState<TimelinePanelSizeConstraints | null>(null);

  const handleSizeConstraintsChange = useCallback((next: TimelinePanelSizeConstraints) => {
    setMeasuredConstraints((current) =>
      current &&
      current.minSize === next.minSize &&
      current.defaultSize === next.defaultSize &&
      current.maxSize === next.maxSize
        ? current
        : next,
    );
  }, []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !measuredConstraints) {
      return;
    }

    const currentSize = panel.getSize().inPixels;
    const targetSize =
      initializedSourceRef.current === sourceId
        ? Math.min(measuredConstraints.maxSize, Math.max(measuredConstraints.minSize, currentSize))
        : measuredConstraints.defaultSize;

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
