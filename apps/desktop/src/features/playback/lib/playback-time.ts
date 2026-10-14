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

/** Continuous playhead position in frame units, so it travels through each frame to EOF. */
function playheadFrameAt(
  micros: number,
  framesCount: number,
  durationMicros: number,
  frameRate: FrameRate,
) {
  const frame = presentedFrameAt(micros, framesCount, durationMicros, frameRate);
  if (frame >= framesCount) return framesCount;

  const start = frameToPlaybackMicros(frame, framesCount, durationMicros, frameRate);
  const end = frameToPlaybackMicros(frame + 1, framesCount, durationMicros, frameRate);
  return end > start ? frame + Math.min(1, Math.max(0, (micros - start) / (end - start))) : frame;
}

export {
  frameCountFor,
  frameToMicros,
  frameToPlaybackMicros,
  microsToFrame,
  playheadFrameAt,
  presentedFrameAt,
};
