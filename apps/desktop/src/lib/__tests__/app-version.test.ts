import { describe, expect, it } from "vitest";

import { getCurrentVersion } from "../app-version";

describe("getCurrentVersion", () => {
  it("returns the current semantic version", () => {
    expect(getCurrentVersion()).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  });
});
