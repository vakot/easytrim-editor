import { describe, expect, it } from "vitest";

import type { ExportAttempt } from "@/domain/editing-instance";

import { getDuration, getFileSize, getFps, getProgress } from "../export-queue-item-metrics";

const attempt = {
  metrics: {
    durationMs: 2_500,
    phase: "preparing",
    progressPercent: 0,
  },
  request: { trim: { endMicros: 1_000_000, startMicros: 0 } },
  route: "gif",
} as ExportAttempt;

describe("export queue item metrics", () => {
  it("shows elapsed time even when GIF progress is indeterminate", () => {
    expect(
      getDuration(attempt, {
        formatValue: (value) => value,
        status: "rendering",
      }),
    ).toEqual({ id: "duration", value: "0:02" });
  });

  it("shows spent and estimated total time together while rendering", () => {
    expect(
      getDuration(
        {
          ...attempt,
          metrics: {
            ...attempt.metrics,
            estimatedElapsedTimeMs: 25_000,
            estimatedTotalTimeMs: 36_000,
          },
        },
        {
          formatValue: (value) => value,
          status: "rendering",
        },
      ),
    ).toEqual({ id: "duration", value: "0:25 / 0:36" });
  });

  it("shows elapsed time after GIF output completes", () => {
    expect(
      getDuration(
        {
          ...attempt,
          metrics: { ...attempt.metrics, phase: "completed" },
        },
        {
          formatValue: (value) => value,
          status: "completed",
        },
      ),
    ).toEqual({ id: "duration", value: "0:02" });
  });

  it("does not show a numeric progress metric while GIF rendering is indeterminate", () => {
    expect(getProgress(attempt, { status: "rendering" })).toBeNull();
  });

  it("shows FFmpeg's final progress value before queue completion", () => {
    expect(
      getProgress(
        {
          ...attempt,
          metrics: { ...attempt.metrics, phase: "completed", progressPercent: 100 },
        },
        { status: "rendering" },
      ),
    ).toEqual({ id: "progress", value: "100%" });
  });

  it("keeps FFmpeg-provided size and frame-rate values while progress is indeterminate", () => {
    const partialAttempt = {
      ...attempt,
      metrics: { ...attempt.metrics, fileSizeBytes: 1_024, fps: 15 },
    };

    expect(getFileSize(partialAttempt, { status: "rendering" })).toEqual({
      id: "file-size",
      value: "1.0 KB",
    });
    expect(getFps(partialAttempt, { formatValue: (value) => value, status: "rendering" })).toEqual({
      id: "fps",
      value: "15.0",
    });
  });
});
