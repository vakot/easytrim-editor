import type { FrameRate, MediaInfo } from "./media";
import { frameCountFor, frameToMicros } from "./media-time";

const FALLBACK_FRAME_RATE: FrameRate = { denominator: 1, numerator: 30 };

/**
 * The frames of a video, as players display them. Frame `k` is shown from `startOf(k)` until
 * `startOf(k + 1)`; `startOf(count)` is where the picture ends. Built from the real frame
 * timestamps when they are known, so gaps in variable-rate captures are not frames.
 */
interface FrameIndex {
  /** Number of frames; the frames are 0 to `count - 1`. */
  readonly count: number;
  /** End of the last frame. */
  readonly endMicros: number;
  /** The frame on screen at `micros`, always a real frame. */
  frameAt(micros: number): number;
  /** Start of `frame`; `count` is the end boundary after the last frame. */
  startOf(frame: number): number;
}

function createRealFrameIndex(timestampsMicros: readonly number[], endMicros: number): FrameIndex {
  const count = timestampsMicros.length;
  return {
    count,
    endMicros,
    frameAt(micros) {
      if (count === 0 || !Number.isFinite(micros)) return 0;
      // Last frame whose start is at or before `micros`.
      let low = 0;
      let high = count - 1;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (timestampsMicros[middle]! <= micros) low = middle;
        else high = middle - 1;
      }
      return low;
    },
    startOf(frame) {
      const bounded = Math.max(0, Math.min(count, Math.round(frame)));
      return bounded === count ? endMicros : timestampsMicros[bounded]!;
    },
  };
}

/** Frames on the nominal frame-rate grid, for media whose real frames could not be read. */
function createNominalFrameIndex(durationMicros: number, frameRate: FrameRate): FrameIndex {
  const count = frameCountFor(durationMicros, frameRate);
  const startOf = (frame: number) => {
    const bounded = Math.max(0, Math.min(count, Math.round(frame)));
    return bounded === count ? durationMicros : frameToMicros(bounded, frameRate);
  };

  return {
    count,
    endMicros: durationMicros,
    frameAt(micros) {
      if (count === 0 || !Number.isFinite(micros) || micros <= 0) return 0;
      // Boundaries are rounded to whole microseconds, so correct the estimate against them.
      let frame = Math.floor((micros * frameRate.numerator) / (1_000_000 * frameRate.denominator));
      frame = Math.max(0, Math.min(count - 1, frame));
      if (startOf(frame) > micros) frame -= 1;
      else if (frame < count - 1 && startOf(frame + 1) <= micros) frame += 1;
      return Math.max(0, frame);
    },
    startOf,
  };
}

function createFrameIndex(media: MediaInfo | null): FrameIndex {
  if (!media) return createNominalFrameIndex(0, FALLBACK_FRAME_RATE);
  const timestamps = media.video.frameTimestampsMicros;
  if (timestamps && timestamps.length > 0) {
    return createRealFrameIndex(timestamps, media.durationMicros);
  }
  return createNominalFrameIndex(
    media.durationMicros,
    media.video.averageFrameRate ?? media.video.realFrameRate ?? FALLBACK_FRAME_RATE,
  );
}

/**
 * Where a video element should seek to display the frame on screen at `micros`: that frame's
 * midpoint. Chromium can show the previous frame for a seek to a frame's exact start.
 */
function presentationMicrosAt(index: FrameIndex, micros: number) {
  if (index.count === 0) return 0;
  const frame = index.frameAt(micros);
  return Math.round((index.startOf(frame) + index.startOf(frame + 1)) / 2);
}

/**
 * Frame boundaries are the times a position can rest on: every frame start, plus the end of the
 * last frame. Returns the boundary nearest to `micros`.
 */
function nearestBoundaryMicros(index: FrameIndex, micros: number) {
  if (index.count === 0) return 0;
  const frame = index.frameAt(micros);
  const start = index.startOf(frame);
  const end = index.startOf(frame + 1);
  return micros - start <= end - micros ? start : end;
}

/** The boundary after `micros`, or the end when there is none. */
function nextBoundaryMicros(index: FrameIndex, micros: number) {
  if (index.count === 0) return 0;
  return index.startOf(index.frameAt(micros) + 1);
}

/** The boundary before `micros`, or 0 when there is none. */
function previousBoundaryMicros(index: FrameIndex, micros: number) {
  if (index.count === 0 || micros <= 0) return 0;
  const frame = index.frameAt(micros);
  const start = index.startOf(frame);
  return start < micros ? start : index.startOf(Math.max(0, frame - 1));
}

export {
  createFrameIndex,
  createNominalFrameIndex,
  createRealFrameIndex,
  nearestBoundaryMicros,
  nextBoundaryMicros,
  presentationMicrosAt,
  previousBoundaryMicros,
};
export type { FrameIndex };
