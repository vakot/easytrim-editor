export type TrimBoundary = "start" | "end";

export interface TrimRange {
  startMicros: number;
  endMicros: number;
  sourceDurationMicros: number;
}

export const MIN_SELECTION_MICROS = 1_000_000;

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

export function moveTrimRange(range: TrimRange, requestedStartMicros: number): TrimRange {
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

export interface PlayheadBoundaryFollow {
  playheadMicros: number;
  boundary: TrimBoundary | null;
}

export function playheadAfterSegmentMove(
  previousRange: TrimRange,
  nextRange: TrimRange,
  playheadMicros: number,
  followedBoundary: TrimBoundary | null,
): PlayheadBoundaryFollow {
  const movementMicros = nextRange.startMicros - previousRange.startMicros;

  if (followedBoundary) {
    const followed = safeBoundaryFollowAfterMove(
      previousRange,
      nextRange,
      followedBoundary,
      playheadMicros,
      true,
    );
    if (followed.boundary) {
      return followed;
    }
  }

  const approachingBoundary = movementMicros > 0 ? "start" : movementMicros < 0 ? "end" : null;
  if (approachingBoundary) {
    return safeBoundaryFollowAfterMove(
      previousRange,
      nextRange,
      approachingBoundary,
      playheadMicros,
      false,
    );
  }

  return {
    playheadMicros: clampInteger(playheadMicros, 0, nextRange.sourceDurationMicros),
    boundary: null,
  };
}

export function playheadAfterTrimBoundaryMove(
  previousRange: TrimRange,
  nextRange: TrimRange,
  boundary: TrimBoundary,
  playheadMicros: number,
): number {
  return safeBoundaryFollowAfterMove(previousRange, nextRange, boundary, playheadMicros, false)
    .playheadMicros;
}

function safeBoundaryFollowAfterMove(
  previousRange: TrimRange,
  nextRange: TrimRange,
  boundary: TrimBoundary,
  playheadMicros: number,
  alreadyFollowing: boolean,
): PlayheadBoundaryFollow {
  const playhead = clampInteger(playheadMicros, 0, nextRange.sourceDurationMicros);
  const previousBoundaryMicros =
    boundary === "start" ? previousRange.startMicros : previousRange.endMicros;
  const nextBoundaryMicros = boundary === "start" ? nextRange.startMicros : nextRange.endMicros;
  const movementMicros = nextBoundaryMicros - previousBoundaryMicros;
  const movingTowardOpposite = boundary === "start" ? movementMicros > 0 : movementMicros < 0;

  if (alreadyFollowing && (movingTowardOpposite || movementMicros === 0)) {
    return { playheadMicros: nextBoundaryMicros, boundary };
  }

  const reachedPlayhead =
    movingTowardOpposite &&
    (boundary === "start"
      ? previousBoundaryMicros <= playhead && nextBoundaryMicros >= playhead
      : previousBoundaryMicros >= playhead && nextBoundaryMicros <= playhead);

  return reachedPlayhead
    ? { playheadMicros: nextBoundaryMicros, boundary }
    : { playheadMicros: playhead, boundary: null };
}

export function setTrimBoundaryAtPlayhead(
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

export function canSetTrimBoundaryAtPlayhead(
  range: TrimRange,
  boundary: TrimBoundary,
  playheadMicros: number,
): boolean {
  const target = clampInteger(playheadMicros, 0, range.sourceDurationMicros);
  return boundary === "start" ? target < range.sourceDurationMicros : target > 0;
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

export function minimumSelectionMicros(sourceDurationMicros: number): number {
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
