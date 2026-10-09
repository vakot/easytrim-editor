import { describe, expect, it } from "vitest";

import { createDefaultEditorSnapshot } from "@/app/store/integration/editor-snapshot";
import {
  createExportAttempt,
  type ExportAttempt,
  type ExportRoute,
} from "@/domain/editing-instance";
import { firstSource } from "@/test/source.fixtures";

import {
  getDuration,
  getFileSize,
  getFileSizeChange,
  getFps,
  getProgress,
} from "../export-queue-item-metrics";

function createAttempt(route: ExportRoute): ExportAttempt {
  const source = { ...firstSource, fileSizeBytes: 1_000 };
  const baseRequest = {
    audioTracks: [],
    mergeAudio: false,
    sourcePath: source.sourcePath,
    trim: { endMicros: 12_000_000, startMicros: 2_000_000 },
  };

  const request =
    route === "audio"
      ? { ...baseRequest, format: "m4a" as const }
      : { ...baseRequest, rotationDegrees: 0 as const };

  const attempt = createExportAttempt({
    capturedAt: 1,
    id: `attempt-${route}`,
    output: {
      displayName: "output.mp4",
      displayPath: "C:/Exports/output.mp4",
      outputId: "output",
    },
    request,
    route,
    snapshot: createDefaultEditorSnapshot(source, false),
  });

  attempt.metrics = { ...attempt.metrics, fileSizeBytes: 2_000, fps: 30 };
  attempt.state = {
    completedAt: 2,
    result: {
      displayName: "output.mp4",
      displayPath: "C:/Exports/output.mp4",
      operationId: "operation",
    },
    status: "completed",
  };

  return attempt;
}

describe("export queue item metrics", () => {
  it("shows elapsed time even when GIF progress is indeterminate", () => {
    const attempt = createAttempt("gif");
    attempt.metrics = { ...attempt.metrics, durationMs: 2_500, phase: "preparing" };

    expect(
      getDuration(attempt, {
        formatValue: (value) => value,
        status: "rendering",
      }),
    ).toEqual({ id: "duration", value: "0:02" });
  });

  it("shows spent and estimated total time together while rendering", () => {
    const attempt = createAttempt("gif");
    attempt.metrics = {
      ...attempt.metrics,
      durationMs: 25_000,
      estimatedElapsedTimeMs: 25_000,
      estimatedTotalTimeMs: 36_000,
      phase: "running",
    };

    expect(
      getDuration(attempt, {
        formatValue: (value) => value,
        status: "rendering",
      }),
    ).toEqual({ id: "duration", value: "0:25 / 0:36" });
  });

  it("shows elapsed time after GIF output completes", () => {
    const attempt = createAttempt("gif");
    attempt.metrics = { ...attempt.metrics, durationMs: 2_500, phase: "completed" };

    expect(
      getDuration(attempt, {
        formatValue: (value) => value,
        status: "completed",
      }),
    ).toEqual({ id: "duration", value: "0:02" });
  });

  it("omits FPS and source size comparison for audio exports", () => {
    const attempt = createAttempt("audio");

    expect(getFps(attempt, { formatValue: (value) => value })).toBeNull();
    expect(
      getFileSizeChange(attempt, {
        formatValue: (value) => value,
      }),
    ).toBeNull();
  });

  it("keeps FPS and source size comparison for video exports", () => {
    const attempt = createAttempt("fast");

    expect(getFps(attempt, { formatValue: (value) => value })).toMatchObject({
      id: "fps",
      value: "30.0",
    });
    expect(
      getFileSizeChange(attempt, {
        formatValue: (value) => value,
      }),
    ).toMatchObject({ id: "file-size-change", value: "+100% (1000 B)" });
  });

  it("does not show a numeric progress metric while GIF rendering is indeterminate", () => {
    const attempt = createAttempt("gif");
    attempt.metrics = { ...attempt.metrics, phase: "preparing", progressAvailable: false };

    expect(getProgress(attempt, { status: "rendering" })).toBeNull();
  });

  it("shows FFmpeg's final progress value before queue completion", () => {
    const attempt = createAttempt("gif");
    attempt.metrics = {
      ...attempt.metrics,
      phase: "completed",
      progressAvailable: true,
      progressPercent: 100,
    };

    expect(getProgress(attempt, { status: "rendering" })).toEqual({
      id: "progress",
      value: "100%",
    });
  });

  it("keeps FFmpeg-provided size and frame-rate values while progress is indeterminate", () => {
    const attempt = createAttempt("gif");
    attempt.metrics = {
      ...attempt.metrics,
      fileSizeBytes: 1_024,
      fps: 15,
      phase: "preparing",
      progressAvailable: false,
    };

    expect(getFileSize(attempt, { status: "rendering" })).toEqual({
      id: "file-size",
      value: "1.0 KB",
    });
    expect(getFps(attempt, { formatValue: (value) => value, status: "rendering" })).toEqual({
      id: "fps",
      value: "15.0",
    });
  });
});
