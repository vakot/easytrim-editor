import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectVisibleAudioActivityMarkers } from "@/app/store/slices/audio-slice";
import { selectChapters } from "@/app/store/slices/chapters-slice";
import { selectVisibleSceneBoundariesMicros } from "@/app/store/slices/scene-detection-slice";
import type { FrameRate } from "@/domain/media";
import { audioTrackColor } from "@/features/audio";
import { useTimelinePlayback } from "@/features/playback";

import { useChapterEditing } from "../contexts/chapter-editing-context";
import { formatTimecode } from "../lib/timecode";

import { Timeline } from "./Timeline";
import { TimelineChapterEditor } from "./TimelineChapterEditor";

const RULER_FRACTIONS = [0, 0.25, 0.5, 0.75, 1] as const;

const MotionMarker = motion.create(Timeline.Marker);

const MARKER_ANIMATION = {
  animate: { opacity: 1, scaleY: 1 },
  exit: { opacity: 0, scaleY: 0 },
  initial: { opacity: 0, scaleY: 0 },
} as const;

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
  const markers = useAppSelector(selectVisibleAudioActivityMarkers);
  const shouldReduceMotion = useReducedMotion() === true;

  return (
    <AnimatePresence initial={false}>
      {markers.map(({ micros, streamIndex }) => (
        <MotionMarker
          {...MARKER_ANIMATION}
          className="inset-y-0 border-l bg-transparent"
          key={`${streamIndex}-${micros}`}
          micros={micros}
          style={{ borderColor: audioTrackColor(streamIndex) }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: "easeOut" }}
        />
      ))}
    </AnimatePresence>
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
          {...MARKER_ANIMATION}
          className="inset-y-0 border-l-2 border-destructive/70 bg-transparent"
          key={micros}
          micros={micros}
          transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: "easeOut" }}
        />
      ))}
    </AnimatePresence>
  );
}

function TimelineMarkersChapters() {
  const { t } = useTranslation();
  const chapters = useAppSelector(selectChapters);
  const { seekTime } = useTimelinePlayback();
  const chapterEditing = useChapterEditing();

  return chapters.map((chapter) =>
    chapter.id === chapterEditing.chapterId ? (
      <TimelineChapterEditor chapterId={chapter.id} key={chapter.id} />
    ) : (
      <span key={chapter.id}>
        <Timeline.Range
          aria-hidden="true"
          className="top-1.5 bottom-auto h-0.5 bg-primary/25"
          endMicros={chapter.endMicros}
          startMicros={chapter.startMicros}
        />
        <Timeline.Marker className="top-0 z-10 bg-transparent" micros={chapter.startMicros}>
          <button
            aria-label={t("timeline.chapters.actions.editChapter", { title: chapter.title })}
            className="pointer-events-auto absolute -top-3 left-px size-4 -translate-x-1/2 focus-visible:outline-ring"
            onClick={() => {
              seekTime(chapter.startMicros);
              chapterEditing.edit(chapter.id);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            title={chapter.title}
            type="button"
          >
            {/* The triangle is centered in a larger hit area. */}
            <span
              aria-hidden="true"
              className="absolute top-1/2 left-1/2 -translate-1/2 border-x-4 border-t-6 border-x-transparent border-t-primary"
            />
            <span
              aria-hidden="true"
              className="absolute top-1/2 left-1/2 h-3 w-px -translate-x-1/2 rounded-full bg-primary content-['']"
            />
          </button>
        </Timeline.Marker>
      </span>
    ),
  );
}

export { TimelineMarkers };
