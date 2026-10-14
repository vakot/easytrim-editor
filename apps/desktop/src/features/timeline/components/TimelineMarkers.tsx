import { useMemo } from "react";

import { Slider, type SliderMarker } from "@/components/ui/slider";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectChapters } from "@/app/store/slices/chapters-slice";
import { selectActiveSceneBoundariesMicros } from "@/app/store/slices/editing-instances-slice";
import type { FrameRate } from "@/domain/media";
import { microsToFrame, useTimelinePlayback } from "@/features/playback";

import { formatFrameTimecode } from "../lib/frame-time";

const PERCENT_MARKERS = [0, 0.25, 0.5, 0.75, 1] as const;

function TimelineMarkers({ frameRate, lastFrame }: { frameRate?: FrameRate; lastFrame: number }) {
  return (
    <>
      <TimelineMarkersStatic frameRate={frameRate} lastFrame={lastFrame} />
      <TimelineMarkersAudioActivity frameRate={frameRate} lastFrame={lastFrame} />
      <TimelineMarkersSceneActivity frameRate={frameRate} lastFrame={lastFrame} />
      <TimelineMarkersChapters frameRate={frameRate} lastFrame={lastFrame} />
    </>
  );
}

function TimelineMarkersStatic({
  frameRate,
  lastFrame,
}: {
  frameRate?: FrameRate;
  lastFrame: number;
}) {
  const markers = useMemo<SliderMarker[]>(
    () =>
      PERCENT_MARKERS.map<SliderMarker>((percent) => {
        // An empty timeline uses a 0..1 scale.
        const value = lastFrame > 0 ? lastFrame * percent : percent;
        return {
          value,
          label: lastFrame > 0 ? formatFrameTimecode(value, frameRate) : "00:00:00:00f",
          // Only the timeline edges stay snappable.
          snapTarget: lastFrame > 0 && (percent === 0 || percent === 1),
        };
      }),
    [lastFrame, frameRate],
  );

  return (
    <Slider.Markers
      className="-inset-bs-1 font-mono **:data-[slot=slider-marker]:bg-transparent"
      markers={markers}
    />
  );
}

function TimelineMarkersAudioActivity({
  frameRate,
  lastFrame,
}: {
  frameRate?: FrameRate;
  lastFrame: number;
}) {
  const tracks = useAppSelector(selectAudioTracks);

  const frame = (micros: number) => microsToFrame(micros, frameRate, lastFrame);

  if (!lastFrame || !frameRate) return null;

  return tracks
    .filter((track) => track.activityVisible)
    .map(
      (track) =>
        track.activityAnalysis.status === "ready" &&
        track.activityAnalysis.value.flatMap((range, index) =>
          [range.startMicros, range.endMicros].map((micros, edge) => (
            <Slider.Marker
              className="pointer-events-none inset-y-0 border-l"
              key={`${track.streamIndex}-${index}-${edge}`}

              style={{
                borderColor: `hsl(${((Math.abs(track.streamIndex) * 137.508) % 360).toFixed(1)} 72% 52%)`,
              }}
              value={frame(micros)}
            />
          )),
        ),
    );
}

function TimelineMarkersSceneActivity({
  frameRate,
  lastFrame,
}: {
  frameRate?: FrameRate;
  lastFrame: number;
}) {
  const scenes = useAppSelector(selectActiveSceneBoundariesMicros);

  const frame = (micros: number) => microsToFrame(micros, frameRate, lastFrame);

  if (!lastFrame || !frameRate) return null;

  return scenes.map((micros) => (
    <Slider.Marker
      className="pointer-events-none inset-y-0 border-l-2 border-destructive/70"
      key={micros}

      value={frame(micros)}
    />
  ));
}

function TimelineMarkersChapters({
  frameRate,
  lastFrame,
}: {
  frameRate?: FrameRate;
  lastFrame: number;
}) {
  const chapters = useAppSelector(selectChapters);
  const { seekFrame } = useTimelinePlayback(frameRate);

  const frame = (micros: number) => microsToFrame(micros, frameRate, lastFrame);

  if (!lastFrame || !frameRate) return null;

  return chapters.map((chapter) => (
    <span key={chapter.id}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1.5 h-0.5 bg-primary/25"
        style={{
          left: `${(frame(chapter.startMicros) / lastFrame) * 100}%`,
          right: `${((lastFrame - frame(chapter.endMicros)) / lastFrame) * 100}%`,
        }}
      />
      <Slider.Marker className="top-0 z-10" value={frame(chapter.startMicros)}>
        <button
          aria-label={chapter.title}
          className="absolute top-0 -translate-x-1/2 border-x-4 border-t-6 border-x-transparent border-t-primary focus-visible:outline-ring"
          onClick={() => seekFrame(frame(chapter.startMicros))}
          title={chapter.title}
          type="button"
        />
      </Slider.Marker>
      <Slider.Marker aria-hidden="true" value={frame(chapter.endMicros)} />
    </span>
  ));
}

export { TimelineMarkers };
