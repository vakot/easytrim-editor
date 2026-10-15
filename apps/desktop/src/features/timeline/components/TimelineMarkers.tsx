import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectChapters } from "@/app/store/slices/chapters-slice";
import { selectVisibleSceneBoundariesMicros } from "@/app/store/slices/scene-detection-slice";
import type { FrameRate } from "@/domain/media";
import { useTimelinePlayback } from "@/features/playback";

import { formatTimecode } from "../lib/timecode";

import { Timeline } from "./Timeline";

const RULER_FRACTIONS = [0, 0.25, 0.5, 0.75, 1] as const;

const MotionMarker = motion.create(Timeline.Marker);

function TimelineMarkers({ frameRate }: { frameRate?: FrameRate }) {
  return (
    <>
      <TimelineMarkersRuler frameRate={frameRate} />
      <TimelineMarkersAudioActivity />
      <TimelineMarkersSceneActivity />
      <TimelineMarkersChapters />
    </>
  );
}

function TimelineMarkersRuler({ frameRate }: { frameRate?: FrameRate }) {
  const { durationMicros } = useTimelinePlayback();
  return RULER_FRACTIONS.map((fraction) => {
    const micros = Math.round(durationMicros * fraction);
    return (
      <Timeline.Marker
        className="-top-1.5 bg-transparent font-mono"
        key={fraction}
        label={formatTimecode(micros, frameRate)}
        micros={micros}
      />
    );
  });
}

function TimelineMarkersAudioActivity() {
  const tracks = useAppSelector(selectAudioTracks);

  return tracks
    .filter((track) => track.activityVisible)
    .map(
      (track) =>
        track.activityAnalysis.status === "ready" &&
        track.activityAnalysis.value.flatMap((range, index) =>
          [range.startMicros, range.endMicros].map((micros, edge) => (
            <Timeline.Marker
              className="inset-y-0 border-l bg-transparent"
              key={`${track.streamIndex}-${index}-${edge}`}
              micros={micros}
              style={{
                borderColor: `hsl(${((Math.abs(track.streamIndex) * 137.508) % 360).toFixed(1)} 72% 52%)`,
              }}
            />
          )),
        ),
    );
}

function TimelineMarkersSceneActivity() {
  const scenes = useAppSelector(selectVisibleSceneBoundariesMicros);
  const shouldReduceMotion = useReducedMotion() === true;

  // Markers present when the timeline mounts appear without animating; later ones grow in and out.
  return (
    <AnimatePresence initial={false}>
      {scenes.map((micros) => (
        <MotionMarker
          animate={{ opacity: 1, scaleY: 1 }}
          className="inset-y-0 border-l-2 border-destructive/70 bg-transparent"
          exit={{ opacity: 0, scaleY: 0 }}
          initial={{ opacity: 0, scaleY: 0 }}
          key={micros}
          micros={micros}
          transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: "easeOut" }}
        />
      ))}
    </AnimatePresence>
  );
}

function TimelineMarkersChapters() {
  const chapters = useAppSelector(selectChapters);
  const { seekTime } = useTimelinePlayback();

  return chapters.map((chapter) => (
    <span key={chapter.id}>
      <Timeline.Range
        aria-hidden="true"
        className="top-1.5 bottom-auto h-0.5 bg-primary/25"
        endMicros={chapter.endMicros}
        startMicros={chapter.startMicros}
      />
      <Timeline.Marker className="top-0 z-10 bg-transparent" micros={chapter.startMicros}>
        <button
          aria-label={chapter.title}
          className="pointer-events-auto absolute top-0 -translate-x-1/2 border-x-4 border-t-6 border-x-transparent border-t-primary focus-visible:outline-ring"
          onClick={() => seekTime(chapter.startMicros)}
          onPointerDown={(event) => event.stopPropagation()}
          title={chapter.title}
          type="button"
        />
      </Timeline.Marker>
    </span>
  ));
}

export { TimelineMarkers };
