import { describe, expect, it } from "vitest";

import {
  estimateExportSize,
  estimateExportTime,
  formatExportDuration,
  formatExportFileSize,
  getExportMetricValues,
  parseFfmpegBitrate,
  parseFfmpegSpeed,
} from "../export-metrics";

describe("export metrics", () => {
  it("prefers FFmpeg metrics when they are available", () => {
    const values = getExportMetricValues(
      createAttempt({
        bitrate: "800 kbits/s",
        currentFrame: 40,
        estimatedElapsedTimeMs: 1_500,
        estimatedFileSizeBytes: 2_000,
        estimatedTotalTimeMs: 3_000,
        fileSizeBytes: 1_000,
        fps: 24,
        phase: "running",
        progressPercent: 38,
        totalFrames: 100,
      }),
    );

    expect(values).toMatchObject({
      bitrate: "800 kbits/s",
      currentFrame: 40,
      estimatedElapsedTimeMs: 1_500,
      estimatedFileSizeBytes: 2_000,
      estimatedTotalTimeMs: 3_000,
      fileSizeBytes: 1_000,
      fps: 24,
      indeterminate: false,
      progressPercent: 38,
      totalFrames: 100,
    });
  });

  it("prefers FFmpeg's zero progress while the export is running", () => {
    const values = getExportMetricValues(
      createAttempt({
        currentFrame: 40,
        phase: "running",
        progressPercent: 0,
        totalFrames: 100,
      }),
    );

    expect(values.progressPercent).toBe(0);
  });

  it("derives GIF progress, FPS, time, bitrate, and size from available measurements", () => {
    const values = getExportMetricValues(
      createAttempt({
        currentFrame: 450,
        durationMs: 25_000,
        fileSizeBytes: 1_024,
        phase: "preparing",
        progressPercent: 0,
        totalFrames: 600,
      }),
    );

    expect(values).toMatchObject({
      bitrate: "10.9 kbits/s",
      currentFrame: 450,
      durationMs: 25_000,
      estimatedElapsedTimeMs: 25_000,
      estimatedFileSizeBytes: 1_024 / 0.75,
      estimatedTotalTimeMs: 25_000 / 0.75,
      fileSizeBytes: 1_024,
      fps: 18,
      indeterminate: false,
      progressPercent: 75,
      totalFrames: 600,
    });
  });

  it("keeps GIF progress indeterminate when palette preparation reports zero frames", () => {
    const values = getExportMetricValues(
      createAttempt({
        currentFrame: 0,
        phase: "preparing",
        progressPercent: 0,
        totalFrames: 600,
      }),
    );

    expect(values).toMatchObject({
      indeterminate: true,
      progressPercent: null,
      totalFrames: 600,
    });
  });

  it("estimates current and final file size from FFmpeg bitrate and frame progress", () => {
    const values = getExportMetricValues(
      createAttempt({
        bitrate: "800 kbits/s",
        currentFrame: 50,
        durationMs: 5_000,
        phase: "preparing",
        progressPercent: 0,
        totalFrames: 100,
      }),
    );

    expect(values.fileSizeBytes).toBe(50_000);
    expect(values.estimatedFileSizeBytes).toBe(100_000);
    expect(values.estimatedElapsedTimeMs).toBe(5_000);
    expect(values.estimatedTotalTimeMs).toBe(10_000);
  });

  it("keeps available GIF file metrics when progress cannot be derived", () => {
    const values = getExportMetricValues(
      createAttempt({
        bitrate: "500 kbits/s",
        durationMs: 2_000,
        fileSizeBytes: 1_024,
        phase: "preparing",
        progressPercent: 0,
      }),
    );

    expect(values).toMatchObject({
      bitrate: "500 kbits/s",
      durationMs: 2_000,
      estimatedElapsedTimeMs: 2_000,
      estimatedFileSizeBytes: 62_500,
      fileSizeBytes: 1_024,
      indeterminate: true,
      progressPercent: null,
    });
    expect(values.currentFrame).toBeUndefined();
    expect(values.estimatedTotalTimeMs).toBeUndefined();
    expect(values.fps).toBeUndefined();
  });

  it("parses FFmpeg speed and bitrate values", () => {
    expect(parseFfmpegSpeed("2.00x")).toBe(2);
    expect(parseFfmpegBitrate("800 kbits/s")).toBe(800_000);
    expect(parseFfmpegSpeed("N/A")).toBeNull();
    expect(parseFfmpegBitrate("N/A")).toBeNull();
  });

  it("calculates elapsed and total time from FFmpeg speed", () => {
    expect(estimateExportTime(5_000_000, 20_000_000, "2x")).toEqual({
      elapsedMs: 2_500,
      totalMs: 10_000,
    });
  });

  it("uses FFmpeg total size and bitrate for a deterministic size estimate", () => {
    expect(estimateExportSize(250_000, "800 kbits/s", 2_500_000, 10_000_000)).toEqual({
      currentBytes: 250_000,
      totalBytes: 1_000_000,
    });
  });

  it("falls back to the observed output ratio when bitrate is unavailable", () => {
    expect(estimateExportSize(250_000, undefined, 2_500_000, 10_000_000)).toEqual({
      currentBytes: 250_000,
      totalBytes: 1_000_000,
    });
  });

  it("formats both estimates consistently with frame progress", () => {
    expect(formatExportDuration(65_000)).toBe("1:05");
    expect(formatExportFileSize(1_000_000)).toBe("977 KB");
  });
});

function createAttempt(metrics: Record<string, number | string | undefined>) {
  return {
    metrics: {
      durationMs: null,
      progressPercent: 0,
      ...metrics,
    },
    request: {
      audioTracks: [],
      mergeAudio: false,
      rotationDegrees: 0,
      sourcePath: "C:/Videos/source.mp4",
      trim: { endMicros: 1_000_000, startMicros: 0 },
    },
    route: "gif",
    state: { operationId: "operation-1", startedAt: 0, status: "rendering" },
  } as Parameters<typeof getExportMetricValues>[0];
}
