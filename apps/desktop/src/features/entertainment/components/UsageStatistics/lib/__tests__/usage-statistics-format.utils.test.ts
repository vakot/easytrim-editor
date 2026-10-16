import { describe, expect, it } from "vitest";

import {
  formatSignedFileSize,
  formatStatisticCount,
  formatStatisticDate,
} from "../usage-statistics-format.utils";

describe("usage statistics formatting", () => {
  it("groups large counts for the locale", () => {
    expect(formatStatisticCount(0, "en")).toBe("0");
    expect(formatStatisticCount(12_345, "en")).toBe("12,345");
  });

  it("keeps the sign of storage differences", () => {
    expect(formatSignedFileSize(0)).toBe("0 B");
    expect(formatSignedFileSize(1_536)).toBe("1.5 KB");
    expect(formatSignedFileSize(-1_536)).toBe("-1.5 KB");
  });

  it("formats recorded dates and falls back to a placeholder", () => {
    expect(formatStatisticDate(null, "en", "Not yet")).toBe("Not yet");
    expect(formatStatisticDate(Date.UTC(2026, 0, 15, 12), "en", "Not yet")).toMatch(/Jan 15, 2026/);
  });
});
