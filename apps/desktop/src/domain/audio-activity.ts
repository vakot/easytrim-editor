import type { AudioActivityRange } from "./media";

function audioActivityRangesFromSilence(
  silenceRanges: readonly AudioActivityRange[],
  durationMicros: number,
): AudioActivityRange[] {
  const duration = Math.max(0, durationMicros);
  const activityRanges: AudioActivityRange[] = [];
  let cursorMicros = 0;

  for (const range of silenceRanges) {
    const startMicros = Math.min(duration, Math.max(cursorMicros, range.startMicros));
    const endMicros = Math.min(duration, Math.max(startMicros, range.endMicros));

    if (startMicros > cursorMicros) {
      activityRanges.push({ startMicros: cursorMicros, endMicros: startMicros });
    }

    cursorMicros = endMicros;
    if (cursorMicros >= duration) break;
  }

  if (cursorMicros < duration) {
    activityRanges.push({ startMicros: cursorMicros, endMicros: duration });
  }

  return activityRanges;
}

export { audioActivityRangesFromSilence };
