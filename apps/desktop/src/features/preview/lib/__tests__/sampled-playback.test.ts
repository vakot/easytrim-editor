import { afterEach, describe, expect, it, vi } from "vitest";

import { startSampledPlayback } from "../sampled-playback";

function clock() {
  let now = 0;
  let nextId = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callbacks.set(++nextId, callback);
    return nextId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  return {
    advance(time: number) {
      now = time;
      const batch = [...callbacks.values()];
      callbacks.clear();
      for (const callback of batch) callback(now);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("sampled preview clock", () => {
  it.each([6, 20, 100])(
    "caps frame requests at %sx while source time advances at the requested rate",
    (rate) => {
      const timer = clock();
      const onTime = vi.fn(() => false);
      const seek = vi.fn((_micros: number, done: () => void) => done());
      const playback = startSampledPlayback({
        startMicros: 0,
        rate,
        frameRate: 60,
        onTime,
        seek,
        isSeeking: () => false,
      });

      for (let millisecond = 1; millisecond <= 1000; millisecond++) timer.advance(millisecond);
      expect(onTime).toHaveBeenLastCalledWith(rate * 1_000_000, 1000);
      expect(seek.mock.calls.length).toBeLessThanOrEqual(61);
      expect(seek.mock.calls.length).toBeGreaterThanOrEqual(59);
      playback.stop();
    },
  );

  it("skips obsolete frames and gives slow decoding idle time without slowing the timeline", () => {
    const timer = clock();
    let settle: (() => void) | undefined;
    const seek = vi.fn((_micros: number, done: () => void) => {
      settle = done;
    });

    const onTime = vi.fn(() => false);
    const playback = startSampledPlayback({
      startMicros: 0,
      rate: 100,
      frameRate: 60,
      onTime,
      seek,
      isSeeking: () => false,
    });

    timer.advance(10);
    timer.advance(110);
    expect(seek).toHaveBeenCalledOnce();
    settle?.();
    timer.advance(150);
    expect(seek).toHaveBeenCalledOnce();
    timer.advance(210);
    expect(seek).toHaveBeenCalledTimes(2);
    expect(seek.mock.calls[1]?.[0]).toBe(21_000_000);
    expect(onTime).toHaveBeenLastCalledWith(21_000_000, 210);
    playback.stop();
  });

  it("reanchors after seeking/looping and never catches up across window suspension", () => {
    const timer = clock();
    const onTime = vi.fn(() => false);
    const playback = startSampledPlayback({
      startMicros: 0,
      rate: 100,
      frameRate: 60,
      onTime,
      seek: (_micros, done) => done(),
      isSeeking: () => false,
    });

    timer.advance(100);
    playback.seek(5_000_000);
    timer.advance(200);
    expect(onTime).toHaveBeenLastCalledWith(15_000_000, 200);
    timer.advance(60_000);
    expect(onTime).toHaveBeenLastCalledWith(15_000_000, 60_000);
    playback.stop();
    timer.advance(60_100);
    expect(onTime).toHaveBeenCalledTimes(3);
  });

  it("does not request frames while another seek is outstanding or the window is hidden", () => {
    const timer = clock();
    const seek = vi.fn();
    const playback = startSampledPlayback({
      startMicros: 0,
      rate: 100,
      frameRate: 60,
      onTime: () => false,
      seek,
      isSeeking: () => true,
    });

    timer.advance(100);
    expect(seek).not.toHaveBeenCalled();
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    timer.advance(200);
    expect(seek).not.toHaveBeenCalled();
    playback.stop();
  });
});
