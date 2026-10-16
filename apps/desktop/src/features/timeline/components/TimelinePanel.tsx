import {
  GripHorizontal,
  GripVertical,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SquareArrowLeft,
  SquareArrowRight,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import type { ApplicationShortcut } from "@/app/commands/core/application-command.types";
import { getShortcutAriaValue } from "@/app/commands/core/application-command.utils";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectVisibleAudioActivityMarkers } from "@/app/store/slices/audio-slice";
import { selectChapters } from "@/app/store/slices/chapters-slice";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectVisibleSceneBoundariesMicros } from "@/app/store/slices/scene-detection-slice";
import { selectSourceLoadToken, selectSourceMedia } from "@/app/store/slices/source-slice";
import type { FrameRate } from "@/domain/media";
import {
  type PlaybackHoldRelease,
  usePlaybackActions,
  usePlaybackIsPlaying,
  usePlaybackPosition,
  useTimelinePlayback,
} from "@/features/playback";
import { cn } from "@/lib/class-names.utils";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { isApplicationInteractionBlocked, isPlaybackShortcutBlocked } from "@/lib/hotkeys.utils";

import {
  type ChapterEditing,
  ChapterEditingContext,
  useChapterEditing,
} from "../contexts/chapter-editing-context";
import { usePublishTimelineSelection } from "../contexts/timeline-axis-context";
import { ChapterDialog } from "../dialogs/ChapterDialog";
import { useTimelineTrimEditing } from "../hooks/useTimelineTrimEditing";
import { formatTimecode } from "../lib/timecode";

import { PlaybackSpeedControl } from "./PlaybackSpeedControl";
import { PlaybackVolumeControl } from "./PlaybackVolumeControl";
import { percentOf, Timeline, type TimelineSnapTarget } from "./Timeline";
import { EDITED_CHAPTER_SNAP_KEY } from "./TimelineChapterEditor";
import { TimelineMarkers } from "./TimelineMarkers";
import { TimelineShortcutTooltip } from "./TimelineShortcutTooltip";
import { TimelineToolbar } from "./TimelineToolbar";

const SET_START_SHORTCUT = {
  code: "KeyI",
  key: "I",
  modifier: "none",
} as const satisfies ApplicationShortcut;

const SET_END_SHORTCUT = {
  code: "KeyO",
  key: "O",
  modifier: "none",
} as const satisfies ApplicationShortcut;

const PREVIOUS_FRAME_SHORTCUT = {
  code: "ArrowLeft",
  key: "ArrowLeft",
  modifier: "none",
} as const satisfies ApplicationShortcut;

const NEXT_FRAME_SHORTCUT = {
  code: "ArrowRight",
  key: "ArrowRight",
  modifier: "none",
} as const satisfies ApplicationShortcut;

const PLAY_SHORTCUT = {
  code: "Space",
  key: "Space",
  modifier: "none",
} as const satisfies ApplicationShortcut;

/** The timeline panel, with the chapter whose position the timeline edits, if any. */
function TimelinePanel() {
  const chapters = useAppSelector(selectChapters);
  const instanceId = useAppSelector(selectActiveInstanceId);
  const loadToken = useAppSelector(selectSourceLoadToken);
  // The edited chapter never outlives its source or itself.
  const [editedChapter, setEditedChapter] = useState<{
    chapterId: string;
    instanceId: string | null;
    loadToken: number;
  } | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const editedChapterId =
    editedChapter?.instanceId === instanceId &&
    editedChapter.loadToken === loadToken &&
    chapters.some(({ id }) => id === editedChapter.chapterId)
      ? editedChapter.chapterId
      : null;

  const chapterEditing = useMemo<ChapterEditing>(
    () => ({
      chapterId: editedChapterId,
      edit: (chapterId) => {
        setEditedChapter(chapterId === null ? null : { chapterId, instanceId, loadToken });
        setDialogOpen(false);
      },
      openDialog: () => setDialogOpen(true),
    }),
    [editedChapterId, instanceId, loadToken],
  );

  useKeyboardShortcut(
    (event) =>
      editedChapterId !== null &&
      event.key === "Escape" &&
      !isApplicationInteractionBlocked() &&
      !document.querySelector("[data-sidebar-drag-preview]"),
    () => chapterEditing.edit(null),
  );

  return (
    <ChapterEditingContext.Provider value={chapterEditing}>
      <TimelinePanelContent />
      {editedChapterId ? (
        <ChapterDialog chapterId={editedChapterId} onOpenChange={setDialogOpen} open={dialogOpen} />
      ) : null}
    </ChapterEditingContext.Provider>
  );
}

