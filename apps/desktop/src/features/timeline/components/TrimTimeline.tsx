import type { ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";

import { clampPlaybackMicros, formatPlaybackTime } from "@/domain/playback";
import {
  minimumSelectionMicros,
  timelinePercent,
  type TrimBoundary,
  type TrimRange,
} from "@/domain/trim";
import type { FrameRate } from "@/lib/tauri/media.types";

import { useTrimTimelineInteractions } from "../hooks/useTrimTimelineInteractions";

import { Playhead, SegmentDragHandle, TrimHandle } from "./TimelineHandles";
import { TimelineTimeValue } from "./TimelineTimeValue";
import styles from "./TrimTimeline.module.css";

interface TrimTimelineProps {
  disabled?: boolean;
  frameRate?: FrameRate;
  onChange: (boundary: TrimBoundary, range: TrimRange) => TrimBoundary | null;
  onMoveSegment: (range: TrimRange) => TrimBoundary | null;
  onScrub: (micros: number) => void;
  onScrubEnd: () => void;
  onScrubStart: () => void;
  onSeek: (micros: number) => void;
  onSegmentDragEnd: () => void;
  onSegmentDragStart: () => void;
  onTrimDragEnd: () => void;
  onTrimDragStart: () => void;
  playbackControls: ReactNode;
  playbackTimecode: ReactNode;
  playheadMicros: number;
  playheadRef: RefObject<HTMLButtonElement | null>;
  range: TrimRange;
  videoToolbar: ReactNode;
}

export function TrimTimeline({
  disabled = false,
  frameRate,
  onChange,
  onMoveSegment,
  onScrub,
  onScrubEnd,
  onScrubStart,
  onSeek,
  onSegmentDragEnd,
  onSegmentDragStart,
  onTrimDragEnd,
  onTrimDragStart,
  playbackControls,
  playbackTimecode,
  playheadMicros,
  playheadRef,
  range,
  videoToolbar,
}: TrimTimelineProps) {
  const { t } = useTranslation();
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
    segmentDragging,
    segmentSnapPoint,
    startScrub,
    startSegmentDrag,
    trackRef,
    trimDragState,
  } = useTrimTimelineInteractions({
    range,
    playheadMicros,
    frameRate,
    onChange,
    onMoveSegment,
    onTrimDragStart,
    onTrimDragEnd,
    onSegmentDragStart,
    onSegmentDragEnd,
    onSeek,
    onScrubStart,
    onScrub,
    onScrubEnd,
  });

  const minimumDurationMicros = minimumSelectionMicros(range.sourceDurationMicros);
  const playheadValue = clampPlaybackMicros(playheadMicros, range.sourceDurationMicros);
  const playheadPercent = timelinePercent(playheadValue, range.sourceDurationMicros);

  return (
    <section aria-labelledby="timeline-title" className="min-w-0 select-none">
      <TimelineHeader
        disabled={disabled}
        frameRate={frameRate}
        playbackControls={playbackControls}
        playbackTimecode={playbackTimecode}
        range={range}
      />
      <TimelineScale disabled={disabled} frameRate={frameRate} range={range} />
      <div
        className="grid min-w-0 grid-cols-(--editor-track-grid-columns) items-center gap-3"
        data-slot="timeline-row"
      >
        <div
          aria-label={t("timeline.toolsLabel")}
          className="flex w-full items-stretch"
          data-slot="timeline-toolbar"
          role="toolbar"
        >
          {videoToolbar}
        </div>
        <div
          aria-label={t("timeline.trackLabel")}
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
          {!disabled ? (
            <Playhead
              frameRate={frameRate}
              maximum={range.sourceDurationMicros}
              onKeyDown={handlePlayheadKeyboard}
              onLostPointerCapture={(event) => finishScrub(event, false)}
              onPointerCancel={(event) => finishScrub(event, false)}
              onPointerDown={(event) => startScrub(event, event.currentTarget)}
              onPointerMove={moveScrub}
              onPointerUp={(event) => finishScrub(event, true)}
              percent={playheadPercent}
              playheadRef={playheadRef}
              value={playheadValue}
            />
          ) : null}
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
      </div>
    </section>
  );
}

function TimelineHeader({
  disabled,
  frameRate,
  playbackControls,
  playbackTimecode,
  range,
}: Pick<
  TrimTimelineProps,
  "range" | "frameRate" | "disabled" | "playbackControls" | "playbackTimecode"
>) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6">
      <div className="min-w-0 justify-self-start">
        <h2
          className="mb-0.5 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
          id="timeline-title"
        >
          {t("timeline.selectedSegment")}
        </h2>
        {playbackTimecode}
      </div>
      <div className="justify-self-center">{playbackControls}</div>
      <dl aria-label={t("timeline.trimValues")} className="m-0 flex gap-5 justify-self-end">
        <TimelineTimeValue
          frameRate={frameRate}
          label={t("timeline.start")}
          micros={disabled ? null : range.startMicros}
        />
        <TimelineTimeValue
          frameRate={frameRate}
          label={t("timeline.end")}
          micros={disabled ? null : range.endMicros}
        />
        <TimelineTimeValue
          frameRate={frameRate}
          label={t("timeline.duration")}
          micros={disabled ? null : range.endMicros - range.startMicros}
        />
      </dl>
    </div>
  );
}

function TimelineScale({
  disabled,
  frameRate,
  range,
}: Pick<TrimTimelineProps, "range" | "frameRate" | "disabled">) {
  const { t } = useTranslation();
  return (
    <div
      aria-hidden="true"
      className="mt-3 mb-1 grid min-w-0 grid-cols-(--editor-track-grid-columns) items-end gap-3"
    >
      <span
        className="text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase"
        data-slot="timeline-tools-title"
      >
        {t("timeline.tools")}
      </span>
      <div className="flex justify-between font-mono text-[0.625rem] text-muted-foreground">
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <span key={fraction}>
            {disabled
              ? "00:00:00:00f"
              : formatPlaybackTime(Math.round(range.sourceDurationMicros * fraction), frameRate)}
          </span>
        ))}
      </div>
    </div>
  );
}
