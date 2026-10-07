import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectActiveSceneBoundariesMicros } from "@/app/store/slices/editing-instances-slice";
import { selectSceneMarkersEnabled } from "@/app/store/slices/editor-tools-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { clampPlaybackMicros } from "@/domain/playback";
import { minimumSelectionMicros, timelinePercent } from "@/domain/trim";
import { audioTrackColor } from "@/features/audio";
import { useTimeline, useTimelineReadiness } from "@/features/timeline";
import { cn } from "@/lib/class-names.utils";

import { useTrimTimelineInteractions } from "../hooks/useTrimTimelineInteractions";
import { createTimelineMarkers } from "../lib/timeline-markers";
import { EMPTY_TIMELINE_RANGE } from "../lib/timeline-range";
import { createTimelineSnapTargets } from "../lib/timeline-snap";

import { Playhead, SegmentDragHandle, TrimHandle } from "./TimelineHandles";
import styles from "./TimelinePanel.module.css";

const TIMELINE_MARKER_STYLES = {
  scene: "bg-destructive",
} as const;

function TimelineTrack() {
  const { t } = useTranslation();
  const media = useAppSelector(selectSourceMedia);
  const sceneMarkersEnabled = useAppSelector(selectSceneMarkersEnabled);
  const sceneBoundariesMicros = useAppSelector(selectActiveSceneBoundariesMicros);
  const audioTracks = useAppSelector(selectAudioTracks);
  const readiness = useTimelineReadiness();
  const timeline = useTimeline();
  const timelineMarkers = useMemo(
    () => createTimelineMarkers(sceneBoundariesMicros, audioTracks, audioTrackColor),
    [audioTracks, sceneBoundariesMicros],
  );

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
  const playheadValue = clampPlaybackMicros(timeline.playheadMicros, range.sourceDurationMicros);
  const playheadPercent = timelinePercent(playheadValue, range.sourceDurationMicros);
  const minimumDurationMicros = minimumSelectionMicros(range.sourceDurationMicros);
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
    <div
      aria-label={t("timeline.playhead.accessibility.track")}
      className={cn(
        styles.track,
        disabled && "cursor-not-allowed",
        disabled && styles.trackDisabled,
      )}
      onLostPointerCapture={(event) => finishScrub(event, false)}
      onPointerCancel={(event) => finishScrub(event, false)}
      onPointerDown={(event) => {
        if (!disabled && event.target === event.currentTarget) {
          startScrub(event, event.currentTarget);
        }
      }}
      onPointerMove={moveScrub}
      onPointerUp={(event) => finishScrub(event, true)}
      ref={trackRef}
    >
      <div
        className={cn(styles.selection, disabled && styles.selectionDisabled)}
        style={{
          left: "var(--timeline-trim-start)",
          right: "var(--timeline-trim-end-inset)",
        }}
      />
      <SceneMarkers sourceDurationMicros={range.sourceDurationMicros} />
      <AudioActivityMarkers
        markers={timelineMarkers}
        sourceDurationMicros={range.sourceDurationMicros}
      />
      <SegmentDragHandle
        disabled={disabled}
        dragging={segmentDragging}
        onKeyDown={handleSegmentKeyboard}
        onLostPointerCapture={(event) => finishSegmentDrag(event, false)}
        onPointerCancel={(event) => finishSegmentDrag(event, false)}
        onPointerDown={startSegmentDrag}
        onPointerMove={moveSegmentDrag}
        onPointerUp={(event) => finishSegmentDrag(event, true)}
        range={range}
        snapActive={segmentSnapActive}
      />
      <Playhead
        disabled={disabled}
        dragging={scrubDragging}
        frameRate={frameRate}
        maximum={range.sourceDurationMicros}
        onKeyDown={handlePlayheadKeyboard}
        onLostPointerCapture={(event) => finishScrub(event, false)}
        onPointerCancel={(event) => finishScrub(event, false)}
        onPointerDown={(event) => startScrub(event, event.currentTarget)}
        onPointerMove={moveScrub}
        onPointerUp={(event) => finishScrub(event, true)}
        percent={playheadPercent}
        playheadRef={timeline.playheadRef}
        value={playheadValue}
      />
      <TrimHandle
        boundary="start"
        disabled={disabled}
        dragging={trimDragState?.boundary === "start"}
        maximum={range.endMicros - minimumDurationMicros}
        minimum={0}
        onDoubleClick={() => resetBoundary("start")}
        onKeyDown={(event) => handleTrimKeyboard("start", event)}
        onPointerDown={(event) => handleTrimPointer("start", event, true)}
        onPointerEnd={() => finishTrimDrag("start")}
        onPointerMove={(event) => handleTrimPointer("start", event, false)}
        snapActive={trimDragState?.boundary === "start" && trimDragState.snapActive}
        value={range.startMicros}
      />
      <TrimHandle
        boundary="end"
        disabled={disabled}
        dragging={trimDragState?.boundary === "end"}
        maximum={range.sourceDurationMicros}
        minimum={range.startMicros + minimumDurationMicros}
        onDoubleClick={() => resetBoundary("end")}
        onKeyDown={(event) => handleTrimKeyboard("end", event)}
        onPointerDown={(event) => handleTrimPointer("end", event, true)}
        onPointerEnd={() => finishTrimDrag("end")}
        onPointerMove={(event) => handleTrimPointer("end", event, false)}
        snapActive={trimDragState?.boundary === "end" && trimDragState.snapActive}
        value={range.endMicros}
      />
    </div>
  );
}

function AudioActivityMarkers({
  markers,
  sourceDurationMicros,
}: {
  markers: ReturnType<typeof createTimelineMarkers>;
  sourceDurationMicros: number;
}) {
  const shouldReduceMotion = useReducedMotion() === true;

  return (
    <AnimatePresence>
      {markers
        .filter((marker) => marker.kind === "audioActivity")
        .map((marker) => {
          const markerPercent = timelinePercent(marker.timeMicros, sourceDurationMicros);
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

function SceneMarkers({ sourceDurationMicros }: { sourceDurationMicros: number }) {
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
              style={{ left: `${timelinePercent(boundaryMicros, sourceDurationMicros)}%` }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.14, ease: "easeOut" }}
            />
          ))
        : null}
    </AnimatePresence>
  );
}

export { TimelineTrack };
