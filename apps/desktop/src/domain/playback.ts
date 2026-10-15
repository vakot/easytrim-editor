interface PlaybackRange {
  endMicros: number;
  startMicros: number;
}

function clampPlaybackMicros(micros: number, sourceDurationMicros: number): number {
  const integer = Number.isFinite(micros) ? Math.round(micros) : 0;
  return Math.min(sourceDurationMicros, Math.max(0, integer));
}

function playbackRange(
  sourceDurationMicros: number,
  segmentStartMicros: number,
  segmentEndMicros: number,
  segmentEnabled: boolean,
): PlaybackRange {
  const sourceEnd = Math.max(0, Math.round(sourceDurationMicros));
  if (!segmentEnabled) {
    return { startMicros: 0, endMicros: sourceEnd };
  }
  const startMicros = clampPlaybackMicros(segmentStartMicros, sourceEnd);
  return {
    startMicros,
    endMicros: Math.max(startMicros, clampPlaybackMicros(segmentEndMicros, sourceEnd)),
  };
}

export { playbackRange };

export type { PlaybackRange };
