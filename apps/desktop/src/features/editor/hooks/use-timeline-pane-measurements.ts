import { useLayoutEffect, useRef } from "react";

import {
  timelinePanelSizeConstraints,
  type TimelinePanelSizeConstraints,
} from "../utils/timeline-pane-sizing";

export function useTimelinePaneMeasurements(
  onSizeConstraintsChange: (constraints: TimelinePanelSizeConstraints) => void,
) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const audioContentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    const audioContent = audioContentRef.current;
    if (!timeline || !audioContent) {
      return;
    }
    const timelineElement: HTMLDivElement = timeline;
    const audioContentElement: HTMLDivElement = audioContent;

    function measure() {
      const timelineHeight = Math.max(
        timelineElement.scrollHeight,
        timelineElement.getBoundingClientRect().height,
      );
      const audioContentBounds = audioContentElement.getBoundingClientRect();
      const audioContentHeight = Math.max(
        audioContentElement.scrollHeight,
        audioContentBounds.height,
      );
      if (timelineHeight <= 0 || audioContentHeight <= 0) {
        return;
      }

      const firstTrack = audioContentElement.querySelector<HTMLElement>(
        '[data-slot="audio-track-row"]',
      );
      const paddingBottom =
        Number.parseFloat(getComputedStyle(audioContentElement).paddingBottom) || 0;
      const firstTrackBottom = firstTrack
        ? firstTrack.getBoundingClientRect().bottom - audioContentBounds.top + paddingBottom
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
    observer.observe(audioContentElement);

    return () => observer.disconnect();
  }, [onSizeConstraintsChange]);

  return { timelineRef, audioContentRef };
}
