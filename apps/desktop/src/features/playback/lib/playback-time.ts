import type { FrameRate } from "@/domain/media";
import { frameToMicros } from "@/domain/media-time";

function frameCountFor(durationMicros: number, frameRate: FrameRate | undefined) {
  if (
    !frameRate ||
    !Number.isFinite(durationMicros) ||
    durationMicros <= 0 ||
    frameRate.numerator <= 0 ||
    frameRate.denominator <= 0
  ) {
    return 0;
  }

  return Math.max(
    1,
    Math.round((durationMicros * frameRate.numerator) / (1_000_000 * frameRate.denominator)),
  );
}

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

export { frameCountFor, frameToMicros, frameToPlaybackMicros, microsToFrame };
