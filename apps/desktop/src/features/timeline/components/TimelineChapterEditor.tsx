import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { chapterUpdated, selectChapters } from "@/app/store/slices/chapters-slice";
import { selectFrameIndex, selectSourceMedia } from "@/app/store/slices/source-slice";
import { cn } from "@/lib/class-names.utils";

import { useChapterEditing } from "../contexts/chapter-editing-context";
import { ChapterDialog } from "../dialogs/ChapterDialog";
import { useTimelineRangeEditing } from "../hooks/useTimelineRangeEditing";
import { formatTimecode } from "../lib/timecode";

import { percentOf, Timeline } from "./Timeline";

/** Snap target name of the edited chapter's committed boundaries, which its parts never snap to. */
const EDITED_CHAPTER_SNAP_KEY = "edited-chapter";
const SNAP_EXCLUDE = [EDITED_CHAPTER_SNAP_KEY] as const;

const HANDLE_CLASS_NAME = "group top-0 bottom-auto z-30 h-3.5";
// The grips light up with the bar between them, which they are siblings of.
const GRIP_HANDLE_CLASS_NAME = cn(
  HANDLE_CLASS_NAME,
  "peer-focus-visible/move:*:ring-3 peer-focus-visible/move:*:ring-ring/50",
);

const FOCUS_CLASS_NAME =
  "group-focus-visible:ring-3 group-focus-visible:ring-ring/50 group-data-snap-active:ring-3";

/**
 * A compact editor for the position of the edited chapter, drawn along the top of the timeline:
 * its bar moves the chapter and its edges resize it, frame by frame like the trim selection. The
 * name is edited in the chapter dialog, opened by a double click or Enter on the bar.
 */
function TimelineChapterEditor({ chapterId }: { chapterId: string }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const chapter = useAppSelector(selectChapters).find(({ id }) => id === chapterId);
  const index = useAppSelector(selectFrameIndex);
  const media = useAppSelector(selectSourceMedia);
  const { openDialog } = useChapterEditing();
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;
  const durationMicros = index.endMicros;

  const range = useTimelineRangeEditing(
    chapter
      ? {
          endMicros: chapter.endMicros,
          sourceDurationMicros: durationMicros,
          startMicros: chapter.startMicros,
        }
      : null,
    ({ endMicros, startMicros }) => {
      if (chapter) dispatch(chapterUpdated({ ...chapter, endMicros, startMicros }));
    },
    "Adjust chapter",
  );

  if (!chapter || !range.enabled) return null;

  const timecode = (micros: number) => formatTimecode(micros, frameRate);
  const lengthMicros = range.endMicros - range.startMicros;
  const widthPercent =
    percentOf(range.endMicros, durationMicros) - percentOf(range.startMicros, durationMicros);

  return (
    <>
      <Timeline.Handle
        aria-keyshortcuts="Enter"
        aria-label={t("timeline.chapters.accessibility.moveChapter", { title: chapter.title })}
        className={cn(HANDLE_CLASS_NAME, "peer/move")}
        data-chapter-handle="move"
        maxMicros={durationMicros - lengthMicros}
        micros={range.startMicros}
        onDoubleClick={openDialog}
        onDrag={(micros) => range.change("move", micros)}
        onDragEnd={range.finish}
        onDragStart={() => range.begin("move")}
        onEnd={() => range.change("move", durationMicros)}
        onFocus={ChapterDialog.preload}
        onHome={() => range.change("move", 0)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.repeat) return;
          event.preventDefault();
          openDialog();
        }}
        onPointerEnter={ChapterDialog.preload}
        onStep={(direction) => range.step("move", direction)}
        snapExclude={SNAP_EXCLUDE}
        style={{ width: `${widthPercent}%` }}
        valueText={`${timecode(range.startMicros)} – ${timecode(range.endMicros)}`}
      >
        <span
          className={cn(
            "absolute inset-0 mx-1 flex cursor-grab items-center overflow-hidden border-y border-primary bg-primary/35 shadow-sm active:cursor-grabbing",
            FOCUS_CLASS_NAME,
          )}
        >
          <span className="mx-1 truncate text-[0.5625rem] leading-none font-medium text-foreground">
            {chapter.title}
          </span>
        </span>
      </Timeline.Handle>
      <Timeline.Handle
        aria-label={t("timeline.chapters.accessibility.chapterStart", { title: chapter.title })}
        className={GRIP_HANDLE_CLASS_NAME}
        data-chapter-handle="start"
        maxMicros={range.maxStartMicros}
        micros={range.startMicros}
        onDrag={(micros) => range.change("start", micros)}
        onDragEnd={range.finish}
        onDragStart={() => range.begin("start")}
        onEnd={() => range.change("start", range.maxStartMicros)}
        onHome={() => range.change("start", 0)}
        onStep={(direction) => range.step("start", direction)}
        snapExclude={SNAP_EXCLUDE}
        valueText={timecode(range.startMicros)}
      >
        <ChapterEdgeGrip className="rounded-l-xs" />
      </Timeline.Handle>
      <Timeline.Handle
        aria-label={t("timeline.chapters.accessibility.chapterEnd", { title: chapter.title })}
        className={GRIP_HANDLE_CLASS_NAME}
        data-chapter-handle="end"
        micros={range.endMicros}
        minMicros={range.minEndMicros}
        onDrag={(micros) => range.change("end", micros)}
        onDragEnd={range.finish}
        onDragStart={() => range.begin("end")}
        onEnd={() => range.change("end", durationMicros)}
        onHome={() => range.change("end", range.minEndMicros)}
        onStep={(direction) => range.step("end", direction)}
        snapExclude={SNAP_EXCLUDE}
        valueText={timecode(range.endMicros)}
      >
        <ChapterEdgeGrip className="rounded-r-xs" />
      </Timeline.Handle>
    </>
  );
}

function ChapterEdgeGrip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "absolute inset-y-0 left-0 w-2 -translate-x-1/2 cursor-ew-resize bg-primary shadow-sm after:absolute after:top-1/2 after:left-1/2 after:h-2 after:w-px after:-translate-1/2 after:rounded-full after:bg-muted after:content-[''] hover:bg-primary/90",
        FOCUS_CLASS_NAME,
        className,
      )}
    />
  );
}

export { EDITED_CHAPTER_SNAP_KEY, TimelineChapterEditor };
