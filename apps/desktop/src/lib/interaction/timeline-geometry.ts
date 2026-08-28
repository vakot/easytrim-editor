import type { CSSProperties } from "react";

import { timelinePercent, type TrimRange } from "@/domain/trim";

interface TimelineGeometryVariables {
  "--timeline-trim-start": string;
  "--timeline-trim-end": string;
  "--timeline-trim-end-inset": string;
  "--timeline-trim-center": string;
}

export function timelineGeometryVariables(range: TrimRange): TimelineGeometryVariables {
  const startPercent = timelinePercent(range.startMicros, range.sourceDurationMicros);
  const endPercent = timelinePercent(range.endMicros, range.sourceDurationMicros);
  const centerPercent = timelinePercent(
    range.startMicros + (range.endMicros - range.startMicros) / 2,
    range.sourceDurationMicros,
  );

  return {
    "--timeline-trim-start": `${startPercent}%`,
    "--timeline-trim-end": `${endPercent}%`,
    "--timeline-trim-end-inset": `${100 - endPercent}%`,
    "--timeline-trim-center": `${centerPercent}%`,
  };
}

export function timelineGeometryStyle(range: TrimRange): CSSProperties {
  return timelineGeometryVariables(range) as CSSProperties;
}

export function syncTimelineGeometry(element: HTMLElement | null, range: TrimRange) {
  if (!element) return;
  const variables = timelineGeometryVariables(range);
  for (const [property, value] of Object.entries(variables)) {
    element.style.setProperty(property, value);
  }
}
