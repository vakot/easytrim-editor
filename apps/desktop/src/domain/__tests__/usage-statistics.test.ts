import { describe, expect, it } from "vitest";

import { getCompletedExports, getStorageSavedBytes } from "@/domain/usage-statistics";
import { emptyUsageStatistics } from "@/test/usage-statistics.fixtures";

describe("usage statistics", () => {
  it("counts every export route as completed exports", () => {
    expect(getCompletedExports(emptyUsageStatistics)).toBe(0);
    expect(
      getCompletedExports({
        ...emptyUsageStatistics,
        audioExports: 4,
        gifExports: 1,
        losslessExports: 2,
        optimizedExports: 3,
      }),
    ).toBe(10);
  });

  it("reports storage saved as a signed difference", () => {
    expect(
      getStorageSavedBytes({ ...emptyUsageStatistics, outputBytes: 400, sourceBytes: 1_000 }),
    ).toBe(600);
    expect(
      getStorageSavedBytes({ ...emptyUsageStatistics, outputBytes: 1_500, sourceBytes: 1_000 }),
    ).toBe(-500);
  });
});
