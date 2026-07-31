export interface PlaybackFrameRate {
  numerator: number;
  denominator: number;
}

export function frameDurationMicros(frameRate: PlaybackFrameRate | undefined): number {
  if (!frameRate || frameRate.numerator <= 0 || frameRate.denominator <= 0) {
    return 100_000;
  }
  return Math.max(1, Math.round((frameRate.denominator / frameRate.numerator) * 1_000_000));
}

export function clampPlaybackMicros(micros: number, sourceDurationMicros: number): number {
  const integer = Number.isFinite(micros) ? Math.round(micros) : 0;
  return Math.min(sourceDurationMicros, Math.max(0, integer));
}

export function formatPlaybackTime(
  micros: number,
  frameRate: PlaybackFrameRate | undefined,
): string {
  const frameDuration = frameDurationMicros(frameRate);
  const totalFrames = Math.max(
    0,
    frameRate && frameRate.numerator > 0 && frameRate.denominator > 0
      ? Math.round(((micros / 1_000_000) * frameRate.numerator) / frameRate.denominator)
      : Math.round(micros / frameDuration),
  );
  const framesPerSecond = Math.max(
    1,
    frameRate && frameRate.numerator > 0 && frameRate.denominator > 0
      ? Math.round(frameRate.numerator / frameRate.denominator)
      : 10,
  );
  const wholeSeconds = Math.floor(totalFrames / framesPerSecond);
  const frames = totalFrames - Math.round(wholeSeconds * framesPerSecond);
  const hours = Math.floor(wholeSeconds / 3_600);
  const minutes = Math.floor((wholeSeconds % 3_600) / 60);
  const seconds = wholeSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${frames
    .toString()
    .padStart(2, "0")}f`;
}
