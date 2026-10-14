import { Slider } from "@/components/ui/slider";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectChapters } from "@/app/store/slices/chapters-slice";
import { selectActiveSceneBoundariesMicros } from "@/app/store/slices/editing-instances-slice";
import type { FrameRate } from "@/domain/media";
import { microsToFrame, useTimelinePlayback } from "@/features/playback";

function TimelineMarkers({
  frameRate,
  framesCount,
}: {
  frameRate?: FrameRate;
  framesCount: number;
}) {
  const chapters = useAppSelector(selectChapters);
  const scenes = useAppSelector(selectActiveSceneBoundariesMicros);
  const tracks = useAppSelector(selectAudioTracks);
  const { seekFrame } = useTimelinePlayback(frameRate, framesCount);
  const frame = (micros: number) => microsToFrame(micros, frameRate, framesCount);
  if (!framesCount) return null;

  return (
    <>
      <Slider.Marker aria-hidden="true" max={framesCount} value={0} />
      <Slider.Marker aria-hidden="true" max={framesCount} value={framesCount} />
      {scenes.map((micros) => (
        <Slider.Marker
          className="pointer-events-none inset-y-0 border-l-2 border-destructive/70"
          key={micros}
          max={framesCount}
          value={frame(micros)}
        />
      ))}
      {tracks
        .filter((track) => track.activityVisible)
        .map(
          (track) =>
            track.activityAnalysis.status === "ready" &&
            track.activityAnalysis.value.flatMap((range, index) =>
              [range.startMicros, range.endMicros].map((micros, edge) => (
                <Slider.Marker
                  className="pointer-events-none inset-y-0 border-l"
                  key={`${track.streamIndex}-${index}-${edge}`}
                  max={framesCount}
                  style={{
                    borderColor: `hsl(${((Math.abs(track.streamIndex) * 137.508) % 360).toFixed(1)} 72% 52%)`,
                  }}
                  value={frame(micros)}
                />
              )),
            ),
        )}
      {chapters.map((chapter) => (
        <span key={chapter.id}>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1.5 h-0.5 bg-primary/25"
            style={{
              left: `${(frame(chapter.startMicros) / framesCount) * 100}%`,
              right: `${((framesCount - frame(chapter.endMicros)) / framesCount) * 100}%`,
            }}
          />
          <Slider.Marker
            className="top-0 z-10"
            max={framesCount}
            value={frame(chapter.startMicros)}
          >
            <button
              aria-label={chapter.title}
              className="absolute top-0 -translate-x-1/2 border-x-4 border-t-6 border-x-transparent border-t-primary focus-visible:outline-ring"
              onClick={() => seekFrame(frame(chapter.startMicros))}
              title={chapter.title}
              type="button"
            />
          </Slider.Marker>
          <Slider.Marker aria-hidden="true" max={framesCount} value={frame(chapter.endMicros)} />
        </span>
      ))}
    </>
  );
}

export { TimelineMarkers };
