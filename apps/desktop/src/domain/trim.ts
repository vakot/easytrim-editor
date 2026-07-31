export type TrimBoundary = "start" | "end";

export interface TrimRange {
  startMicros: number;
  endMicros: number;
  sourceDurationMicros: number;
}

const MIN_SELECTION_MICROS = 1;

export function createFullTrimRange(sourceDurationMicros: number): TrimRange {
  const duration = requirePositiveInteger(sourceDurationMicros, "source duration");
  return {
    startMicros: 0,
    endMicros: duration,
    sourceDurationMicros: duration,
  };
}

export function moveTrimBoundary(
  range: TrimRange,
  boundary: TrimBoundary,
  requestedMicros: number,
): TrimRange {
  const target = clampInteger(requestedMicros, 0, range.sourceDurationMicros);
  if (boundary === "start") {
    return {
      ...range,
      startMicros: Math.min(target, range.endMicros - MIN_SELECTION_MICROS),
    };
  }
  return {
    ...range,
    endMicros: Math.max(target, range.startMicros + MIN_SELECTION_MICROS),
  };
}

export function microsFromTimelinePosition(
  clientX: number,
  timelineLeft: number,
  timelineWidth: number,
  sourceDurationMicros: number,
): number {
  if (!Number.isFinite(timelineWidth) || timelineWidth <= 0) {
    return 0;
  }
  const fraction = Math.min(1, Math.max(0, (clientX - timelineLeft) / timelineWidth));
  return Math.round(fraction * sourceDurationMicros);
}

export function timelinePercent(micros: number, sourceDurationMicros: number): number {
  if (sourceDurationMicros <= 0) {
    return 0;
  }
  return (clampInteger(micros, 0, sourceDurationMicros) / sourceDurationMicros) * 100;
}

export function clampToTrim(micros: number, range: TrimRange): number {
  return clampInteger(micros, range.startMicros, range.endMicros);
}

export function isValidTrimRange(range: TrimRange): boolean {
  return (
    Number.isSafeInteger(range.sourceDurationMicros) &&
    Number.isSafeInteger(range.startMicros) &&
    Number.isSafeInteger(range.endMicros) &&
    range.sourceDurationMicros > 0 &&
    range.startMicros >= 0 &&
    range.startMicros < range.endMicros &&
    range.endMicros <= range.sourceDurationMicros
  );
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  const integer = Number.isFinite(value) ? Math.round(value) : minimum;
  return Math.min(maximum, Math.max(minimum, integer));
}

function requirePositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}
