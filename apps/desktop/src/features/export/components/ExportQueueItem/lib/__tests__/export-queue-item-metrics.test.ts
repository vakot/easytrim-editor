import { describe, expect, it } from "vitest";

import type { ExportAttempt } from "@/domain/editing-instance";

import { getDuration } from "../export-queue-item-metrics";

const attempt = {
  metrics: {
    durationMs: 2_500,
    phase: "preparing",
    progressPercent: 0,
  },
} as ExportAttempt;

describe("export queue item metrics", () => {
  it("hides elapsed time while the GIF palette is being prepared", () => {
    expect(
      getDuration(attempt, {
        formatValue: (value) => value,
        status: "rendering",
      }),
    ).toBeNull();
  });

  it("shows elapsed time after GIF output progress begins", () => {
    expect(
      getDuration(
        {
          ...attempt,
          metrics: { ...attempt.metrics, phase: "running" },
        },
        {
          formatValue: (value) => value,
          status: "rendering",
        },
      ),
    ).toEqual({ id: "duration", value: "0:02" });
  });
});
