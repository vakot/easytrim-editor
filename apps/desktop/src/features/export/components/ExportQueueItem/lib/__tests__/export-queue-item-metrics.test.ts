import { describe, expect, it } from "vitest";

import type { ExportAttempt } from "@/domain/editing-instance";

import { getDuration, getFileSize, getFps, getProgress } from "../export-queue-item-metrics";

const attempt = {
  metrics: {
    durationMs: 2_500,
    phase: "preparing",
    progressPercent: 0,
  },
  route: "gif",
} as ExportAttempt;

describe("export queue item metrics", () => {
  it("hides elapsed time while GIF rendering is indeterminate", () => {
    expect(
      getDuration(attempt, {
        formatValue: (value) => value,
        status: "rendering",
      }),
    ).toBeNull();
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

  it("does not show a numeric progress metric from FFmpeg's final event before GIF completion", () => {
    expect(
      getProgress(
        {
          ...attempt,
          metrics: { ...attempt.metrics, phase: "completed", progressPercent: 100 },
        },
        { status: "rendering" },
      ),
    ).toBeNull();
  });

  it("hides partial GIF size and frame-rate values while rendering", () => {
    const partialAttempt = {
      ...attempt,
      metrics: { ...attempt.metrics, fileSizeBytes: 1_024, fps: 15 },
    };

    expect(getFileSize(partialAttempt, { status: "rendering" })).toBeNull();
    expect(
      getFps(partialAttempt, { formatValue: (value) => value, status: "rendering" }),
    ).toBeNull();
  });
});
