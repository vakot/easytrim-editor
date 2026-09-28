const SCENE_NAVIGATION_PLAYBACK_TOLERANCE_MICROS = 150_000;

function findPreviousSceneBoundary(
  boundariesMicros: readonly number[],
  playheadMicros: number,
  firstSceneStartMicros?: number,
  playbackRate = 0,
) {
  let previousBoundary: number | undefined;
  for (const boundaryMicros of boundariesMicros) {
    if (
      boundaryMicros < playheadMicros &&
      (previousBoundary === undefined || boundaryMicros > previousBoundary)
    ) {
      previousBoundary = boundaryMicros;
    }
  }

  if (
    firstSceneStartMicros !== undefined &&
    firstSceneStartMicros < playheadMicros &&
    (previousBoundary === undefined || firstSceneStartMicros > previousBoundary)
  ) {
    previousBoundary = firstSceneStartMicros;
  }

  // Playback advances while a seek settles and between clicks. Measure the grace
  // period in played media time so decoder latency cannot consume it.
  if (
    previousBoundary !== undefined &&
    playbackRate > 0 &&
    playheadMicros - previousBoundary <=
      SCENE_NAVIGATION_PLAYBACK_TOLERANCE_MICROS * playbackRate &&
    playheadMicros !== firstSceneStartMicros &&
    !boundariesMicros.includes(playheadMicros)
  ) {
    return findPreviousSceneBoundary(boundariesMicros, previousBoundary, firstSceneStartMicros);
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
