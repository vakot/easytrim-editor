import { useTranslation } from "react-i18next";

import { clampPlaybackMicros, formatPlaybackTime } from "@/domain/playback";
import { minimumSelectionMicros, timelinePercent } from "@/domain/trim";

import { SegmentDragHandle, Playhead, TrimHandle } from "./components/TimelineHandles";
import { TimelineTimeValue } from "./components/TimelineTimeValue";
import { useTrimTimelineInteractions } from "./hooks/useTrimTimelineInteractions";
import styles from "./components/styles.module.css";
import type { TrimTimelineProps } from "./types";

export function TrimTimeline({
  range,
  playheadMicros,
  playheadRef,
  frameRate,
  playbackControls,
  playbackTimecode,
  videoToolbar,
  onChange,
  onMoveSegment,
  onTrimDragEnd,
  onSegmentDragStart,
  onSegmentDragEnd,
  onSeek,
  onScrubStart,
  onScrub,
  onScrubEnd,
}: TrimTimelineProps) {
  const { t } = useTranslation();
  const {
    trackRef,
    segmentDragging,
    segmentSnapPoint,
    trimDragState,
    handleTrimPointer,
    finishTrimDrag,
    handleTrimKeyboard,
    resetBoundary,
    startSegmentDrag,
    moveSegmentDrag,
    finishSegmentDrag,
    handleSegmentKeyboard,
    startScrub,
    moveScrub,
    finishScrub,
    handlePlayheadKeyboard,
  } = useTrimTimelineInteractions({
    range,
    playheadMicros,
    frameRate,
    onChange,
    onMoveSegment,
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
    <section
      className="min-w-0 select-none bg-background px-5 pt-4 pb-2"
      aria-labelledby="timeline-title"
    >
      <TimelineHeader
        range={range}
        frameRate={frameRate}
        playbackControls={playbackControls}
        playbackTimecode={playbackTimecode}
      />
      <TimelineScale range={range} frameRate={frameRate} />
      <div
        className="mb-2 grid min-w-0 grid-cols-[var(--editor-track-grid-columns)] items-center gap-3"
        data-slot="timeline-row"
      >
        <div
          className="grid w-full grid-flow-col auto-cols-[1.75rem] grid-rows-[repeat(2,1.75rem)] items-center justify-start gap-1"
          data-slot="timeline-toolbar"
          role="toolbar"
          aria-label={t("timeline.toolsLabel")}
        >
          {videoToolbar}
        </div>
        <div
          ref={trackRef}
          className={styles.track}
          aria-label={t("timeline.trackLabel")}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              startScrub(event, event.currentTarget);
            }
          }}
          onPointerMove={moveScrub}
          onPointerUp={(event) => finishScrub(event, true)}
          onPointerCancel={(event) => finishScrub(event, false)}
          onLostPointerCapture={(event) => finishScrub(event, false)}
        >
          <div
            className={styles.selection}
            style={{
              left: "var(--timeline-trim-start)",
              right: "var(--timeline-trim-end-inset)",
            }}
          />
          <SegmentDragHandle
            range={range}
            dragging={segmentDragging}
            snapPoint={segmentSnapPoint}
            onPointerDown={startSegmentDrag}
            onPointerMove={moveSegmentDrag}
            onPointerUp={(event) => finishSegmentDrag(event, true)}
            onPointerCancel={(event) => finishSegmentDrag(event, false)}
            onLostPointerCapture={(event) => finishSegmentDrag(event, false)}
            onKeyDown={handleSegmentKeyboard}
          />
          <Playhead
            playheadRef={playheadRef}
            percent={playheadPercent}
            value={playheadValue}
            maximum={range.sourceDurationMicros}
            frameRate={frameRate}
            onPointerDown={(event) => startScrub(event, event.currentTarget)}
            onPointerMove={moveScrub}
            onPointerUp={(event) => finishScrub(event, true)}
            onPointerCancel={(event) => finishScrub(event, false)}
            onLostPointerCapture={(event) => finishScrub(event, false)}
            onKeyDown={handlePlayheadKeyboard}
          />
          <TrimHandle
            boundary="start"
            value={range.startMicros}
            minimum={0}
            maximum={range.endMicros - minimumDurationMicros}
            dragging={trimDragState?.boundary === "start"}
            snapActive={trimDragState?.boundary === "start" && trimDragState.snapActive}
            onPointerDown={(event) => handleTrimPointer("start", event, true)}
            onPointerMove={(event) => handleTrimPointer("start", event, false)}
            onPointerEnd={() => finishTrimDrag("start")}
            onDoubleClick={() => resetBoundary("start")}
            onKeyDown={(event) => handleTrimKeyboard("start", event)}
          />
          <TrimHandle
            boundary="end"
            value={range.endMicros}
            minimum={range.startMicros + minimumDurationMicros}
            maximum={range.sourceDurationMicros}
            dragging={trimDragState?.boundary === "end"}
            snapActive={trimDragState?.boundary === "end" && trimDragState.snapActive}
            onPointerDown={(event) => handleTrimPointer("end", event, true)}
            onPointerMove={(event) => handleTrimPointer("end", event, false)}
            onPointerEnd={() => finishTrimDrag("end")}
            onDoubleClick={() => resetBoundary("end")}
            onKeyDown={(event) => handleTrimKeyboard("end", event)}
          />
        </div>
      </div>
    </section>
  );
}

function TimelineHeader({
  range,
  frameRate,
  playbackControls,
  playbackTimecode,
}: Pick<TrimTimelineProps, "range" | "frameRate" | "playbackControls" | "playbackTimecode">) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6">
      <div className="min-w-0 justify-self-start">
        <h2
          id="timeline-title"
          className="mb-0.5 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
        >
          {t("timeline.selectedSegment")}
        </h2>
        {playbackTimecode}
      </div>
      <div className="justify-self-center">{playbackControls}</div>
      <dl className="m-0 flex justify-self-end gap-5" aria-label={t("timeline.trimValues")}>
        <TimelineTimeValue
          label={t("timeline.start")}
          micros={range.startMicros}
          frameRate={frameRate}
        />
        <TimelineTimeValue
          label={t("timeline.end")}
          micros={range.endMicros}
          frameRate={frameRate}
        />
        <TimelineTimeValue
          label={t("timeline.duration")}
          micros={range.endMicros - range.startMicros}
          frameRate={frameRate}
        />
      </dl>
    </div>
  );
}

function TimelineScale({ range, frameRate }: Pick<TrimTimelineProps, "range" | "frameRate">) {
  const { t } = useTranslation();
  return (
    <div
      className="mt-3 mb-1 grid min-w-0 grid-cols-[var(--editor-track-grid-columns)] items-end gap-3"
      aria-hidden="true"
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
            {formatPlaybackTime(Math.round(range.sourceDurationMicros * fraction), frameRate)}
          </span>
        ))}
      </div>
    </div>
  );
}
