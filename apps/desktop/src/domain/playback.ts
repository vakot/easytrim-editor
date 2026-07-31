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

export function formatPlaybackTime(micros: number): string {
  const totalMilliseconds = Math.max(0, Math.floor(micros / 1_000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMilliseconds % 60_000) / 1_000);
  const milliseconds = totalMilliseconds % 1_000;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds
    .toString()
    .padStart(3, "0")}`;
}
