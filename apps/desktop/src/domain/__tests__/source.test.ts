import { describe, expect, it } from "vitest";

import { normalizeSourceKey } from "../source";

describe("source identity", () => {
  it("normalizes Windows separators and drive-letter casing for comparisons", () => {
    expect(normalizeSourceKey("c:\\Media\\Clips\\take.mp4")).toBe("c:/media/clips/take.mp4");
    expect(normalizeSourceKey("C:/Media/Clips/take.mp4")).toBe("c:/media/clips/take.mp4");
  });
});
