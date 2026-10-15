import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { chapterUpdated, selectChapters } from "@/app/store/slices/chapters-slice";
import { selectFrameIndex, selectSourceMedia } from "@/app/store/slices/source-slice";

import { useChapterEditing } from "../contexts/chapter-editing-context";
import { ChapterDialog } from "../dialogs/ChapterDialog";
import { useTimelineRangeEditing } from "../hooks/useTimelineRangeEditing";
import { formatTimecode } from "../lib/timecode";

import { percentOf, Timeline } from "./Timeline";

/** Snap target name of the edited chapter's committed boundaries, which its parts never snap to. */
const EDITED_CHAPTER_SNAP_KEY = "edited-chapter";
const SNAP_EXCLUDE = [EDITED_CHAPTER_SNAP_KEY] as const;

const HANDLE_CLASS_NAME = "group top-0 bottom-auto z-30 h-3.5";
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
        className={HANDLE_CLASS_NAME}
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
          className={`absolute inset-0 flex cursor-grab items-center overflow-hidden rounded-xs border border-primary bg-primary/35 px-1.5 text-[0.5625rem] leading-none font-medium text-foreground shadow-sm active:cursor-grabbing ${FOCUS_CLASS_NAME}`}
        >
          <span className="truncate">{chapter.title}</span>
        </span>
      </Timeline.Handle>
      <Timeline.Handle
        aria-label={t("timeline.chapters.accessibility.chapterStart", { title: chapter.title })}
        className={HANDLE_CLASS_NAME}
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
        <ChapterEdgeGrip />
      </Timeline.Handle>
      <Timeline.Handle
        aria-label={t("timeline.chapters.accessibility.chapterEnd", { title: chapter.title })}
        className={HANDLE_CLASS_NAME}
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
        <ChapterEdgeGrip />
      </Timeline.Handle>
    </>
  );
}

function ChapterEdgeGrip() {
  return (
    <span
      className={`absolute inset-y-0 left-0 w-2 -translate-x-1/2 cursor-ew-resize rounded-xs bg-primary shadow-sm hover:bg-primary/90 ${FOCUS_CLASS_NAME}`}
    />
  );
}

export { EDITED_CHAPTER_SNAP_KEY, TimelineChapterEditor };
