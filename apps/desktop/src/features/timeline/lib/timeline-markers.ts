import type { AudioActivityRange } from "@/domain/media";

type TimelineMarker =
  | { kind: "scene"; timeMicros: number }
  | { color: string; kind: "audioActivity"; streamIndex: number; timeMicros: number }
  | { chapterId: string; kind: "chapter"; timeMicros: number };

interface ActivityTrackMarkers {
  activityAnalysis:
    | { status: "ready"; value: readonly AudioActivityRange[] }
    | { status: "idle" | "loading" | "failed" };
  activityVisible: boolean;
  streamIndex: number;
}

function createTimelineMarkers(
  sceneBoundariesMicros: readonly number[],
  audioTracks: readonly ActivityTrackMarkers[],
  colorForStream: (streamIndex: number) => string,
  chapterMarkers: readonly { chapterId: string; timeMicros: number }[] = [],
): TimelineMarker[] {
  const markers: TimelineMarker[] = [
    ...sceneBoundariesMicros.map((timeMicros) => ({ kind: "scene" as const, timeMicros })),
    ...chapterMarkers.map(({ chapterId, timeMicros }) => ({
      chapterId,
      kind: "chapter" as const,
      timeMicros,
    })),
  ];

  for (const track of audioTracks) {
    if (!track.activityVisible || track.activityAnalysis.status !== "ready") continue;
    for (const range of track.activityAnalysis.value) {
      markers.push(
        {
          color: colorForStream(track.streamIndex),
          kind: "audioActivity",
          streamIndex: track.streamIndex,
          timeMicros: range.startMicros,
        },
        {
          color: colorForStream(track.streamIndex),
          kind: "audioActivity",
          streamIndex: track.streamIndex,
          timeMicros: range.endMicros,
        },
      );
    }
  }

  return markers.sort((left, right) => left.timeMicros - right.timeMicros);
}

function timelineMarkerTimes(markers: readonly TimelineMarker[]): number[] {
  return markers.map(({ timeMicros }) => timeMicros);
}

export { createTimelineMarkers, timelineMarkerTimes };
