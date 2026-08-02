import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLAYBACK_SPEED,
  PLAYBACK_SPEED_STEPS,
  usePlaybackSpeed,
} from "../usePlaybackSpeed";

describe("usePlaybackSpeed", () => {
  it("uses normal playback by default", () => {
    const { result } = renderHook(() => usePlaybackSpeed());

    expect(result.current.speed).toBe(DEFAULT_PLAYBACK_SPEED);
    expect(PLAYBACK_SPEED_STEPS).toEqual([0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3]);
  });

  it("accepts every controlled playback speed step", () => {
    const { result } = renderHook(() => usePlaybackSpeed());

    act(() => result.current.setSpeed(3));

    expect(result.current.speed).toBe(3);
  });
});
