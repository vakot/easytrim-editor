import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { usePlaybackModes } from "../usePlaybackModes";

const trim = {
  sourceDurationMicros: 60_000_000,
  startMicros: 10_000_000,
  endMicros: 20_000_000,
};

describe("usePlaybackModes", () => {
  function usePlaybackModesHarness() {
    const [loopEnabled, setLoopEnabled] = useState(true);
    const [segmentEnabled, setSegmentEnabled] = useState(true);
    return usePlaybackModes({
      loopEnabled,
      segmentEnabled,
      onLoopEnabledChange: setLoopEnabled,
      onSegmentEnabledChange: setSegmentEnabled,
    });
  }

  it("defaults to looping the selected segment and allows full-source playback", () => {
    const { result } = renderHook(() => usePlaybackModesHarness());

    expect(result.current.loopEnabled).toBe(true);
    expect(result.current.segmentEnabled).toBe(true);
    expect(result.current.startMicros(5_000_000, trim)).toBe(10_000_000);

    act(() => result.current.toggleSegment());

    expect(result.current.segmentEnabled).toBe(false);
    expect(result.current.startMicros(5_000_000, trim)).toBe(5_000_000);
  });

  it("emits each boundary action once until playback returns inside the range", () => {
    const { result } = renderHook(() => usePlaybackModesHarness());
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
});
