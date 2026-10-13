import type { FrameRate } from "@/domain/media";

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

function frameToSeconds(frame: number, frameRate: FrameRate) {
  return (frame * frameRate.denominator) / frameRate.numerator;
}

function secondsToFrame(seconds: number, frameRate: FrameRate, framesCount: number) {
  if (framesCount <= 0 || !Number.isFinite(seconds)) return 0;
  const frame = Math.round((seconds * frameRate.numerator) / frameRate.denominator);
  return Math.max(0, Math.min(framesCount - 1, frame));
}

export { frameCountFor, frameToSeconds, secondsToFrame };
