import { useTranslation } from "react-i18next";

import { usePlayback } from "@/app/hooks/usePlayback";
import { useTimeline } from "@/app/hooks/useTimeline";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { clampPlaybackMicros } from "@/domain/playback";
import { minimumSelectionMicros, timelinePercent } from "@/domain/trim";

import { useTrimTimelineInteractions } from "../hooks/useTrimTimelineInteractions";
import { EMPTY_TIMELINE_RANGE } from "../lib/timeline-range";

import { Playhead, SegmentDragHandle, TrimHandle } from "./TimelineHandles";
import styles from "./TimelinePanel.module.css";

export function TimelineTrack() {
  const { t } = useTranslation();
  const media = useAppSelector(selectSourceMedia);
  const playback = usePlayback();
  const timeline = useTimeline();
  const range = timeline.trim ?? EMPTY_TIMELINE_RANGE;
  const disabled = !playback.canInteract;
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
    segmentSnapPoint,
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
  });

  return (
    <div
      aria-label={t("timeline.accessibility.track")}
      className={`${styles.track} ${disabled ? `cursor-not-allowed ${styles.trackDisabled}` : ""}`}
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
        className={`${styles.selection} ${disabled ? styles.selectionDisabled : ""}`}
        style={{
          left: "var(--timeline-trim-start)",
          right: "var(--timeline-trim-end-inset)",
        }}
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
        snapPoint={segmentSnapPoint}
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
