import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

import { getUsageStatistics } from "../statistics";

const nativeStatistics = {
  audioExports: 4,
  firstExportAtMillis: 1_700_000_000_000,
  gifExports: 5,
  lastExportAtMillis: 1_700_000_500_000,
  longestExportMillis: 2_000,
  losslessExports: 2,
  outputBytes: 1_024,
  processingMillis: 3_500,
  optimizedExports: 1,
  sourceBytes: 4_096,
};

describe("usage statistics IPC adapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads statistics through the narrow command", async () => {
    mocks.invoke.mockResolvedValue(nativeStatistics);

    await expect(getUsageStatistics()).resolves.toEqual(nativeStatistics);
    expect(mocks.invoke).toHaveBeenCalledWith("get_usage_statistics");
  });

  it("accepts missing timestamps before the first export", async () => {
    mocks.invoke.mockResolvedValue({
      ...nativeStatistics,
      firstExportAtMillis: null,
      lastExportAtMillis: null,
    });

    await expect(getUsageStatistics()).resolves.toMatchObject({
      firstExportAtMillis: null,
      lastExportAtMillis: null,
    });
  });

  it.each([
    ["a missing response", null],
    ["a negative count", { ...nativeStatistics, optimizedExports: -1 }],
    ["a negative longest export", { ...nativeStatistics, longestExportMillis: -1 }],
    ["a fractional longest export", { ...nativeStatistics, longestExportMillis: 1.5 }],
    ["a missing longest export", { ...nativeStatistics, longestExportMillis: undefined }],
    ["a fractional size", { ...nativeStatistics, sourceBytes: 1.5 }],
    ["a non-numeric timestamp", { ...nativeStatistics, lastExportAtMillis: "yesterday" }],
  ])("rejects %s", async (_label, value) => {
    mocks.invoke.mockResolvedValue(value);

    await expect(getUsageStatistics()).rejects.toMatchObject({ code: "internal" });
  });
});
