import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePlaybackModes } from "./use-playback-modes";

const trim = {
  sourceDurationMicros: 60_000_000,
  startMicros: 10_000_000,
  endMicros: 20_000_000,
};

describe("usePlaybackModes", () => {
  it("switches between full-source and segment playback", () => {
    const { result } = renderHook(() => usePlaybackModes());

    expect(result.current.startMicros(5_000_000, trim)).toBe(5_000_000);

    act(() => result.current.toggleSegment());

    expect(result.current.segmentEnabled).toBe(true);
    expect(result.current.startMicros(5_000_000, trim)).toBe(10_000_000);
  });

  it("emits each boundary action once until playback returns inside the range", () => {
    const { result } = renderHook(() => usePlaybackModes());
    act(() => result.current.toggleSegment());

    expect(result.current.consumeBoundary(20_000_000, trim)).toEqual({
      reached: true,
      action: { type: "stop", positionMicros: 20_000_000 },
    });
    expect(result.current.consumeBoundary(20_000_000, trim)).toEqual({
      reached: true,
      action: null,
    });
    expect(result.current.consumeBoundary(15_000_000, trim)).toEqual({ reached: false });

    act(() => result.current.toggleLoop());
    expect(result.current.consumeBoundary(20_000_000, trim)).toEqual({
      reached: true,
      action: { type: "restart", positionMicros: 10_000_000 },
    });
  });
});
