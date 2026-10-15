import { type FrameIndex, nearestBoundaryMicros } from "./frame-index";
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

/**
 * Moves each range edge to the nearest frame boundary, the times a trim boundary can rest on.
 * Ranges that collapse to nothing are dropped, and ranges that now touch are joined.
 */
function alignAudioActivityRangesToFrames(
  ranges: readonly AudioActivityRange[],
  index: FrameIndex,
): AudioActivityRange[] {
  const aligned: AudioActivityRange[] = [];

  for (const range of ranges) {
    const startMicros = nearestBoundaryMicros(index, range.startMicros);
    const endMicros = nearestBoundaryMicros(index, range.endMicros);
    if (endMicros <= startMicros) continue;

    const previous = aligned.at(-1);
    if (previous && startMicros <= previous.endMicros) {
      previous.endMicros = Math.max(previous.endMicros, endMicros);
    } else {
      aligned.push({ startMicros, endMicros });
    }
  }

  return aligned;
}

export { alignAudioActivityRangesToFrames, audioActivityRangesFromSilence };
