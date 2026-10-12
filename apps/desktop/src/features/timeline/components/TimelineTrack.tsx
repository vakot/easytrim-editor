import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useDragAwareDoubleClick } from "@/components/ui/useDragAwareDoubleClick";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectChapters } from "@/app/store/slices/chapters-slice";
import { selectActiveSceneBoundariesMicros } from "@/app/store/slices/editing-instances-slice";
import { selectSceneMarkersEnabled } from "@/app/store/slices/editor-tools-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { clampPlaybackMicros, formatPlaybackTime } from "@/domain/playback";
import { minimumSelectionMicros, timelinePercent, type TrimRange } from "@/domain/trim";
import { audioTrackColor } from "@/features/audio";
import { useTimeline, useTimelineReadiness } from "@/features/timeline";
import { cn } from "@/lib/class-names.utils";

import { useTrimTimelineInteractions } from "../hooks/useTrimTimelineInteractions";
import { createTimelineMarkers } from "../lib/timeline-markers";
import { EMPTY_TIMELINE_RANGE } from "../lib/timeline-range";
import { createTimelineSnapTargets } from "../lib/timeline-snap";

import { Playhead, SegmentDragHandle, TrimHandle } from "./TimelineHandles";

const TIMELINE_MARKER_STYLES = {
  scene: "bg-destructive",
} as const;

function TimelineTrack() {
  return (
    <Timeline>
      <TimelineSegment />

      <TimelineChapterMarkers />

      <TimelineSceneMarkers />

      <TimelineAudioActivityMarkers />

      <TimelinePlayhead />
      <TimelineTrimHandle boundary="start" />
      <TimelineDragHandle />
      <TimelineTrimHandle boundary="end" />
    </Timeline>
  );
}

function Timeline({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();

  const media = useAppSelector(selectSourceMedia);
  const chapters = useAppSelector(selectChapters);
  const sceneMarkersEnabled = useAppSelector(selectSceneMarkersEnabled);
  const sceneBoundariesMicros = useAppSelector(selectActiveSceneBoundariesMicros);
  const audioTracks = useAppSelector(selectAudioTracks);
  const readiness = useTimelineReadiness();
  const timeline = useTimeline();

  const visibleAudioActivityRanges = audioTracks.flatMap((track) =>
    track.activityVisible && track.activityAnalysis.status === "ready"
      ? track.activityAnalysis.value
      : [],
  );

  const snapTargetsMicros = useMemo(
    () =>
      createTimelineSnapTargets(
        sceneMarkersEnabled ? sceneBoundariesMicros : [],
        visibleAudioActivityRanges,
        chapters.flatMap(({ endMicros, startMicros }) => [startMicros, endMicros]),
      ),
    [visibleAudioActivityRanges, sceneBoundariesMicros, sceneMarkersEnabled, chapters],
  );

  const range = timeline.trim ?? EMPTY_TIMELINE_RANGE;
  const disabled = !readiness.canInteract;
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;

  const interactions = useTrimTimelineInteractions({
    frameRate,
    onChange: timeline.onChange,
    onMoveSegment: timeline.onMoveSegment,
    onScrub: timeline.onScrub,
    onScrubEnd: timeline.onScrubEnd,
    onScrubStart: timeline.onScrubStart,
    onSeek: timeline.onSeek,
    onSegmentDragEnd: timeline.onSegmentDragEnd,
    onSegmentDragStart: timeline.onSegmentDragStart,
    onTrimDragEnd: timeline.onTrimDragEnd,
    onTrimDragStart: timeline.onTrimDragStart,
    playheadMicros: timeline.playheadMicros,
    range,
    snapTargetsMicros,
  });

  const {
    finishPointer,
    movePointer,
    resetBoundary,
    scrubDragging,
    segmentDragging,
    startScrub,
    trackRef,
    trimDragState,
  } = interactions;

  const trackCursorClass = segmentDragging
    ? "cursor-grabbing"
    : scrubDragging || trimDragState
      ? "cursor-ew-resize"
      : "cursor-pointer";

  const dragAwareDoubleClick = useDragAwareDoubleClick<HTMLElement>((event, pointerDownTarget) => {
    const target = pointerDownTarget ?? event.target;
    if (!(target instanceof Element)) return;
    const handle = target.closest<HTMLElement>("[data-trim-boundary]");
    const boundary = handle?.dataset.trimBoundary;
    if (boundary === "start" || boundary === "end") resetBoundary(boundary);
  });

  return (
    <TimelineTrackContext.Provider
      value={{
        ...interactions,
        range,
        disabled,
        onSeek: timeline.onSeek,
        playheadMicros: timeline.playheadMicros,
        playheadRef: timeline.playheadRef,
      }}
    >
      <div
        aria-label={t("timeline.playhead.accessibility.track")}
        className={cn(
          "segment-markers relative h-13 rounded-md border bg-muted/30 text-muted",
          trackCursorClass,
          disabled && "pointer-events-none",
        )}
        onDoubleClick={dragAwareDoubleClick.onDoubleClick}
        onLostPointerCapture={(event) => finishPointer(event, false)}
        onPointerCancel={(event) => finishPointer(event, false)}
        onPointerCancelCapture={dragAwareDoubleClick.onPointerCancelCapture}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            startScrub(event);
          }
        }}
        onPointerDownCapture={dragAwareDoubleClick.onPointerDownCapture}
        onPointerMove={movePointer}
        onPointerMoveCapture={dragAwareDoubleClick.onPointerMoveCapture}
        onPointerUp={(event) => finishPointer(event, true)}
        onPointerUpCapture={dragAwareDoubleClick.onPointerUpCapture}
        ref={trackRef}
      >
        {children}
      </div>
    </TimelineTrackContext.Provider>
  );
}

