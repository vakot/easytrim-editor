import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePlaybackModes } from "../usePlaybackModes";

const trim = {
  sourceDurationMicros: 60_000_000,
  startMicros: 10_000_000,
  endMicros: 20_000_000,
};

describe("usePlaybackModes", () => {
  function usePlaybackModesHarness() {
    return usePlaybackModes({
      loopEnabled: true,
      segmentEnabled: true,
    });
  }

  it("preserves an external playhead while keeping segment playback enabled", () => {
    const { result } = renderHook(() => usePlaybackModesHarness());

    expect(result.current.startMicros(5_000_000, trim)).toBe(5_000_000);
    expect(result.current.consumeBoundary(19_999_999, trim)).toEqual({ reached: false });
    expect(result.current.consumeBoundary(20_000_000, trim)).toEqual({
      reached: true,
      action: { type: "restart", positionMicros: 10_000_000 },
    });

    expect(result.current.startMicros(25_000_000, trim)).toBe(25_000_000);
    expect(result.current.consumeBoundary(59_999_999, trim)).toEqual({ reached: false });
    expect(result.current.consumeBoundary(60_000_000, trim)).toEqual({
      reached: true,
      action: { type: "restart", positionMicros: 10_000_000 },
    });

    act(() => {
      result.current.resetBoundary();
      result.current.startMicros(trim.endMicros, trim);
    });
    expect(result.current.consumeBoundary(trim.endMicros, trim)).toEqual({
      reached: true,
      action: { type: "restart", positionMicros: trim.startMicros },
    });

    expect(result.current.startMicros(5_000_000, trim)).toBe(5_000_000);
  });

  it("emits each boundary action once until playback returns inside the range", () => {
    const { result: nonLooping } = renderHook(() =>
      usePlaybackModes({ loopEnabled: false, segmentEnabled: true }),
    );

    expect(nonLooping.current.consumeBoundary(20_000_000, trim)).toEqual({
      reached: true,
      action: { type: "stop", positionMicros: 20_000_000 },
    });
    expect(nonLooping.current.consumeBoundary(20_000_000, trim)).toEqual({
      reached: true,
      action: null,
    });
    expect(nonLooping.current.consumeBoundary(15_000_000, trim)).toEqual({ reached: false });

    const { result: looping } = renderHook(() =>
      usePlaybackModes({ loopEnabled: true, segmentEnabled: true }),
    );

    expect(looping.current.consumeBoundary(20_000_000, trim)).toEqual({
      reached: true,
      action: { type: "restart", positionMicros: 10_000_000 },
    });
  });
});
