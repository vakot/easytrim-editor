import type { FrameRate } from "@/domain/media";
import { frameCountFor, frameToMicros } from "@/domain/media-time";

function frameToPlaybackMicros(
  frame: number,
  framesCount: number,
  durationMicros: number,
  frameRate: FrameRate,
) {
  if (framesCount <= 0) return 0;
  const boundedFrame = Math.max(0, Math.min(framesCount, Math.round(frame)));
  return boundedFrame === framesCount ? durationMicros : frameToMicros(boundedFrame, frameRate);
}

function microsToFrame(micros: number, frameRate: FrameRate | undefined, framesCount: number) {
  if (
    framesCount <= 0 ||
    !Number.isFinite(micros) ||
    !frameRate ||
    frameRate.numerator <= 0 ||
    frameRate.denominator <= 0
  ) {
    return 0;
  }

  const frame = Math.round((micros * frameRate.numerator) / (1_000_000 * frameRate.denominator));
  return Math.max(0, Math.min(framesCount, frame));
}

/**
 * Where the video element should seek to display `frame`: its midpoint, which every player maps
 * to that frame even when container timestamps are rounded. EOF displays the final frame.
 */
function framePresentationMicros(
  frame: number,
  framesCount: number,
  durationMicros: number,
  frameRate: FrameRate,
) {
  if (framesCount <= 0) return 0;
  const displayed = Math.max(0, Math.min(framesCount - 1, Math.round(frame)));
  const start = frameToPlaybackMicros(displayed, framesCount, durationMicros, frameRate);
  const end = frameToPlaybackMicros(displayed + 1, framesCount, durationMicros, frameRate);
  return Math.round((start + end) / 2);
}

/** The frame on screen at `micros`: the last grid boundary at or before it (EOF at the duration). */
function presentedFrameAt(
  micros: number,
  framesCount: number,
  durationMicros: number,
  frameRate: FrameRate,
) {
  if (framesCount <= 0 || !Number.isFinite(micros) || micros <= 0) return 0;
  if (micros >= durationMicros) return framesCount;

  // Boundaries are rounded to whole microseconds, so correct the estimate against them.
  let frame = Math.floor((micros * frameRate.numerator) / (1_000_000 * frameRate.denominator));
  frame = Math.max(0, Math.min(framesCount - 1, frame));
  if (frameToPlaybackMicros(frame, framesCount, durationMicros, frameRate) > micros) frame -= 1;
  else if (frameToPlaybackMicros(frame + 1, framesCount, durationMicros, frameRate) <= micros) {
    frame += 1;
  }
  return Math.max(0, frame);
}

export {
  frameCountFor,
  framePresentationMicros,
  frameToMicros,
  frameToPlaybackMicros,
  microsToFrame,
  presentedFrameAt,
};
