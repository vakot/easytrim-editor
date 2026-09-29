import type { SilenceRange } from "@/lib/tauri/media.types";

const TIMELINE_SNAP_REACH_PX = 12;

function createTimelineSnapTargets(
  sceneBoundariesMicros: readonly number[],
  silenceRanges: readonly SilenceRange[],
) {
  return [
    ...sceneBoundariesMicros,
    ...silenceRanges.flatMap(({ endMicros, startMicros }) => [startMicros, endMicros]),
  ].sort((left, right) => left - right);
}

function findNearestTimelineSnapTarget(
  pointerMicros: number,
  trackWidth: number,
  sourceDurationMicros: number,
  snapTargetsMicros: readonly number[],
): number | null {
  if (trackWidth <= 0 || sourceDurationMicros <= 0 || snapTargetsMicros.length === 0) {
    return null;
  }

  let low = 0;
  let high = snapTargetsMicros.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (snapTargetsMicros[middle]! < pointerMicros) low = middle + 1;
    else high = middle;
  }

  const left = snapTargetsMicros[low - 1];
  const right = snapTargetsMicros[low];
  const leftDistance = left === undefined ? Number.POSITIVE_INFINITY : pointerMicros - left;
  const rightDistance = right === undefined ? Number.POSITIVE_INFINITY : right - pointerMicros;
  const nearest = leftDistance < rightDistance ? left : right;
  if (nearest === undefined) return null;

  const distancePixels = (Math.abs(pointerMicros - nearest) / sourceDurationMicros) * trackWidth;
  return distancePixels <= TIMELINE_SNAP_REACH_PX ? nearest : null;
}

export { createTimelineSnapTargets, findNearestTimelineSnapTarget, TIMELINE_SNAP_REACH_PX };
