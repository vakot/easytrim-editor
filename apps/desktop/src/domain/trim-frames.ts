import type { FrameRate } from "@/domain/media";
import { frameToMicros } from "@/domain/media-time";
import { MIN_SELECTION_MICROS, type TrimRange } from "@/domain/trim";

/** A frame selection in the Timeline's coordinates: `end` is the last included frame. */
type TrimFrames = { end: number; start: number };
type TrimHandle = "start" | "end" | "move";

function createTrimFrameAdapter(durationMicros: number, framesCount: number, rate: FrameRate) {
  // A frame's start time; the boundary after the final frame is EOF.
  const toMicros = (frame: number) =>
    frame === framesCount ? durationMicros : frameToMicros(frame, rate);

  const lastFrame = Math.max(0, framesCount - 1);
  const minimum = Math.min(MIN_SELECTION_MICROS, durationMicros);

  // Search actual rounded timestamps, including the terminal EOF boundary. A fixed
  // frame count alone cannot enforce the minimum duration at a partial last frame.
  function firstFrameAtOrAfter(micros: number) {
    let low = 0;
    let high = framesCount;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (toMicros(middle) < micros) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  function lastFrameAtOrBefore(micros: number) {
    const frame = firstFrameAtOrAfter(micros);
    return Math.max(0, toMicros(frame) > micros ? frame - 1 : frame);
  }

  function bounds({ end, start }: TrimFrames) {
    // The selection covers frames start..end, so it ends at the boundary after `end`.
    const endBoundary = end + 1;
    const lastStart = framesCount - (endBoundary - start);
    return {
      maxStart: lastFrameAtOrBefore(toMicros(endBoundary) - minimum),
      minEnd: firstFrameAtOrAfter(toMicros(start) + minimum) - 1,
      // A partial final frame may be shorter than the frame it replaces.
      maxMove:
        toMicros(framesCount) - toMicros(lastStart) >= minimum
          ? lastStart
          : Math.max(0, lastStart - 1),
    };
  }

  function fromTrim(trim: TrimRange): TrimFrames {
    // Existing edits need not be frame aligned. Round outward so opening the
    // Timeline never shortens an existing minimum-length selection.
    const start = lastFrameAtOrBefore(trim.startMicros);
    return { start, end: Math.max(start, firstFrameAtOrAfter(trim.endMicros) - 1) };
  }

  function edit(range: TrimFrames, handle: TrimHandle, value: number): TrimFrames {
    const frame = Math.round(value);
    const { maxMove, maxStart, minEnd } = bounds(range);
    if (handle === "start") return { ...range, start: Math.max(0, Math.min(maxStart, frame)) };
    if (handle === "end") return { ...range, end: Math.max(minEnd, Math.min(lastFrame, frame)) };
    const length = range.end - range.start;
    const start = Math.max(0, Math.min(maxMove, frame));
    return { start, end: start + length };
  }

  return {
    bounds,
    edit,
    fromTrim,
    lastFrame,
    toTrim: ({ end, start }: TrimFrames): TrimRange => ({
      startMicros: toMicros(start),
      endMicros: toMicros(end + 1),
      sourceDurationMicros: durationMicros,
    }),
  };
}

export { createTrimFrameAdapter };
export type { TrimFrames, TrimHandle };
