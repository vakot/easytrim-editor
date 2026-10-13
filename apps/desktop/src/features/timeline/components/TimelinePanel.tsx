import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";

import { usePlaybackTransport, useTimelineFrameState } from "../contexts/timeline-runtime-contexts";
import { frameFromMicros, formatFrameTimecode } from "../lib/frame-time";

function TimelinePanel() {
  const { t } = useTranslation();
  const { currentFrame, framesCount, setCurrentFrame } = useTimelineFrameState();
  const playback = usePlaybackTransport();
  const media = useAppSelector(selectSourceMedia);
  const trim = useAppSelector(selectTrim);
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;

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
              playback.setIsPlaying(false);
              setCurrentFrame(currentFrame - 1);
            }}
            size="icon-sm"
            title={t("preview.frame.previousFrameTooltip")}
            type="button"
            variant="ghost"
          >
            <SkipBack aria-hidden="true" />
          </Button>
          <Button
            aria-label={
              playback.isPlaying ? t("preview.playback.pause") : t("preview.playback.play")
            }
            className="rounded-full"
            disabled={framesCount === 0}
            onClick={() => playback.setIsPlaying(!playback.isPlaying)}
            size="icon-lg"
            title={
              playback.isPlaying
                ? t("preview.playback.pauseTooltip")
                : t("preview.playback.playTooltip")
            }
            type="button"
          >
            {playback.isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </Button>
          <Button
            aria-label={t("preview.frame.next")}
            disabled={framesCount === 0}
            onClick={() => {
              playback.setIsPlaying(false);
              setCurrentFrame(currentFrame + 1);
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
            frameRate={frameRate}
            label={t("timeline.segment.labels.start")}
            frame={trim ? frameFromMicros(trim.startMicros, frameRate) : 0}
          />
          <TimelineTimeValue
            frameRate={frameRate}
            label={t("timeline.segment.labels.end")}
            frame={trim ? frameFromMicros(trim.endMicros, frameRate) : 0}
          />
          <TimelineTimeValue
            frameRate={frameRate}
            label={t("timeline.playhead.labels.duration")}
            frame={trim ? frameFromMicros(trim.endMicros - trim.startMicros, frameRate) : 0}
          />
        </dl>
      </div>

      <Slider.Root
        aria-label={t("timeline.playhead.accessibility.playbackPosition")}
        className="flex min-h-8 w-full items-center"
        disabled={framesCount === 0}
        max={framesCount === 0 ? 1 : framesCount - 1}
        min={0}
        onValueChange={([frame]) => setCurrentFrame(frame ?? 0)}
        step={1}
        value={[currentFrame]}
      >
        <Slider.Track className="h-2 rounded-full" />
        <Slider.Thumb className="h-7 w-1 rounded-none border-0 bg-primary after:-inset-x-3" />
      </Slider.Root>
    </section>
  );
}

function TimelineTimeValue({
  frame,
  label,
  frameRate,
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
