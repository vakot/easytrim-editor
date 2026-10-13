import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import {
  microsToFrame,
  usePlaybackActions,
  usePlaybackIsPlaying,
  useTimelinePlayback,
} from "@/features/playback";

import { formatFrameTimecode } from "../lib/frame-time";

function TimelinePanel() {
  const { t } = useTranslation();
  const media = useAppSelector(selectSourceMedia);
  const trim = useAppSelector(selectTrim);
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;
  const { currentFrame, framesCount, seekFrame } = useTimelinePlayback(
    frameRate,
    media?.video.frameCount,
  );

  const isPlaying = usePlaybackIsPlaying();
  const { pause, togglePlayback } = usePlaybackActions();

  return (
    <section
      aria-labelledby="timeline-title"
      className="grid h-full min-w-0 grid-rows-[auto_minmax(2rem,1fr)] gap-2 p-3"
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
          <Button
            aria-label={t("preview.frame.previous")}
            disabled={framesCount === 0}
            onClick={() => {
              pause();
              seekFrame(currentFrame - 1);
            }}
            size="icon-sm"
            title={t("preview.frame.previousFrameTooltip")}
            type="button"
            variant="ghost"
          >
            <SkipBack aria-hidden="true" />
          </Button>
          <Button
            aria-label={isPlaying ? t("preview.playback.pause") : t("preview.playback.play")}
            className="rounded-full"
            disabled={framesCount === 0}
            onClick={togglePlayback}
            size="icon-lg"
            title={
              isPlaying ? t("preview.playback.pauseTooltip") : t("preview.playback.playTooltip")
            }
            type="button"
          >
            {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </Button>
          <Button
            aria-label={t("preview.frame.next")}
            disabled={framesCount === 0}
            onClick={() => {
              pause();
              seekFrame(currentFrame + 1);
            }}
            size="icon-sm"
            title={t("preview.frame.nextFrameTooltip")}
            type="button"
            variant="ghost"
          >
            <SkipForward aria-hidden="true" />
          </Button>
        </div>

        <dl
          aria-label={t("timeline.segment.accessibility.trimValues")}
          className="m-0 flex min-w-0 gap-5 justify-self-end"
        >
          <TimelineTimeValue
            frame={trim ? microsToFrame(trim.startMicros, frameRate, framesCount) : 0}
            frameRate={frameRate}
            label={t("timeline.segment.labels.start")}
          />
          <TimelineTimeValue
            frame={trim ? microsToFrame(trim.endMicros, frameRate, framesCount) : 0}
            frameRate={frameRate}
            label={t("timeline.segment.labels.end")}
          />
          <TimelineTimeValue
            frame={
              trim ? microsToFrame(trim.endMicros - trim.startMicros, frameRate, framesCount) : 0
            }
            frameRate={frameRate}
            label={t("timeline.playhead.labels.duration")}
          />
        </dl>
      </div>

      <Slider.Root
        aria-label={t("timeline.playhead.accessibility.playbackPosition")}
        className="h-13 w-full data-disabled:opacity-100"
        disabled={framesCount === 0}
        max={framesCount === 0 ? 1 : framesCount}
        min={0}
        onValueChange={([frame]) => seekFrame(frame ?? 0)}
        step={1}
        value={[currentFrame]}
      >
        <Slider.Track className="segment-markers h-13 rounded-md border bg-muted/30 text-muted" />
        <Slider.Thumb className="h-13 w-4 rounded-none border-0 bg-transparent p-0 shadow-none ring-0 before:absolute before:inset-y-0 before:left-1/2 before:w-0.5 before:-translate-x-1/2 before:bg-foreground before:content-[''] after:top-0 after:left-1/2 after:size-2 after:-translate-1/2 after:rounded-full after:bg-foreground after:content-[''] hover:ring-0 focus-visible:ring-0 focus-visible:before:border-ring focus-visible:before:ring-3 focus-visible:before:ring-ring/50 focus-visible:after:border-ring focus-visible:after:ring-3 focus-visible:after:ring-ring/50 active:ring-0 data-disabled:pointer-events-none data-disabled:before:bg-muted-foreground data-disabled:after:bg-muted-foreground" />
      </Slider.Root>
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
      <dt className="text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="m-0 font-mono text-xs whitespace-nowrap tabular-nums">
        {formatFrameTimecode(frame, frameRate)}
      </dd>
    </div>
  );
}

export { TimelinePanel };
