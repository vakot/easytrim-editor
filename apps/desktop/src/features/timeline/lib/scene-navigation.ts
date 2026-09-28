function findPreviousSceneBoundary(boundariesMicros: readonly number[], playheadMicros: number) {
  let previousBoundary: number | undefined;
  for (const boundaryMicros of boundariesMicros) {
    if (
      boundaryMicros < playheadMicros &&
      (previousBoundary === undefined || boundaryMicros > previousBoundary)
    ) {
      previousBoundary = boundaryMicros;
    }
  }
  return previousBoundary;
}

function findNextSceneBoundary(boundariesMicros: readonly number[], playheadMicros: number) {
  let nextBoundary: number | undefined;
  for (const boundaryMicros of boundariesMicros) {
    if (
      boundaryMicros > playheadMicros &&
      (nextBoundary === undefined || boundaryMicros < nextBoundary)
    ) {
      nextBoundary = boundaryMicros;
    }
  }
  return nextBoundary;
}

export { findNextSceneBoundary, findPreviousSceneBoundary };
