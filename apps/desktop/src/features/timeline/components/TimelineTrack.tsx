import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectActiveSceneBoundariesMicros } from "@/app/store/slices/editing-instances-slice";
import { selectSceneMarkersEnabled } from "@/app/store/slices/editor-tools-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { clampPlaybackMicros } from "@/domain/playback";
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
      ),
    [visibleAudioActivityRanges, sceneBoundariesMicros, sceneMarkersEnabled],
  );

  const range = timeline.trim ?? EMPTY_TIMELINE_RANGE;
  const disabled = !readiness.canInteract;
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;

  const {
    finishScrub,
    finishSegmentDrag,
    finishTrimDrag,
    handlePlayheadKeyboard,
    handleSegmentKeyboard,
    handleTrimKeyboard,
    handleTrimPointer,
    moveScrub,
    moveSegmentDrag,
    resetBoundary,
    scrubDragging,
    segmentDragging,
    segmentSnapActive,
    startScrub,
    startSegmentDrag,
    trackRef,
    trimDragState,
  } = useTrimTimelineInteractions({
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

  return (
    <TimelineTrackContext.Provider
      value={{
        finishScrub,
        finishSegmentDrag,
        finishTrimDrag,
        handlePlayheadKeyboard,
        handleSegmentKeyboard,
        handleTrimKeyboard,
        handleTrimPointer,
        moveScrub,
        moveSegmentDrag,
        resetBoundary,
        scrubDragging,
        segmentDragging,
        segmentSnapActive,
        startScrub,
        startSegmentDrag,
        trackRef,
        trimDragState,
        range,
        disabled,
        playheadMicros: timeline.playheadMicros,
        playheadRef: timeline.playheadRef,
      }}
    >
      <div
        aria-label={t("timeline.playhead.accessibility.track")}
        className={cn(
          "segment-markers relative h-13 cursor-pointer rounded-md border bg-muted/30 text-muted",
          disabled && "pointer-events-none",
        )}
        onLostPointerCapture={(event) => finishScrub(event, false)}
        onPointerCancel={(event) => finishScrub(event, false)}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            startScrub(event, event.currentTarget);
          }
        }}
        onPointerMove={moveScrub}
        onPointerUp={(event) => finishScrub(event, true)}
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
  const {
    disabled,
    finishTrimDrag,
    handleTrimKeyboard,
    handleTrimPointer,
    range,
    resetBoundary,
    trimDragState,
  } = useTimelineTrack();

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
      onDoubleClick={() => resetBoundary(boundary)}
      onKeyDown={(event) => handleTrimKeyboard(boundary, event)}
      onLostPointerCapture={() => finishTrimDrag(boundary)}
      onPointerCancel={() => finishTrimDrag(boundary)}
      onPointerDown={(event) => handleTrimPointer(boundary, event, true)}
      onPointerMove={(event) => handleTrimPointer(boundary, event, false)}
      onPointerUp={() => finishTrimDrag(boundary)}
      snapActive={trimDragState?.boundary === boundary && trimDragState.snapActive}
      value={value}
    />
  );
}

function TimelineDragHandle() {
  const {
    disabled,
    finishSegmentDrag,
    handleSegmentKeyboard,
    moveSegmentDrag,
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
      onLostPointerCapture={(event) => finishSegmentDrag(event, false)}
      onPointerCancel={(event) => finishSegmentDrag(event, false)}
      onPointerDown={startSegmentDrag}
      onPointerMove={moveSegmentDrag}
      onPointerUp={(event) => finishSegmentDrag(event, true)}
      snapActive={segmentSnapActive}
      value={range.startMicros}
    />
  );
}

function TimelinePlayhead() {
  const {
    disabled,
    finishScrub,
    handlePlayheadKeyboard,
    moveScrub,
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
      onLostPointerCapture={(event) => finishScrub(event, false)}
      onPointerCancel={(event) => finishScrub(event, false)}
      onPointerDown={(event) => startScrub(event, event.currentTarget)}
      onPointerMove={moveScrub}
      onPointerUp={(event) => finishScrub(event, true)}
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