function TimelineTrimHandle({
  boundary,
}: Pick<React.ComponentProps<typeof TrimHandle>, "boundary">) {
  const { disabled, handleTrimKeyboard, handleTrimPointer, range, trimDragState } =
    useTimelineTrack();

  const isStart = boundary === "start";
  const minimumDurationMicros = minimumSelectionMicros(range.sourceDurationMicros);
  const value = isStart ? range.startMicros : range.endMicros;
  const min = isStart ? 0 : range.startMicros + minimumDurationMicros;
  const max = isStart ? range.endMicros - minimumDurationMicros : range.sourceDurationMicros;

  return (
    <TrimHandle
      boundary={boundary}
      disabled={disabled}
      dragging={trimDragState?.boundary === boundary}
      max={max}
      min={min}
      onKeyDown={(event) => handleTrimKeyboard(boundary, event)}
      onPointerDown={(event) => handleTrimPointer(boundary, event, true)}
      snapActive={trimDragState?.boundary === boundary && trimDragState.snapActive}
      value={value}
    />
  );
}

function TimelineDragHandle() {
  const {
    disabled,
    handleSegmentKeyboard,
    range,
    segmentDragging,
    segmentSnapActive,
    startSegmentDrag,
  } = useTimelineTrack();

  const durationMicros = range.endMicros - range.startMicros;

  return (
    <SegmentDragHandle
      disabled={disabled}
      dragging={segmentDragging}
      max={range.sourceDurationMicros - durationMicros}
      min={0}
      onKeyDown={handleSegmentKeyboard}
      onPointerDown={startSegmentDrag}
      snapActive={segmentSnapActive}
      value={range.startMicros}
    />
  );
}

function TimelinePlayhead() {
  const {
    disabled,
    handlePlayheadKeyboard,
    playheadMicros,
    playheadRef,
    range,
    scrubDragging,
    startScrub,
  } = useTimelineTrack();

  const playheadValue = clampPlaybackMicros(playheadMicros, range.sourceDurationMicros);

  return (
    <Playhead
      disabled={disabled}
      dragging={scrubDragging}
      max={range.sourceDurationMicros}
      min={0}
      onKeyDown={handlePlayheadKeyboard}
      onPointerDown={startScrub}
      ref={playheadRef}
      value={playheadValue}
    />
  );
}

function TimelineSegment() {
  const { disabled } = useTimelineTrack();

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 -inset-y-px mx-2 box-border border-y-2 border-primary bg-primary/10",
        disabled && "opacity-50",
      )}
      style={{
        left: "var(--timeline-trim-start)",
        right: "var(--timeline-trim-end-inset)",
      }}
    />
  );
}

