const SCENE_NAVIGATION_REPEAT_WINDOW_MS = 125;

let previousSceneNavigation: { invokedAt: number; targetMicros: number } | null = null;

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

function resolvePreviousSceneNavigationTarget(
  boundariesMicros: readonly number[],
  playheadMicros: number,
) {
  const now = performance.now();
  const targetMicros =
    previousSceneNavigation !== null &&
    now - previousSceneNavigation.invokedAt <= SCENE_NAVIGATION_REPEAT_WINDOW_MS
      ? findPreviousSceneBoundary(boundariesMicros, previousSceneNavigation.targetMicros)
      : findPreviousSceneBoundary(boundariesMicros, playheadMicros);

  previousSceneNavigation =
    targetMicros === undefined ? null : { invokedAt: now, targetMicros };

  return targetMicros;
}

function resetSceneNavigation() {
  previousSceneNavigation = null;
}

export {
  findNextSceneBoundary,
  findPreviousSceneBoundary,
  resetSceneNavigation,
  resolvePreviousSceneNavigationTarget,
};
