import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { usePlaybackModes } from "../usePlaybackModes";

const trim = {
  sourceDurationMicros: 60_000_000,
  startMicros: 10_000_000,
  endMicros: 20_000_000,
};

describe("usePlaybackModes", () => {
  it("preserves an external playhead while keeping segment playback enabled", () => {
    const { result } = renderHook(() => usePlaybackModes());

    expect(result.current.loopEnabled).toBe(true);
    expect(result.current.segmentEnabled).toBe(true);
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

    act(() => result.current.toggleSegment());

    expect(result.current.segmentEnabled).toBe(false);
    expect(result.current.startMicros(5_000_000, trim)).toBe(5_000_000);
  });

  it("emits each boundary action once until playback returns inside the range", () => {
    const { result } = renderHook(() => usePlaybackModes());
    act(() => result.current.toggleLoop());

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

  it("refreshes the active range when trim boundaries change before resume", () => {
    const { result } = renderHook(() => usePlaybackModes());
    const updatedTrim = { ...trim, endMicros: 30_000_000 };

    act(() => result.current.startMicros(15_000_000, trim));
    expect(result.current.consumeBoundary(20_000_000, updatedTrim)).toEqual({
      reached: true,
      action: { type: "restart", positionMicros: 10_000_000 },
    });

    act(() => {
      result.current.startMicros(15_000_000, updatedTrim);
      result.current.resetBoundary();
    });
    expect(result.current.consumeBoundary(20_000_000, updatedTrim)).toEqual({
      reached: false,
    });
    expect(result.current.consumeBoundary(30_000_000, updatedTrim)).toEqual({
      reached: true,
      action: { type: "restart", positionMicros: 10_000_000 },
    });
  });
});
