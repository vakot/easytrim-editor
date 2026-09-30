import type { AudioActivityRange } from "@/domain/media";
import type { TrimRange } from "@/domain/trim";

const TIMELINE_SNAP_REACH_PX = 12;

type TimelineSnapAnchorId =
  "playhead" | "trim-center" | "trim-end" | "trim-start" | `marker-${number}`;

interface TimelineSnapAnchor {
  id: TimelineSnapAnchorId;
  timeMicros: number;
}

function createTimelineSnapTargets(
  sceneBoundariesMicros: readonly number[],
  audioActivityRanges: readonly AudioActivityRange[],
) {
  return [
    ...sceneBoundariesMicros,
    ...audioActivityRanges.flatMap(({ endMicros, startMicros }) => [startMicros, endMicros]),
  ].sort((left, right) => left - right);
}

function createTimelineSnapAnchors(
  playheadMicros: number,
  range: TrimRange,
  markerTimesMicros: readonly number[],
): TimelineSnapAnchor[] {
  const trimCenterMicros = range.startMicros + (range.endMicros - range.startMicros) / 2;
  const anchors: TimelineSnapAnchor[] = [
    { id: "playhead", timeMicros: playheadMicros },
    { id: "trim-start", timeMicros: range.startMicros },
    { id: "trim-center", timeMicros: trimCenterMicros },
    { id: "trim-end", timeMicros: range.endMicros },
    ...markerTimesMicros.map((timeMicros, index) => ({
      id: `marker-${index}` as TimelineSnapAnchorId,
      timeMicros,
    })),
  ];

  return anchors;
}

function findNearestTimelineSnapAnchor(
  positionMicros: number,
  trackWidth: number,
  sourceDurationMicros: number,
  anchors: readonly TimelineSnapAnchor[],
  activeAnchorId: TimelineSnapAnchorId,
  excludedAnchorIds: readonly TimelineSnapAnchorId[] = [],
): TimelineSnapAnchor | null {
  if (trackWidth <= 0 || sourceDurationMicros <= 0) return null;

  let nearest: TimelineSnapAnchor | null = null;
  let nearestDistancePixels = Number.POSITIVE_INFINITY;

  for (const anchor of anchors) {
    if (anchor.id === activeAnchorId || excludedAnchorIds.includes(anchor.id)) continue;

    const distancePixels =
      (Math.abs(positionMicros - anchor.timeMicros) / sourceDurationMicros) * trackWidth;

    if (distancePixels <= TIMELINE_SNAP_REACH_PX && distancePixels < nearestDistancePixels) {
      nearest = anchor;
      nearestDistancePixels = distancePixels;
    }
  }

  return nearest;
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

export {
  createTimelineSnapAnchors,
  createTimelineSnapTargets,
  findNearestTimelineSnapAnchor,
  findNearestTimelineSnapTarget,
  TIMELINE_SNAP_REACH_PX,
};

export type { TimelineSnapAnchor, TimelineSnapAnchorId };
