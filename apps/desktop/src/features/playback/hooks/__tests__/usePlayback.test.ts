import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  createNominalFrameIndex,
  createRealFrameIndex,
  type FrameIndex,
} from "@/domain/frame-index";

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

const frames = vi.hoisted(() => ({ index: null as FrameIndex | null }));

vi.mock("../../contexts/playback-context", () => ({ usePlaybackController: () => controller }));
vi.mock("@/app/store/redux-hooks", () => ({
  useAppSelector: (selector: () => unknown) => selector(),
}));
vi.mock("@/app/store/slices/source-slice", () => ({ selectFrameIndex: () => frames.index }));

describe("Timeline frames", () => {
  it.each([
    { numerator: 30, denominator: 1 },
    { numerator: 60, denominator: 1 },
    { numerator: 30_000, denominator: 1_001 },
    { numerator: 24_000, denominator: 1_001 },
  ])(
    "keeps the playhead on the final frame at and after EOF at $numerator/$denominator fps",
    (rate) => {
      const count = 60;
      const duration = Math.round((count * 1_000_000 * rate.denominator) / rate.numerator);
      const lastFrameStart = Math.round(
        ((count - 1) * 1_000_000 * rate.denominator) / rate.numerator,
      );

      frames.index = createNominalFrameIndex(duration, rate);

      controller.snapshot = {
        durationMicros: duration,
        positionMicros: Math.round((lastFrameStart + duration) / 2),
      };
      const { rerender, result } = renderHook(() => useTimelinePlayback());
      expect(result.current.framesCount).toBe(count);
      expect(result.current.currentFrame).toBe(count - 1);

      controller.snapshot = { durationMicros: duration, positionMicros: duration };
      rerender();
      expect(result.current.currentFrame).toBe(count - 1);
      // The end boundary is not a playhead position: seeking there lands on the final frame.
      result.current.seekFrame(count);
      expect(controller.seek).toHaveBeenLastCalledWith(
        lastFrameStart,
        Math.round((lastFrameStart + duration) / 2),
      );
    },
  );

  it("addresses only real frames, skipping gaps in a variable-rate capture", () => {
    // Frames at 1.383 and 1.400 s, then two skipped 60 FPS slots, then 1.450 s.
    frames.index = createRealFrameIndex([1_383_000, 1_400_000, 1_450_000], 1_467_000);
    controller.snapshot = { durationMicros: 1_467_000, positionMicros: 1_433_000 };
    const { result } = renderHook(() => useTimelinePlayback());

    expect(result.current.framesCount).toBe(3);
    // Inside the gap the previous real frame is still on screen.
    expect(result.current.currentFrame).toBe(1);

    result.current.seekFrame(2);
    expect(controller.seek).toHaveBeenLastCalledWith(1_450_000, 1_458_500);
  });
});
