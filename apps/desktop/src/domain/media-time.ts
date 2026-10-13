import type { FrameRate } from "./media";

function frameToMicros(frame: number, frameRate: FrameRate) {
  return Math.round((frame * frameRate.denominator * 1_000_000) / frameRate.numerator);
}

export { frameToMicros };
