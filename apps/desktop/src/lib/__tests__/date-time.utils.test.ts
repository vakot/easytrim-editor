import { describe, expect, it } from "vitest";

import { formatDateTime, formatRelativeTime } from "../date-time.utils";

describe("formatDateTime", () => {
  it("formats timestamps in the active locale", () => {
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

describe("formatRelativeTime", () => {
  const now = new Date(2026, 8, 20, 12, 0, 0, 0).getTime();
  const microsAgo = (milliseconds: number) => (now - milliseconds) * 1_000;

  it.each([
    [0, "1 second ago"],
    [1_000, "1 second ago"],
    [59_000, "59 seconds ago"],
    [60_000, "1 minute ago"],
    [59 * 60_000, "59 minutes ago"],
    [60 * 60_000, "1 hour ago"],
    [23 * 60 * 60_000, "23 hours ago"],
  ])("formats %s as %s", (ageMs, expected) => {
    expect(formatRelativeTime(microsAgo(ageMs), "en-US", "Unknown", now)).toBe(expected);
  });

  it("uses yesterday after the relative hour range", () => {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatRelativeTime(yesterday.getTime() * 1_000, "en-US", "Unknown", now)).toBe(
      "yesterday",
    );
  });

  it("uses an absolute date without time for older timestamps", () => {
    const older = new Date(now);
    older.setDate(older.getDate() - 2);
    const expected = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(older);

    expect(formatRelativeTime(older.getTime() * 1_000, "en-US", "Unknown", now)).toBe(expected);
  });
});
