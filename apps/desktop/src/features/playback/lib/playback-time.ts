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
 * to that frame even when container timestamps are rounded.
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

/**
 * The frame on screen at `micros`, always a real frame (0 to `framesCount - 1`). The frame count
 * is a boundary for ranges, not a frame: at EOF the final frame is still the one on screen.
 */
function presentedFrameAt(
  micros: number,
  framesCount: number,
  durationMicros: number,
  frameRate: FrameRate,
) {
  if (framesCount <= 0 || !Number.isFinite(micros) || micros <= 0) return 0;
  const lastFrame = framesCount - 1;

  // Boundaries are rounded to whole microseconds, so correct the estimate against them.
  let frame = Math.floor((micros * frameRate.numerator) / (1_000_000 * frameRate.denominator));
  frame = Math.max(0, Math.min(lastFrame, frame));
  if (frameToPlaybackMicros(frame, framesCount, durationMicros, frameRate) > micros) frame -= 1;
  else if (
    frame < lastFrame &&
    frameToPlaybackMicros(frame + 1, framesCount, durationMicros, frameRate) <= micros
  ) {
    frame += 1;
  }
  return Math.max(0, frame);
}

/** The final frame inside a range ending at `endMicros`: where stopped playback rests. */
function lastFrameBefore(endMicros: number, durationMicros: number, frameRate: FrameRate) {
  const framesCount = frameCountFor(durationMicros, frameRate);
  if (framesCount <= 0) return null;
  const frame = presentedFrameAt(endMicros - 1, framesCount, durationMicros, frameRate);
  return {
    positionMicros: frameToPlaybackMicros(frame, framesCount, durationMicros, frameRate),
    presentationMicros: framePresentationMicros(frame, framesCount, durationMicros, frameRate),
  };
}

export {
  frameCountFor,
  framePresentationMicros,
  frameToPlaybackMicros,
  lastFrameBefore,
  microsToFrame,
  presentedFrameAt,
};
