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
  ])(
    "keeps the playhead on the final frame at and after EOF at $numerator/$denominator fps",
    (rate) => {
      const frameRate = { ...rate, displayValue: rate.numerator / rate.denominator };
      const frames = 60;
      const duration = Math.round((frames * 1_000_000 * rate.denominator) / rate.numerator);
      const lastFrameStart = Math.round(
        ((frames - 1) * 1_000_000 * rate.denominator) / rate.numerator,
      );

      controller.snapshot = {
        durationMicros: duration,
        positionMicros: Math.round((lastFrameStart + duration) / 2),
      };
      const { rerender, result } = renderHook(() => useTimelinePlayback(frameRate));
      expect(result.current.framesCount).toBe(frames);
      expect(result.current.currentFrame).toBe(frames - 1);

      controller.snapshot = { durationMicros: duration, positionMicros: duration };
      rerender();
      expect(result.current.currentFrame).toBe(frames - 1);
      // The EOF boundary is not a playhead position: seeking there lands on the final frame.
      result.current.seekFrame(frames);
      expect(controller.seek).toHaveBeenLastCalledWith(
        lastFrameStart,
        Math.round((lastFrameStart + duration) / 2),
      );
    },
  );

  it("derives the frame grid from the playback duration", () => {
    const frameRate = { numerator: 30, denominator: 1, displayValue: 30 };
    controller.snapshot = { durationMicros: 2_000_000, positionMicros: 1_000_000 };
    const { result } = renderHook(() => useTimelinePlayback(frameRate));

    expect(result.current.framesCount).toBe(60);
    expect(result.current.currentFrame).toBe(30);
  });
});
