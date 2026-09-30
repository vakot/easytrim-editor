import type { AudioActivityRange } from "@/domain/media";
import { minimumSelectionMicros, type TrimRange } from "@/domain/trim";

const TIMELINE_SNAP_REACH_PX = 12;

type TimelineSnapAnchorId =
  | "playhead"
  | "source-end"
  | "source-start"
  | "trim-center"
  | "trim-end"
  | "trim-start"
  | `marker-${number}`;

interface TimelineSnapAnchor {
  id: TimelineSnapAnchorId;
  movesWith: readonly TimelineSnapAnchorId[];
  reachableTimeRange: { maximumMicros: number; minimumMicros: number };
  timeMicros: number;
  timeOffsetMicros: 0 | 0.5;
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
  const durationMicros = range.endMicros - range.startMicros;
  const centerMicros = range.startMicros + durationMicros / 2;
  const minimumDuration = minimumSelectionMicros(range.sourceDurationMicros);

  return [
    {
      id: "playhead",
      movesWith: [],
      reachableTimeRange: { minimumMicros: 0, maximumMicros: range.sourceDurationMicros },
      timeMicros: playheadMicros,
      timeOffsetMicros: 0,
    },
    {
      id: "source-start",
      movesWith: [],
      reachableTimeRange: { minimumMicros: 0, maximumMicros: 0 },
      timeMicros: 0,
      timeOffsetMicros: 0,
    },
    {
      id: "source-end",
      movesWith: [],
      reachableTimeRange: {
        minimumMicros: range.sourceDurationMicros,
        maximumMicros: range.sourceDurationMicros,
      },
      timeMicros: range.sourceDurationMicros,
      timeOffsetMicros: 0,
    },
    {
      id: "trim-start",
      movesWith: ["trim-center"],
      reachableTimeRange: { minimumMicros: 0, maximumMicros: range.endMicros - minimumDuration },
      timeMicros: range.startMicros,
      timeOffsetMicros: 0,
    },
    {
      id: "trim-center",
      movesWith: ["trim-start", "trim-end"],
      reachableTimeRange: {
        minimumMicros: durationMicros / 2,
        maximumMicros: range.sourceDurationMicros - durationMicros / 2,
      },
      timeMicros: centerMicros,
      timeOffsetMicros: durationMicros % 2 === 0 ? 0 : 0.5,
    },
    {
      id: "trim-end",
      movesWith: ["trim-center"],
      reachableTimeRange: {
        minimumMicros: range.startMicros + minimumDuration,
        maximumMicros: range.sourceDurationMicros,
      },
      timeMicros: range.endMicros,
      timeOffsetMicros: 0,
    },
    ...markerTimesMicros.map((timeMicros, index) => ({
      id: `marker-${index}` as TimelineSnapAnchorId,
      movesWith: [] as const,
      reachableTimeRange: { minimumMicros: timeMicros, maximumMicros: timeMicros },
      timeMicros,
      timeOffsetMicros: 0 as const,
    })),
  ];
}

function findNearestTimelineSnapAnchor(
  positionMicros: number,
  trackWidth: number,
  sourceDurationMicros: number,
  anchors: readonly TimelineSnapAnchor[],
  activeAnchorId: TimelineSnapAnchorId,
): TimelineSnapAnchor | null {
  if (trackWidth <= 0 || sourceDurationMicros <= 0) return null;

  const activeAnchor = anchors.find(({ id }) => id === activeAnchorId);
  if (!activeAnchor) return null;

  let nearest: TimelineSnapAnchor | null = null;
  let nearestDistancePixels = Number.POSITIVE_INFINITY;

  for (const anchor of anchors) {
    if (anchor.id === activeAnchorId || anchor.movesWith.includes(activeAnchorId)) continue;
    if (
      anchor.timeMicros < activeAnchor.reachableTimeRange.minimumMicros ||
      anchor.timeMicros > activeAnchor.reachableTimeRange.maximumMicros ||
      (anchor.timeMicros - activeAnchor.timeOffsetMicros) % 1 !== 0
    ) {
      continue;
    }

    const distancePixels =
      (Math.abs(positionMicros - anchor.timeMicros) / sourceDurationMicros) * trackWidth;

    if (distancePixels <= TIMELINE_SNAP_REACH_PX && distancePixels < nearestDistancePixels) {
      nearest = anchor;
      nearestDistancePixels = distancePixels;
    }
  }

  return nearest;
}

export {
  createTimelineSnapAnchors,
  createTimelineSnapTargets,
  findNearestTimelineSnapAnchor,
  TIMELINE_SNAP_REACH_PX,
};

export type { TimelineSnapAnchor, TimelineSnapAnchorId };
