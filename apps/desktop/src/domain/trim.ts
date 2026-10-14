interface TrimRange {
  endMicros: number;
  sourceDurationMicros: number;
  startMicros: number;
}

const MIN_SELECTION_MICROS = 1_000_000;

function createFullTrimRange(sourceDurationMicros: number): TrimRange {
  const duration = requirePositiveInteger(sourceDurationMicros, "source duration");
  return {
    startMicros: 0,
    endMicros: duration,
    sourceDurationMicros: duration,
  };
}

function isValidTrimRange(range: TrimRange): boolean {
  const minimumDuration = Math.min(MIN_SELECTION_MICROS, Math.max(0, range.sourceDurationMicros));
  return (
    Number.isSafeInteger(range.sourceDurationMicros) &&
    Number.isSafeInteger(range.startMicros) &&
    Number.isSafeInteger(range.endMicros) &&
    range.sourceDurationMicros > 0 &&
    range.startMicros >= 0 &&
    range.endMicros - range.startMicros >= minimumDuration &&
    range.endMicros <= range.sourceDurationMicros
  );
}

function requirePositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

export { createFullTrimRange, isValidTrimRange, MIN_SELECTION_MICROS };
export type { TrimRange };
