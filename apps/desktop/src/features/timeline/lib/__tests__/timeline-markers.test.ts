import { describe, expect, it } from "vitest";

import { createTimelineMarkers, timelineMarkerTimes } from "../timeline-markers";

function track(streamIndex: number, visible = true) {
  return {
    activityAnalysis: {
      operationId: `activity-${streamIndex}`,
      status: "ready" as const,
      value: [{ startMicros: 20, endMicros: 40 }],
    },
    activityVisible: visible,
    enabled: true,
    loudnessAnalysis: { status: "idle" },
    processing: { gainDb: 0 },
    streamIndex,
    waveform: { status: "idle" },
  };
}

describe("timeline markers", () => {
  it("combines scenes, visible per-track activity boundaries, and chapters in time order", () => {
    const markers = createTimelineMarkers(
      [30],
      [track(2), track(4, false)],
      (streamIndex) => `color-${streamIndex}`,
      [{ chapterId: "chapter-1", timeMicros: 10 }],
    );

    expect(markers).toEqual([
      { chapterId: "chapter-1", kind: "chapter", timeMicros: 10 },
      { color: "color-2", kind: "audioActivity", streamIndex: 2, timeMicros: 20 },
      { kind: "scene", timeMicros: 30 },
      { color: "color-2", kind: "audioActivity", streamIndex: 2, timeMicros: 40 },
    ]);
    expect(timelineMarkerTimes(markers)).toEqual([10, 20, 30, 40]);
  });
});
