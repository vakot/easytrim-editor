import type { FrameRate } from "./media";

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

function frameToMicros(frame: number, frameRate: FrameRate) {
  return Math.round((frame * frameRate.denominator * 1_000_000) / frameRate.numerator);
}

export { frameCountFor, frameToMicros };
