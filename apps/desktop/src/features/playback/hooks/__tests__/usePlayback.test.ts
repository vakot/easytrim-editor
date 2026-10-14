import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useTimelinePlayback } from "../usePlayback";

const controller = vi.hoisted(() => ({
  snapshot: { positionMicros: 0, durationMicros: 0 },
  getSnapshot() {
    return this.snapshot;
  },
  subscribe: () => () => undefined,
  isPlaying: false,
  seek: vi.fn(),
}));

vi.mock("../../contexts/playback-context", () => ({ usePlaybackController: () => controller }));

describe("Timeline frame boundary", () => {
  it.each([
    { numerator: 30, denominator: 1 },
    { numerator: 60, denominator: 1 },
    { numerator: 30_000, denominator: 1_001 },
    { numerator: 24_000, denominator: 1_001 },
  ])("reserves EOF for the terminal media position at $numerator/$denominator fps", (rate) => {
    const frameRate = { ...rate, displayValue: rate.numerator / rate.denominator };
    const frames = 60;
    const duration = Math.round((frames * 1_000_000 * rate.denominator) / rate.numerator);
    controller.snapshot = { durationMicros: duration, positionMicros: duration - 1 };
    const { rerender, result } = renderHook(() => useTimelinePlayback(frameRate, frames));
    expect(result.current.currentFrame).toBe(frames - 1);
    controller.snapshot = { durationMicros: duration, positionMicros: duration };
    rerender();
    expect(result.current.currentFrame).toBe(frames);
    result.current.seekFrame(frames);
    expect(controller.seek).toHaveBeenLastCalledWith(duration);
  });
});