function TimelinePanelContent() {
  const { t } = useTranslation();
  const media = useAppSelector(selectSourceMedia);
  const loadToken = useAppSelector(selectSourceLoadToken);
  const scenes = useAppSelector(selectVisibleSceneBoundariesMicros);
  const audioActivityMarkers = useAppSelector(selectVisibleAudioActivityMarkers);
  const chapters = useAppSelector(selectChapters);
  const editedChapterId = useChapterEditing().chapterId;
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;
  const { durationMicros, framesCount, getPositionMicros, seekTime, stepFrame } =
    useTimelinePlayback();

  const trim = useTimelineTrimEditing();
  const isPlaying = usePlaybackIsPlaying();
  const { holdPlayback, togglePlayback } = usePlaybackActions();
  const [scrubbing, setScrubbing] = useState(false);
  // Playback stays blocked while the playhead is scrubbed and resumes afterwards if it was running.
  const releaseScrubPlayback = useRef<PlaybackHoldRelease | null>(null);
  useEffect(
    () => () => {
      // The timeline remounts for a new source without ending the scrub; abandon its hold.
      releaseScrubPlayback.current?.({ resume: false });
      releaseScrubPlayback.current = null;
    },
    [loadToken],
  );
  const timecode = (micros: number) => formatTimecode(micros, frameRate);
  const readout = usePlaybackPosition((position) => formatTimecode(position, frameRate));
  const atStart = usePlaybackPosition((position) => position <= 0);
  const atEnd = usePlaybackPosition((position) => position >= durationMicros);
  const empty = framesCount === 0;
  // Without an editable segment the trim parts still show, disabled, selecting the whole timeline.
  // An empty timeline gets a nominal axis so they sit at its opposite ends.
  const axisMicros = Math.max(durationMicros, 1);
  const selection = trim.enabled
    ? { endMicros: trim.endMicros, startMicros: trim.startMicros }
    : { endMicros: axisMicros, startMicros: 0 };

  const publishSelection = usePublishTimelineSelection();
  const selectionStartPercent = percentOf(selection.startMicros, axisMicros);
  const selectionEndPercent = percentOf(selection.endMicros, axisMicros);
  // Views aligned with the timeline follow the drawn selection, including an uncommitted drag.
  useLayoutEffect(() => {
    publishSelection?.(selectionStartPercent, selectionEndPercent);
  }, [publishSelection, selectionEndPercent, selectionStartPercent]);

  const snapTargets = (): TimelineSnapTarget[] => [
    { key: "timeline-start", micros: 0 },
    { key: "timeline-end", micros: durationMicros },
    { key: "playhead", micros: getPositionMicros() },
    ...scenes.map((micros) => ({ key: "scene", micros })),
    ...audioActivityMarkers.map(({ micros }) => ({ key: "audio-activity", micros })),
    ...chapters.flatMap((chapter) => {
      const key = chapter.id === editedChapterId ? EDITED_CHAPTER_SNAP_KEY : "chapter";
      return [
        { key, micros: chapter.startMicros },
        { key, micros: chapter.endMicros },
      ];
    }),
    // The trim handles are hidden while a chapter is edited, and so are their snap targets.
    ...(trim.enabled && !editedChapterId
      ? [
          { key: "trim-start", micros: trim.startMicros },
          { key: "trim-end", micros: trim.endMicros },
          { key: "trim-move", micros: Math.round((trim.startMicros + trim.endMicros) / 2) },
        ]
      : []),
  ];

  useKeyboardShortcut(
    (event) => {
      if (
        empty ||
        isPlaybackShortcutBlocked(event.target) ||
        document.querySelector("[data-sidebar-drag-preview]") ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        (event.key !== " " &&
          event.target instanceof Element &&
          !!event.target.closest('[role="slider"]'))
      ) {
        return false;
      }

      return (
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        (event.code === "Space" && !event.repeat)
      );
    },
    (event) => {
      if (event.code === "Space") togglePlayback();
      else stepFrame(event.key === "ArrowLeft" ? -1 : 1);
    },
  );

  useKeyboardShortcut(
    (event) =>
      trim.enabled &&
      !trim.dragging &&
      !event.repeat &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !isApplicationInteractionBlocked() &&
      !document.querySelector("[data-sidebar-drag-preview]") &&
      !(
        event.target instanceof Element &&
        event.target.closest('[role="slider"]') &&
        !event.target.closest('[data-slot="timeline-playhead"]')
      ) &&
      (event.code === "KeyI" || event.code === "KeyO"),
    (event) => trim.mark(event.code === "KeyI" ? "start" : "end", getPositionMicros()),
  );

  return (
    <section
      aria-labelledby="timeline-title"
      className="grid min-w-0 shrink-0 grid-rows-[auto_minmax(2rem,1fr)] gap-3 p-3"
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-(--editor-track-controls-width) min-w-0">
            <h2
              className="font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
              id="timeline-title"
            >
              {t("timeline.segment.labels.selectedSegment")}
            </h2>
            <output
              aria-label={t("preview.accessibility.currentTime")}
              className="font-mono text-xs text-foreground tabular-nums"
            >
              {readout}
              <span className="text-muted-foreground">
                {" / "}
                {timecode(durationMicros)}
              </span>
            </output>
          </div>

          <div className="flex gap-1">
            <PlaybackSpeedControl />
            <PlaybackVolumeControl />
          </div>
        </div>

        <div
          aria-label={t("preview.accessibility.controls")}
          className="flex items-center justify-center gap-1.5"
        >
          <TimelineShortcutTooltip
            disabled={!trim.enabled}
            shortcut={SET_START_SHORTCUT}
            tooltip={t("preview.segment.setStart")}
          >
            <Button
              aria-keyshortcuts={getShortcutAriaValue(SET_START_SHORTCUT)}
              aria-label={t("preview.segment.setStart")}
              disabled={!trim.enabled}
              onClick={() => trim.mark("start", getPositionMicros())}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <SquareArrowRight aria-hidden="true" />
            </Button>
          </TimelineShortcutTooltip>
          <TimelineShortcutTooltip
            disabled={empty || atStart}
            shortcut={PREVIOUS_FRAME_SHORTCUT}
            tooltip={t("preview.frame.previousFrameTooltip")}
          >
            <Button
              aria-keyshortcuts={getShortcutAriaValue(PREVIOUS_FRAME_SHORTCUT)}
              aria-label={t("preview.frame.previous")}
              disabled={empty || atStart}
              onClick={() => stepFrame(-1)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <SkipBack aria-hidden="true" />
            </Button>
          </TimelineShortcutTooltip>
          <TimelineShortcutTooltip
            disabled={empty}
            shortcut={PLAY_SHORTCUT}
            tooltip={
              isPlaying ? t("preview.playback.pauseTooltip") : t("preview.playback.playTooltip")
            }
          >
            <Button
              aria-keyshortcuts={getShortcutAriaValue(PLAY_SHORTCUT)}
              aria-label={isPlaying ? t("preview.playback.pause") : t("preview.playback.play")}
              className="rounded-full"
              disabled={empty}
              onClick={togglePlayback}
              size="icon-lg"
              type="button"
            >
              {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </Button>
          </TimelineShortcutTooltip>
          <TimelineShortcutTooltip
            disabled={empty || atEnd}
            shortcut={NEXT_FRAME_SHORTCUT}
            tooltip={t("preview.frame.nextFrameTooltip")}
          >
            <Button
              aria-keyshortcuts={getShortcutAriaValue(NEXT_FRAME_SHORTCUT)}
              aria-label={t("preview.frame.next")}
              disabled={empty || atEnd}
              onClick={() => stepFrame(1)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <SkipForward aria-hidden="true" />
            </Button>
          </TimelineShortcutTooltip>
          <TimelineShortcutTooltip
            disabled={!trim.enabled}
            shortcut={SET_END_SHORTCUT}
            tooltip={t("preview.segment.setEnd")}
          >
            <Button
              aria-keyshortcuts={getShortcutAriaValue(SET_END_SHORTCUT)}
              aria-label={t("preview.segment.setEnd")}
              disabled={!trim.enabled}
              onClick={() => trim.mark("end", getPositionMicros())}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <SquareArrowLeft aria-hidden="true" />
            </Button>
          </TimelineShortcutTooltip>
        </div>

        <dl
          aria-label={t("timeline.segment.accessibility.trimValues")}
          className="m-0 flex min-w-0 gap-5 justify-self-end"
        >
          <TimelineTimeValue
            label={t("timeline.segment.labels.start")}
            value={timecode(trim.startMicros)}
          />
          <TimelineTimeValue
            label={t("timeline.segment.labels.end")}
            value={timecode(trim.endMicros)}
          />
          <TimelineTimeValue
            label={t("timeline.labels.duration")}
            value={timecode(trim.endMicros - trim.startMicros)}
          />
        </dl>
      </div>

      <div className="grid h-19 min-w-0 grid-cols-(--editor-timeline-track-grid-columns) items-center gap-3">
        <div className="grid h-full min-w-0 gap-1">
          <h3
            className="h-3 text-[0.625rem] font-bold tracking-wider text-muted-foreground uppercase"
            id="timeline-tools-title"
          >
            {t("timeline.labels.tools")}
          </h3>

          <TimelineToolbar />
        </div>

        <Timeline.Root
          aria-label={t("timeline.accessibility.playheadPosition")}
          className="mt-5 mb-1 h-13 data-disabled:opacity-50"
          disabled={empty}
          durationMicros={axisMicros}
          key={loadToken}
          onScrub={seekTime}
          onScrubEnd={() => {
            releaseScrubPlayback.current?.();
            releaseScrubPlayback.current = null;
            setScrubbing(false);
          }}
          onScrubStart={() => {
            releaseScrubPlayback.current?.({ resume: false });
            releaseScrubPlayback.current = holdPlayback();
            setScrubbing(true);
          }}
          snapTargets={snapTargets}
        >
          <Timeline.Track className="segment-markers rounded-md border bg-muted/30 text-muted" />
          <TimelineMarkers frameRate={frameRate} />
          <Timeline.Range
            className={cn(
              "-inset-y-px mx-2 border-y-2 border-primary bg-primary/10",
              editedChapterId && "invisible",
            )}
            data-slot="timeline-selection"
            endMicros={selection.endMicros}
            startMicros={selection.startMicros}
          />
          <TimelinePlayhead disabled={empty} frameRate={frameRate} showValue={scrubbing} />
          <TimelineTrimHandles frameRate={frameRate} selection={selection} trim={trim} />
        </Timeline.Root>
      </div>
    </section>
  );
}

/** The playhead follows the media clock while playing and rests on frame boundaries otherwise. */
function TimelinePlayhead({
  disabled,
  frameRate,
  showValue,
}: {
  disabled: boolean;
  frameRate?: FrameRate;
  showValue: boolean;
}) {
  const { t } = useTranslation();
  const position = usePlaybackPosition((micros) => micros);
  const { durationMicros, seekTime, stepFrame } = useTimelinePlayback();

  return (
    <Timeline.Handle
      aria-label={t("timeline.accessibility.playheadPosition")}
      className="group pointer-events-none z-10"
      data-slot="timeline-playhead"
      disabled={disabled}
      micros={position}
      onEnd={() => seekTime(durationMicros)}
      onHome={() => seekTime(0)}
      onStep={stepFrame}
      scrubbed
      showValue={showValue}
      valueText={formatTimecode(position, frameRate)}
    >
      <span className="absolute -inset-y-1 left-0 w-0.5 -translate-x-1/2 rounded-xs bg-white group-focus-visible:ring-3 group-focus-visible:ring-ring/50" />
      <span className="absolute -top-1 left-0 size-2 -translate-1/2 rounded-full bg-foreground group-focus-visible:ring-3 group-focus-visible:ring-ring/50 group-data-snap-active:rounded-t-none" />
    </Timeline.Handle>
  );
}

/**
 * The trim selection's boundaries and its move knob. They give way to the chapter editor: while a
 * chapter is edited they are hidden and disabled.
 */
function TimelineTrimHandles({
  frameRate,
  selection,
  trim,
}: {
  frameRate?: FrameRate;
  selection: { endMicros: number; startMicros: number };
  trim: ReturnType<typeof useTimelineTrimEditing>;
}) {
  const { t } = useTranslation();
  const { durationMicros } = useTimelinePlayback();
  const editingChapter = useChapterEditing().chapterId !== null;
  // Half the selection length when its move started: the knob sits at its center.
  const moveHalfLength = useRef(0);

  const timecode = (micros: number) => formatTimecode(micros, frameRate);
  const disabled = !trim.enabled || editingChapter;
  const className = cn("group z-20", editingChapter && "invisible");
  // Unrounded without a segment: the nominal axis may be a single microsecond.
  const selectionCenterMicros = trim.enabled
    ? Math.round((trim.startMicros + trim.endMicros) / 2)
    : (selection.startMicros + selection.endMicros) / 2;

  return (
    <>
      <Timeline.Handle
        aria-label={t("timeline.segment.accessibility.trimStart")}
        className={className}
        data-trim-handle="start"
        disabled={disabled}
        maxMicros={trim.maxStartMicros}
        micros={selection.startMicros}
        onDoubleClick={() => trim.change("start", 0)}
        onDrag={(micros) => trim.change("start", micros)}
        onDragEnd={trim.finish}
        onDragStart={() => trim.begin("start")}
        onEnd={() => trim.change("start", trim.maxStartMicros)}
        onHome={() => trim.change("start", 0)}
        onStep={(direction) => trim.step("start", direction)}
        snapExclude={["trim-start", "trim-move"]}
        valueText={timecode(trim.startMicros)}
      >
        <TrimGrip edge="start" />
      </Timeline.Handle>
      <Timeline.Handle
        aria-label={t("timeline.segment.accessibility.trimEnd")}
        className={className}
        data-trim-handle="end"
        disabled={disabled}
        micros={selection.endMicros}
        minMicros={trim.minEndMicros}
        onDoubleClick={() => trim.change("end", durationMicros)}
        onDrag={(micros) => trim.change("end", micros)}
        onDragEnd={trim.finish}
        onDragStart={() => trim.begin("end")}
        onEnd={() => trim.change("end", durationMicros)}
        onHome={() => trim.change("end", trim.minEndMicros)}
        onStep={(direction) => trim.step("end", direction)}
        snapExclude={["trim-end", "trim-move"]}
        valueText={timecode(trim.endMicros)}
      >
        <TrimGrip edge="end" />
      </Timeline.Handle>
      <Timeline.Handle
        aria-label={t("timeline.segment.actions.moveSegment")}
        className={className}
        data-trim-handle="move"
        disabled={disabled}
        micros={selectionCenterMicros}
        onDrag={(center) => trim.change("move", center - moveHalfLength.current)}
        onDragEnd={trim.finish}
        onDragStart={() => {
          moveHalfLength.current = (trim.endMicros - trim.startMicros) / 2;
          trim.begin("move");
        }}
        onEnd={() => trim.change("move", durationMicros)}
        onHome={() => trim.change("move", 0)}
        onStep={(direction) => trim.step("move", direction)}
        snapExclude={["trim-start", "trim-end", "trim-move"]}
        valueText={`${timecode(trim.startMicros)} – ${timecode(trim.endMicros)}`}
      >
        <span className="absolute top-1/2 left-0 flex size-7 -translate-1/2 cursor-grab items-center justify-center rounded-full bg-primary text-primary-foreground group-focus-visible:ring-3 group-focus-visible:ring-ring/50 group-aria-disabled:cursor-default group-data-snap-active:ring-3 hover:bg-primary/90 group-aria-disabled:hover:bg-primary active:cursor-grabbing">
          <GripHorizontal aria-hidden="true" className="size-4" />
        </span>
      </Timeline.Handle>
    </>
  );
}

function TrimGrip({ edge }: { edge: "start" | "end" }) {
  return (
    <span
      className={`absolute -inset-y-1 left-0 flex w-4 -translate-x-1/2 cursor-ew-resize items-center justify-center rounded-xs bg-primary text-primary-foreground group-focus-visible:ring-3 group-focus-visible:ring-ring/50 group-aria-disabled:cursor-default group-data-snap-active:ring-3 hover:bg-primary/90 group-aria-disabled:hover:bg-primary ${edge === "start" ? "rounded-l-md" : "rounded-r-md"}`}
    >
      <GripVertical aria-hidden="true" className="size-4" />
    </span>
  );
}

function TimelineTimeValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-px">
      <dt className="text-[0.625rem] font-bold tracking-wider text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="m-0 font-mono text-xs whitespace-nowrap tabular-nums">{value}</dd>
    </div>
  );
}

export { TimelinePanel };
