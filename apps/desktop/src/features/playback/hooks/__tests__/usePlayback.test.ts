import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRealFrameIndex, type FrameIndex } from "@/domain/frame-index";

import { usePlaybackPosition, useTimelinePlayback } from "../usePlayback";

const controller = vi.hoisted(() => ({
  snapshot: { positionMicros: 0, durationMicros: 0 },
  getSnapshot() {
    return this.snapshot;
  },
  subscribe: () => () => undefined,
  isPlaying: false,
  pause: vi.fn(),
  play: vi.fn(),
  seek: vi.fn(),
  togglePlayback: vi.fn(),
}));

const frames = vi.hoisted(() => ({ index: null as FrameIndex | null }));

vi.mock("../../contexts/playback-context", () => ({ usePlaybackController: () => controller }));
vi.mock("@/app/store/redux-hooks", () => ({
  useAppSelector: (selector: () => unknown) => selector(),
}));
vi.mock("@/app/store/slices/source-slice", () => ({ selectFrameIndex: () => frames.index }));

// Real frames of a capture that skipped the 1.417 and 1.433 s slots.
const index = createRealFrameIndex([0, 17_000, 1_383_000, 1_400_000, 1_450_000], 1_467_000);

beforeEach(() => {
  frames.index = index;
  controller.snapshot = { durationMicros: 1_467_000, positionMicros: 0 };
  controller.seek.mockClear();
  controller.pause.mockClear();
});

describe("Timeline playback", () => {
  it("spans the real frames up to the end of the last one", () => {
    const { result } = renderHook(() => useTimelinePlayback());
    expect(result.current.durationMicros).toBe(1_467_000);
    expect(result.current.framesCount).toBe(5);
  });

  it("seeks to the nearest real frame boundary, including the end", () => {
    const { result } = renderHook(() => useTimelinePlayback());

    result.current.seekTime(1_420_000);
    expect(controller.seek).toHaveBeenLastCalledWith(1_400_000);
    result.current.seekTime(1_440_000);
    expect(controller.seek).toHaveBeenLastCalledWith(1_450_000);
    result.current.seekTime(1_466_000);
    expect(controller.seek).toHaveBeenLastCalledWith(1_467_000);
  });

  it("steps between real frame boundaries across a gap", () => {
    const { result } = renderHook(() => useTimelinePlayback());

    controller.snapshot = { durationMicros: 1_467_000, positionMicros: 1_400_000 };
    result.current.stepFrame(1);
    expect(controller.pause).toHaveBeenCalled();
    expect(controller.seek).toHaveBeenLastCalledWith(1_450_000);

    controller.snapshot = { durationMicros: 1_467_000, positionMicros: 1_450_000 };
    result.current.stepFrame(1);
    expect(controller.seek).toHaveBeenLastCalledWith(1_467_000);

    controller.snapshot = { durationMicros: 1_467_000, positionMicros: 1_467_000 };
    result.current.stepFrame(-1);
    expect(controller.seek).toHaveBeenLastCalledWith(1_450_000);
    expect(result.current.getPositionMicros()).toBe(1_467_000);
  });

  it("derives readouts from the position", () => {
    controller.snapshot = { durationMicros: 1_467_000, positionMicros: 1_433_000 };
    const { result } = renderHook(() => usePlaybackPosition((micros) => index.frameAt(micros)));
    expect(result.current).toBe(3);
  });
});