function TimelineAudioActivityMarkers() {
  const { range } = useTimelineTrack();

  const sceneBoundariesMicros = useAppSelector(selectActiveSceneBoundariesMicros);
  const audioTracks = useAppSelector(selectAudioTracks);
  const timelineMarkers = useMemo(
    () => createTimelineMarkers(sceneBoundariesMicros, audioTracks, audioTrackColor),
    [audioTracks, sceneBoundariesMicros],
  );

  const shouldReduceMotion = useReducedMotion() === true;

  return (
    <AnimatePresence>
      {timelineMarkers
        .filter((marker) => marker.kind === "audioActivity")
        .map((marker) => {
          const markerPercent = timelinePercent(marker.timeMicros, range.sourceDurationMicros);
          return (
            <motion.div
              animate={{ opacity: 1 }}
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 z-0 w-px"
              exit={{ opacity: 0 }}
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              key={`${marker.streamIndex}-${marker.timeMicros}`}
              style={{ backgroundColor: marker.color, left: `${markerPercent}%` }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.14, ease: "easeOut" }}
            />
          );
        })}
    </AnimatePresence>
  );
}

function TimelineChapterMarkers() {
  const { onSeek, range } = useTimelineTrack();
  const chapters = useAppSelector(selectChapters);
  const { t } = useTranslation();

  return (
    <>
      {chapters.map((chapter) => {
        const left = timelinePercent(chapter.startMicros, range.sourceDurationMicros);
        const right = timelinePercent(chapter.endMicros, range.sourceDurationMicros);
        return (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1 left-0 z-2 h-1 rounded-full bg-primary/20"
            key={`span-${chapter.id}`}
            style={{ left: `${left}%`, width: `${Math.max(0.15, right - left)}%` }}
          />
        );
      })}
      {chapters.map((chapter) => {
        const left = timelinePercent(chapter.startMicros, range.sourceDurationMicros);
        const rangeLabel = `${formatPlaybackTime(chapter.startMicros, undefined)} – ${formatPlaybackTime(chapter.endMicros, undefined)}`;
        const label = t("timeline.chapters.markerLabel", {
          title: chapter.title,
          range: rangeLabel,
        });

        return (
          <button
            aria-label={label}
            className="absolute top-0 z-3 h-2 w-3 -translate-x-1/2 rounded-t-sm bg-primary shadow-sm after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-x-4 after:border-t-4 after:border-x-transparent after:border-t-primary focus-visible:ring-2 focus-visible:ring-ring"
            key={chapter.id}
            onClick={(event) => {
              event.stopPropagation();
              onSeek(chapter.startMicros);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            style={{ left: `${left}%` }}
            title={label}
            type="button"
          />
        );
      })}
    </>
  );
}

function TimelineSceneMarkers() {
  const { range } = useTimelineTrack();

  const enabled = useAppSelector(selectSceneMarkersEnabled);
  const sceneBoundariesMicros = useAppSelector(selectActiveSceneBoundariesMicros);
  const shouldReduceMotion = useReducedMotion() === true;

  return (
    <AnimatePresence>
      {enabled
        ? sceneBoundariesMicros.map((boundaryMicros) => (
            <motion.div
              animate={{ opacity: 1, height: "100%" }}
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute top-1/2 z-1 w-0.5 -translate-1/2",
                TIMELINE_MARKER_STYLES.scene,
              )}
              exit={{ opacity: 0, height: 0 }}
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              key={boundaryMicros}
              style={{ left: `${timelinePercent(boundaryMicros, range.sourceDurationMicros)}%` }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.14, ease: "easeOut" }}
            />
          ))
        : null}
    </AnimatePresence>
  );
}

const TimelineTrackContext = createContext<
  | (ReturnType<typeof useTrimTimelineInteractions> & {
      disabled: boolean;
      onSeek: (micros: number) => void;
      playheadMicros: number;
      playheadRef: React.RefObject<HTMLButtonElement | null>;
      range: TrimRange;
    })
  | null
>(null);

function useTimelineTrack() {
  const context = useContext(TimelineTrackContext);

  if (!context) {
    throw new Error("Timeline components must be used withing Timeline");
  }

  return context;
}

export { TimelineTrack };
