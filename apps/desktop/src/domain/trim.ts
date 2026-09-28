export type TrimBoundary = "start" | "end";

interface TrimRange {
  endMicros: number;
  sourceDurationMicros: number;
  startMicros: number;
}

export type SegmentSnapPoint = TrimBoundary | "center";

interface SegmentSnapResult {
  point: SegmentSnapPoint | null;
  range: TrimRange;
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

function moveTrimBoundary(
  range: TrimRange,
  boundary: TrimBoundary,
  requestedMicros: number,
): TrimRange {
  const target = clampInteger(requestedMicros, 0, range.sourceDurationMicros);
  const minimumDuration = minimumSelectionMicros(range.sourceDurationMicros);
  if (boundary === "start") {
    return {
      ...range,
      startMicros: Math.min(target, range.endMicros - minimumDuration),
    };
  }
  return {
    ...range,
    endMicros: Math.max(target, range.startMicros + minimumDuration),
  };
}

function moveTrimRange(range: TrimRange, requestedStartMicros: number): TrimRange {
  const durationMicros = range.endMicros - range.startMicros;
  const startMicros = clampInteger(
    requestedStartMicros,
    0,
    range.sourceDurationMicros - durationMicros,
  );

  return {
    ...range,
    startMicros,
    endMicros: startMicros + durationMicros,
  };
}

function snapMovedTrimRangeToPlayhead(
  movedRange: TrimRange,
  playheadMicros: number,
  snapReachMicros: number,
): SegmentSnapResult {
  const playhead = clampInteger(playheadMicros, 0, movedRange.sourceDurationMicros);
  const reach = Number.isFinite(snapReachMicros) ? Math.max(0, snapReachMicros) : 0;
  const eligiblePoints: SegmentSnapPoint[] = ["center", "start", "end"];

  let closestPoint: SegmentSnapPoint | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const point of eligiblePoints) {
    const distance = Math.abs(segmentPointMicros(movedRange, point) - playhead);
    if (
      distance <= reach &&
      distance < closestDistance &&
      canAlignSegmentPoint(movedRange, point, playhead)
    ) {
      closestPoint = point;
      closestDistance = distance;
    }
  }

  if (!closestPoint) {
    return { range: movedRange, point: null };
  }

  return {
    range: moveTrimRange(movedRange, alignedSegmentStartMicros(movedRange, closestPoint, playhead)),
    point: closestPoint,
  };
}

function segmentPointMicros(range: TrimRange, point: SegmentSnapPoint): number {
  if (point === "start") {
    return range.startMicros;
  }
  if (point === "end") {
    return range.endMicros;
  }
  return range.startMicros + (range.endMicros - range.startMicros) / 2;
}

function canAlignSegmentPoint(
  range: TrimRange,
  point: SegmentSnapPoint,
  playheadMicros: number,
): boolean {
  const requestedStartMicros = alignedSegmentStartMicros(range, point, playheadMicros);
  const durationMicros = range.endMicros - range.startMicros;
  return (
    requestedStartMicros >= 0 && requestedStartMicros <= range.sourceDurationMicros - durationMicros
  );
}

function alignedSegmentStartMicros(
  range: TrimRange,
  point: SegmentSnapPoint,
  playheadMicros: number,
): number {
  const durationMicros = range.endMicros - range.startMicros;
  if (point === "start") {
    return playheadMicros;
  }
  if (point === "center") {
    return playheadMicros - durationMicros / 2;
  }
  return playheadMicros - durationMicros;
}

function setTrimBoundaryAtPlayhead(
  range: TrimRange,
  boundary: TrimBoundary,
  playheadMicros: number,
): TrimRange {
  const target = clampInteger(playheadMicros, 0, range.sourceDurationMicros);
  const minimumDuration = minimumSelectionMicros(range.sourceDurationMicros);

  if (boundary === "start") {
    if (target >= range.sourceDurationMicros) {
      return range;
    }
    const nextEndMicros = target >= range.endMicros ? range.sourceDurationMicros : range.endMicros;
    return {
      ...range,
      startMicros: Math.min(target, nextEndMicros - minimumDuration),
      endMicros: nextEndMicros,
    };
  }

  if (target <= 0) {
    return range;
  }
  const nextStartMicros = target <= range.startMicros ? 0 : range.startMicros;
  return {
    ...range,
    startMicros: nextStartMicros,
    endMicros: Math.max(target, nextStartMicros + minimumDuration),
  };
}

function canSetTrimBoundaryAtPlayhead(
  range: TrimRange,
  boundary: TrimBoundary,
  playheadMicros: number,
): boolean {
  const target = clampInteger(playheadMicros, 0, range.sourceDurationMicros);
  return boundary === "start" ? target < range.sourceDurationMicros : target > 0;
}

function microsFromTimelinePosition(
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

function timelinePercent(micros: number, sourceDurationMicros: number): number {
  if (sourceDurationMicros <= 0) {
    return 0;
  }
  return (clampInteger(micros, 0, sourceDurationMicros) / sourceDurationMicros) * 100;
}

function clampToTrim(micros: number, range: TrimRange): number {
  return clampInteger(micros, range.startMicros, range.endMicros);
}

function isValidTrimRange(range: TrimRange): boolean {
  const minimumDuration = minimumSelectionMicros(range.sourceDurationMicros);
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

function minimumSelectionMicros(sourceDurationMicros: number): number {
  return Math.min(MIN_SELECTION_MICROS, Math.max(0, sourceDurationMicros));
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

export {
  canSetTrimBoundaryAtPlayhead,
  clampToTrim,
  createFullTrimRange,
  isValidTrimRange,
  microsFromTimelinePosition,
  minimumSelectionMicros,
  moveTrimBoundary,
  moveTrimRange,
  setTrimBoundaryAtPlayhead,
  snapMovedTrimRangeToPlayhead,
  timelinePercent,
};

export type { TrimRange };
