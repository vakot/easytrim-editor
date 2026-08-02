import { useLayoutEffect, useRef } from "react";

import {
  timelinePanelSizeConstraints,
  type TimelinePanelSizeConstraints,
} from "../utils/timeline-pane-sizing";

export function useTimelinePaneMeasurements(
  onSizeConstraintsChange: (constraints: TimelinePanelSizeConstraints) => void,
  hasAudioContent: boolean,
) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const audioContentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    const audioContent = audioContentRef.current;
    if (!timeline) {
      return;
    }
    const timelineElement: HTMLDivElement = timeline;
    const audioContentElement: HTMLDivElement | null = audioContent;

    function measure() {
      const timelineHeight = Math.max(
        timelineElement.scrollHeight,
        timelineElement.getBoundingClientRect().height,
      );
      const audioContentBounds = audioContentElement?.getBoundingClientRect();
      const audioContentHeight = audioContentElement
        ? Math.max(audioContentElement.scrollHeight, audioContentBounds?.height ?? 0)
        : 0;
      if (timelineHeight <= 0 || (hasAudioContent && audioContentHeight <= 0)) {
        return;
      }

      const firstTrack = audioContentElement?.querySelector<HTMLElement>(
        '[data-slot="audio-track-row"]',
      );
      const paddingBottom = audioContentElement
        ? Number.parseFloat(getComputedStyle(audioContentElement).paddingBottom) || 0
        : 0;
      const firstTrackBottom = firstTrack
        ? firstTrack.getBoundingClientRect().bottom - (audioContentBounds?.top ?? 0) + paddingBottom
        : null;

      onSizeConstraintsChange(
        timelinePanelSizeConstraints({
          timelineHeight,
          audioContentHeight,
          firstTrackBottom,
        }),
      );
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(timelineElement);
    if (audioContentElement) {
      observer.observe(audioContentElement);
    }

    return () => observer.disconnect();
  }, [hasAudioContent, onSizeConstraintsChange]);

  return { timelineRef, audioContentRef };
}
