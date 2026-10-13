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

function frameFromMicros(micros: number, frameRate: FrameRate | undefined) {
  if (
    !Number.isFinite(micros) ||
    micros <= 0 ||
    !frameRate ||
    frameRate.numerator <= 0 ||
    frameRate.denominator <= 0
  ) {
    return 0;
  }

  return Math.round((micros * frameRate.numerator) / (1_000_000 * frameRate.denominator));
}

function formatFrameTimecode(frame: number, frameRate: FrameRate | undefined) {
  const totalFrames = Math.max(0, Math.round(Number.isFinite(frame) ? frame : 0));
  const framesPerSecond = Math.max(
    1,
    frameRate && frameRate.numerator > 0 && frameRate.denominator > 0
      ? Math.round(frameRate.numerator / frameRate.denominator)
      : 30,
  );
  const wholeSeconds = Math.floor(totalFrames / framesPerSecond);
  const frames = totalFrames % framesPerSecond;
  const hours = Math.floor(wholeSeconds / 3_600);
  const minutes = Math.floor((wholeSeconds % 3_600) / 60);
  const seconds = wholeSeconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${frames
    .toString()
    .padStart(2, "0")}f`;
}

export { frameCountFor, frameFromMicros, frameToSeconds, formatFrameTimecode, secondsToFrame };
