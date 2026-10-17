import { describe, expect, it } from "vitest";

import { formatAchievementValue } from "../achievements-format.utils";

describe("formatAchievementValue", () => {
  it("formats each metric unit like the Statistics dialog", () => {
    expect(formatAchievementValue(1_000, "count", "en")).toBe("1,000");
    expect(formatAchievementValue(3_600_000, "duration", "en")).toBe("1:00:00");
    expect(formatAchievementValue(100 * 1_024 ** 3, "bytes", "en")).toBe("100 GB");
  });
});
