import { describe, expect, it } from "vitest";

import { formatDateTime } from "../media-formatters.utils";

describe("formatDateTime", () => {
  it("formats source timestamps in the active locale", () => {
    const timestampMicros = Date.UTC(2026, 0, 2, 15, 4) * 1_000;
    const expected = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestampMicros / 1_000));

    expect(formatDateTime(timestampMicros, "en-US", "Unknown")).toBe(expected);
  });

  it("uses the fallback when a timestamp is unavailable", () => {
    expect(formatDateTime(undefined, "en-US", "Unknown")).toBe("Unknown");
  });
});
