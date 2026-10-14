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
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

import type { ApplicationShortcut } from "@/app/commands/core/application-command.types";
import { getShortcutAriaValue } from "@/app/commands/core/application-command.utils";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceLoadToken, selectSourceMedia } from "@/app/store/slices/source-slice";
import { usePlaybackActions, usePlaybackIsPlaying, useTimelinePlayback } from "@/features/playback";
import { cn } from "@/lib/class-names.utils";
import { useKeyboardShortcut } from "@/lib/hooks/useKeyboardShortcut";
import { isApplicationInteractionBlocked } from "@/lib/hotkeys.utils";

import { useTimelineTrimEditing } from "../hooks/useTimelineTrimEditing";
import { formatFrameTimecode } from "../lib/frame-time";

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

function TimelinePanel() {
  const { t } = useTranslation();
  const media = useAppSelector(selectSourceMedia);
  const loadToken = useAppSelector(selectSourceLoadToken);
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;
  const { currentFrame, framesCount, seekFrame } = useTimelinePlayback(frameRate);

  const trim = useTimelineTrimEditing(framesCount, frameRate);
  const length = trim.range.end - trim.range.start;
  const percent = (frame: number) => `${framesCount > 0 ? (frame / framesCount) * 100 : 0}%`;

  const isPlaying = usePlaybackIsPlaying();
  const { pause, togglePlayback } = usePlaybackActions();

  useKeyboardShortcut(
    (event) => {
      if (
        framesCount === 0 ||
        isApplicationInteractionBlocked() ||
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
      if (event.code === "Space") {
        togglePlayback();
        return;
      }

      pause();
      seekFrame(currentFrame + (event.key === "ArrowLeft" ? -1 : 1));
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
        !event.target.closest('[aria-labelledby="timeline-title"]')
      ) &&
      (event.code === "KeyI" || event.code === "KeyO"),
    (event) => trim.setBoundary(event.code === "KeyI" ? "start" : "end", currentFrame),
  );

  return (
    <section
      aria-labelledby="timeline-title"
      className="grid h-full min-w-0 grid-rows-[auto_minmax(2rem,1fr)] gap-4 p-3"
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <div className="min-w-0">
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
            {formatFrameTimecode(currentFrame, frameRate)}
            <span className="text-muted-foreground">
              {" / "}
              {formatFrameTimecode(framesCount, frameRate)}
            </span>
          </output>
        </div>

        <div
          aria-label={t("preview.accessibility.controls")}
          className="flex items-center justify-center gap-1.5"
        >
          <TimelineShortcutTooltip
            disabled={!trim.enabled || currentFrame >= framesCount}
            shortcut={SET_START_SHORTCUT}
            tooltip={t("preview.segment.setStart")}
          >
            <Button
              aria-keyshortcuts={getShortcutAriaValue(SET_START_SHORTCUT)}
              aria-label={t("preview.segment.setStart")}
              disabled={!trim.enabled || currentFrame >= framesCount}
              onClick={() => trim.setBoundary("start", currentFrame)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <SquareArrowRight aria-hidden="true" />
            </Button>
          </TimelineShortcutTooltip>
          <TimelineShortcutTooltip
            disabled={framesCount === 0}
            shortcut={PREVIOUS_FRAME_SHORTCUT}
            tooltip={t("preview.frame.previousFrameTooltip")}
          >
            <Button
              aria-keyshortcuts={getShortcutAriaValue(PREVIOUS_FRAME_SHORTCUT)}
              aria-label={t("preview.frame.previous")}
              disabled={framesCount === 0}
              onClick={() => {
                pause();
                seekFrame(currentFrame - 1);
              }}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <SkipBack aria-hidden="true" />
            </Button>
          </TimelineShortcutTooltip>
          <TimelineShortcutTooltip
            disabled={framesCount === 0}
            shortcut={PLAY_SHORTCUT}
            tooltip={
              isPlaying ? t("preview.playback.pauseTooltip") : t("preview.playback.playTooltip")
            }
          >
            <Button
              aria-keyshortcuts={getShortcutAriaValue(PLAY_SHORTCUT)}
              aria-label={isPlaying ? t("preview.playback.pause") : t("preview.playback.play")}
              className="rounded-full"
              disabled={framesCount === 0}
              onClick={togglePlayback}
              size="icon-lg"
              type="button"
            >
              {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </Button>
          </TimelineShortcutTooltip>
          <TimelineShortcutTooltip
            disabled={framesCount === 0}
            shortcut={NEXT_FRAME_SHORTCUT}
            tooltip={t("preview.frame.nextFrameTooltip")}
          >
            <Button
              aria-keyshortcuts={getShortcutAriaValue(NEXT_FRAME_SHORTCUT)}
              aria-label={t("preview.frame.next")}
              disabled={framesCount === 0}
              onClick={() => {
                pause();
                seekFrame(currentFrame + 1);
              }}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <SkipForward aria-hidden="true" />
            </Button>
          </TimelineShortcutTooltip>
          <TimelineShortcutTooltip
            disabled={!trim.enabled || currentFrame <= 0}
            shortcut={SET_END_SHORTCUT}
            tooltip={t("preview.segment.setEnd")}
          >
            <Button
              aria-keyshortcuts={getShortcutAriaValue(SET_END_SHORTCUT)}
              aria-label={t("preview.segment.setEnd")}
              disabled={!trim.enabled || currentFrame <= 0}
              onClick={() => trim.setBoundary("end", currentFrame)}
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
            frame={trim.range.start}
            frameRate={frameRate}
            label={t("timeline.segment.labels.start")}
          />
          <TimelineTimeValue
            frame={trim.range.end}
            frameRate={frameRate}
            label={t("timeline.segment.labels.end")}
          />
          <TimelineTimeValue
            frame={length}
            frameRate={frameRate}
            label={t("timeline.labels.duration")}
          />
        </dl>
      </div>

      <div className="grid h-17 min-w-0 grid-cols-(--editor-timeline-track-grid-columns) items-center gap-3">
        <div className="h-full min-w-0">
          <h3
            className="text-[0.625rem] font-bold tracking-wider text-muted-foreground uppercase"
            id="timeline-tools-title"
          >
            {t("timeline.labels.tools")}
          </h3>

          <TimelineToolbar />
        </div>

        <Slider.Group className="relative isolate mt-5 h-13" key={loadToken} sharedScale>
          <Slider.Root
            aria-label={t("timeline.accessibility.playheadPosition")}
            className="h-13"
            disabled={framesCount === 0}
            max={framesCount === 0 ? 1 : framesCount}
            min={0}
            onValueChange={([frame]) => seekFrame(frame ?? 0)}
            snap="shift"
            step={1}
            style={{ isolation: "auto" }}
            value={[currentFrame]}
          >
            <TimelineMarkers frameRate={frameRate} framesCount={framesCount} />
            <Slider.Track className="segment-markers h-13 rounded-md border bg-muted/30 text-muted" />
            {trim.enabled && (
              <div
                className="pointer-events-none absolute -inset-y-px mx-2 border-y-2 border-primary bg-primary/10"
                data-slot="timeline-selection"
                style={{
                  left: percent(trim.range.start),
                  right: percent(framesCount - trim.range.end),
                }}
              />
            )}
            <Slider.Preview
              disabled={framesCount === 0}
              label={(values) => formatFrameTimecode(values?.[0] ?? 0, frameRate)}
            >
              <Slider.Thumb
                aria-label={t("timeline.accessibility.playheadPosition")}
                className={cn(
                  "pointer-events-none h-13 w-0 before:absolute before:-inset-y-1 before:left-0 before:w-0.5 before:-translate-x-1/2 before:rounded-xs before:bg-white before:content-[''] after:-top-1 after:left-1/2 after:size-2 after:-translate-1/2 after:rounded-full after:bg-foreground after:content-[''] focus-visible:after:border-ring focus-visible:after:ring-3 focus-visible:after:ring-ring/50 data-snap-active:after:rounded-t-none",
                )}
              />
            </Slider.Preview>
          </Slider.Root>
          {trim.enabled && (
            <>
              {(["start", "end", "move"] as const).map((handle) => {
                const moving = handle === "move";
                // The knob is a timeline frame so it can snap exactly with whole-frame thumbs.
                const offset = moving ? Math.floor(length / 2) : 0;
                const minimum = handle === "end" ? trim.bounds.minEnd : offset;
                const maximum =
                  handle === "start"
                    ? trim.bounds.maxStart
                    : moving
                      ? trim.bounds.maxMove + offset
                      : framesCount;

                const value = handle === "end" ? trim.range.end : trim.range.start;
                const label = t(
                  moving
                    ? "timeline.segment.actions.moveSegment"
                    : handle === "start"
                      ? "timeline.segment.accessibility.trimStart"
                      : "timeline.segment.accessibility.trimEnd",
                );

                return (
                  <Slider.Root
                    className="pointer-events-none absolute top-0 h-13 w-auto"
                    data-trim-handle={handle}
                    disabled={maximum <= minimum}
                    key={handle}
                    max={maximum > minimum ? maximum : minimum + 1}
                    min={minimum}
                    onDoubleClick={() => {
                      if (!moving) trim.change(handle, handle === "start" ? 0 : framesCount);
                    }}
                    onLostPointerCapture={trim.finish}
                    onPointerCancelCapture={trim.finish}
                    onPointerDownCapture={(event) => {
                      if (maximum > minimum && event.button === 0 && event.isPrimary !== false)
                        trim.begin(handle);
                    }}
                    onValueChange={([frame]) =>
                      trim.change(handle, (frame ?? value + offset) - offset)
                    }
                    onValueCommit={trim.finish}
                    snap="shift"
                    snapTarget={moving ? !trim.dragging : trim.dragging !== "move"}
                    step={1}
                    style={{ left: percent(minimum), width: percent(maximum - minimum) }}
                    value={[value + offset]}
                  >
                    <Slider.Thumb
                      aria-label={label}
                      aria-valuetext={formatFrameTimecode(value, frameRate)}
                      className="group pointer-events-auto h-13 w-0 border-0 bg-transparent shadow-none hover:ring-0 focus-visible:ring-0 active:ring-0"
                    >
                      <span
                        className={
                          moving
                            ? "absolute top-1/2 left-0 flex size-7 -translate-1/2 cursor-grab items-center justify-center rounded-full bg-primary text-primary-foreground group-focus-visible:ring-3 group-focus-visible:ring-ring/50 group-data-snap-active:ring-3 hover:bg-primary/90 active:cursor-grabbing"
                            : `absolute -inset-y-1 left-0 flex w-4 -translate-x-1/2 cursor-ew-resize items-center justify-center rounded-xs bg-primary text-primary-foreground group-focus-visible:ring-3 group-focus-visible:ring-ring/50 group-data-snap-active:ring-3 hover:bg-primary/90 ${handle === "start" ? "rounded-l-md" : "rounded-r-md"}`
                        }
                      >
                        {moving ? (
                          <GripHorizontal aria-hidden="true" className="size-4" />
                        ) : (
                          <GripVertical aria-hidden="true" className="size-4" />
                        )}
                      </span>
                    </Slider.Thumb>
                  </Slider.Root>
                );
              })}
            </>
          )}
        </Slider.Group>
      </div>
    </section>
  );
}

function TimelineTimeValue({
  frame,
  frameRate,
  label,
}: {
  frame: number;
  frameRate?: { denominator: number; numerator: number };
  label: string;
}) {
  return (
    <div className="grid gap-px">
      <dt className="text-[0.625rem] font-bold tracking-wider text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="m-0 font-mono text-xs whitespace-nowrap tabular-nums">
        {formatFrameTimecode(frame, frameRate)}
      </dd>
    </div>
  );
}

export { TimelinePanel };
