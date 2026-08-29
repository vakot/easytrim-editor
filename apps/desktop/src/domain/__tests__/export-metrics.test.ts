import { describe, expect, it } from "vitest";

import {
  estimateExportSize,
  estimateExportTime,
  formatExportDuration,
  formatExportFileSize,
  parseFfmpegBitrate,
  parseFfmpegSpeed,
} from "../export-metrics";

describe("export metrics", () => {
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
