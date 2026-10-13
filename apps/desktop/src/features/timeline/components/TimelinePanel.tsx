import { useTranslation } from "react-i18next";

import { Slider } from "@/components/ui/slider";

import { useTimelineFrameState } from "../contexts/timeline-runtime-contexts";

function TimelinePanel() {
  const { t } = useTranslation();
  const { currentFrame, framesCount, setCurrentFrame } = useTimelineFrameState();

  return (
    <section aria-label={t("timeline.playhead.accessibility.track")} className="min-w-0 p-3">
      <Slider.Root
        aria-label={t("timeline.playhead.accessibility.playbackPosition")}
        className="flex min-h-8 w-full items-center"
        disabled={framesCount === 0}
        max={Math.max(0, framesCount - 1)}
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

export { TimelinePanel };
