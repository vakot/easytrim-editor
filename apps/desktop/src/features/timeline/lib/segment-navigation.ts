import type { SilenceRange } from "@/lib/tauri/media.types";

function findPreviousSegment(
  sceneBoundariesMicros: readonly number[],
  silenceRanges: readonly SilenceRange[],
  playheadMicros: number,
  firstSceneStartMicros?: number,
) {
  let previousBoundary: number | undefined;
  const considerBoundary = (boundaryMicros: number) => {
    if (
      boundaryMicros < playheadMicros &&
      (previousBoundary === undefined || boundaryMicros > previousBoundary)
    ) {
      previousBoundary = boundaryMicros;
    }
  };

  sceneBoundariesMicros.forEach(considerBoundary);
  silenceRanges.forEach(({ startMicros }) => considerBoundary(startMicros));
  if (firstSceneStartMicros !== undefined) considerBoundary(firstSceneStartMicros);

  return previousBoundary;
}

function findNextSegment(
  sceneBoundariesMicros: readonly number[],
  silenceRanges: readonly SilenceRange[],
  playheadMicros: number,
) {
  let nextBoundary: number | undefined;
  const considerBoundary = (boundaryMicros: number) => {
    if (
      boundaryMicros > playheadMicros &&
      (nextBoundary === undefined || boundaryMicros < nextBoundary)
    ) {
      nextBoundary = boundaryMicros;
    }
  };

  sceneBoundariesMicros.forEach(considerBoundary);
  silenceRanges.forEach(({ startMicros }) => considerBoundary(startMicros));

  return nextBoundary;
}

export { findNextSegment, findPreviousSegment };
