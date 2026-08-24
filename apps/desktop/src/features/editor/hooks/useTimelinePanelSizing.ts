import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePanelRef } from "react-resizable-panels";

import {
  timelinePanelSizeConstraints,
  type TimelinePanelSizeConstraints,
} from "../utils/timeline-pane-sizing";

const FALLBACK_CONSTRAINTS = {
  minSize: "10rem",
  defaultSize: "22rem",
  maxSize: "70%",
} as const;
const EMPTY_TIMELINE_CONSTRAINTS = timelinePanelSizeConstraints(0);

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

export function timelinePanelConstraintsForSource(
  audioTrackCount: number | null,
  previousConstraints: TimelinePanelSizeConstraints | null,
): TimelinePanelSizeConstraints | null {
  return audioTrackCount === null
    ? previousConstraints
    : timelinePanelSizeConstraints(audioTrackCount);
}

export function useTimelinePanelSizing(
  sourceId: string | null,
  audioTrackCount: number | null,
  isVisible: boolean,
) {
  const panelRef = usePanelRef();
  const initializedSourceRef = useRef<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    audioTrackCount: number;
    constraints: TimelinePanelSizeConstraints;
  } | null>(() =>
    audioTrackCount === null
      ? null
      : { audioTrackCount, constraints: timelinePanelSizeConstraints(audioTrackCount) },
  );
  const constraints =
    sourceId === null
      ? EMPTY_TIMELINE_CONSTRAINTS
      : (confirmed?.constraints ?? FALLBACK_CONSTRAINTS);

  useLayoutEffect(() => {
    if (audioTrackCount === null) return;
    // Keep the last confirmed constraints while replacement metadata is pending.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfirmed((current) => {
      const nextConstraints = timelinePanelConstraintsForSource(
        audioTrackCount,
        current?.constraints ?? null,
      );
      if (!nextConstraints) return current;
      if (current?.audioTrackCount === audioTrackCount) return current;
      return { audioTrackCount, constraints: nextConstraints };
    });
  }, [audioTrackCount]);

  const resetToDefault = useCallback(
    () => panelRef.current?.resize(constraints.defaultSize),
    [constraints.defaultSize, panelRef],
  );

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    if (sourceId === null) {
      initializedSourceRef.current = null;
      if (!panel.isCollapsed()) {
        const currentSize = panel.getSize().inPixels;
        if (Math.abs(currentSize - EMPTY_TIMELINE_CONSTRAINTS.defaultSize) >= 1) {
          panel.resize(EMPTY_TIMELINE_CONSTRAINTS.defaultSize);
        }
      }
      return;
    }

    if (audioTrackCount === null || confirmed?.audioTrackCount !== audioTrackCount) return;

    if (panel.isCollapsed()) {
      return;
    }

    const currentSize = panel.getSize().inPixels;
    const targetSize = timelinePanelTargetSize(
      currentSize,
      confirmed.constraints,
      initializedSourceRef.current === null,
    );

    initializedSourceRef.current = sourceId;
    if (Math.abs(currentSize - targetSize) >= 1) {
      panel.resize(targetSize);
    }
  }, [audioTrackCount, confirmed, panelRef, sourceId]);

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
    collapsedSize: 0,
    initialDefaultSize: EMPTY_TIMELINE_CONSTRAINTS.defaultSize,
    panelRef,
    resetToDefault,
  };
}
