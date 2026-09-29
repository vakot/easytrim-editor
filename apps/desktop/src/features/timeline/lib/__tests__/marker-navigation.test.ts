import { describe, expect, it } from "vitest";

import { findNextMarker, findPreviousMarker } from "../marker-navigation";

const visibleMarkers = [0, 2_000_000, 5_000_000, 7_000_000, 10_000_000];

describe("marker navigation", () => {
  it("finds the nearest earlier scene or audio activity start", () => {
    expect(findPreviousMarker(visibleMarkers, 6_000_000)).toBe(5_000_000);
  });

  it("finds the nearest later scene or audio activity start", () => {
    expect(findNextMarker(visibleMarkers, 6_000_000)).toBe(7_000_000);
  });

  it("moves to the end of preceding silence and across activity ranges", () => {
    expect(findPreviousMarker(visibleMarkers, 7_000_000)).toBe(5_000_000);
    expect(findNextMarker(visibleMarkers, 4_000_000)).toBe(5_000_000);
    expect(findNextMarker(visibleMarkers, 6_000_000)).toBe(7_000_000);
  });

  it("returns no target when there are no visible markers", () => {
    expect(findPreviousMarker([], 3_000_000)).toBeUndefined();
    expect(findNextMarker([], 3_000_000)).toBeUndefined();
  });

  it("does not repeat the marker at the playhead", () => {
    expect(findPreviousMarker([2_000_000], 2_000_000)).toBeUndefined();
    expect(findNextMarker([2_000_000], 2_000_000)).toBeUndefined();
  });
});
