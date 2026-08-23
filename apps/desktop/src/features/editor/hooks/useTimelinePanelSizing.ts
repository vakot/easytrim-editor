import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
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

export function timelinePanelTargetSize(
  currentSize: number,
  constraints: TimelinePanelSizeConstraints,
  initialize: boolean,
  preferredSize?: number,
): number {
  const targetSize = preferredSize ?? (initialize ? constraints.defaultSize : currentSize);
  return Math.min(constraints.maxSize, Math.max(constraints.minSize, targetSize));
}

export function useTimelinePanelSizing(sourceId: string, audioTrackCount: number) {
  const panelRef = usePanelRef();
  const initializedSourceRef = useRef<string | null>(null);
  const lastVisibleSizeRef = useRef<number | null>(null);
  const wasAudioPanelVisibleRef = useRef(audioTrackCount > 0);
  const constraints = useMemo(
    () => timelinePanelSizeConstraints(audioTrackCount),
    [audioTrackCount],
  );

  const rememberVisibleSize = useCallback(
    (size: number) => {
      if (audioTrackCount > 0) {
        lastVisibleSizeRef.current = size;
      }
    },
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
    const isAudioPanelVisible = audioTrackCount > 0;
    const isRestoringVisibleSize =
      isAudioPanelVisible &&
      !wasAudioPanelVisibleRef.current &&
      lastVisibleSizeRef.current !== null;
    const targetSize = timelinePanelTargetSize(
      currentSize,
      constraints,
      initializedSourceRef.current === null,
      isRestoringVisibleSize ? (lastVisibleSizeRef.current ?? undefined) : undefined,
    );

    initializedSourceRef.current = sourceId;
    wasAudioPanelVisibleRef.current = isAudioPanelVisible;
    if (isAudioPanelVisible) {
      lastVisibleSizeRef.current = targetSize;
    }
    if (Math.abs(currentSize - targetSize) >= 1) {
      panel.resize(targetSize);
    }
  }, [constraints, panelRef, sourceId]);

  return {
    constraints,
    initialDefaultSize: FALLBACK_CONSTRAINTS.defaultSize,
    panelRef,
    rememberVisibleSize,
    resetToDefault,
  };
}
