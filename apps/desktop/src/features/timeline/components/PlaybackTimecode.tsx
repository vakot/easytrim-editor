import { useTranslation } from "react-i18next";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { formatPlaybackTime } from "@/domain/playback";
import { useTimeline, useTimelinePlayback } from "@/features/timeline";

import { EMPTY_TIMELINE_RANGE } from "../lib/timeline-range";

function PlaybackTimecode() {
  const { t } = useTranslation();
  const media = useAppSelector(selectSourceMedia);
  const playback = useTimelinePlayback();
  const timeline = useTimeline();
  const range = timeline.trim ?? EMPTY_TIMELINE_RANGE;
  const currentMicros = playback.canInteract ? timeline.playheadMicros : null;
  const sourceDurationMicros = playback.canInteract ? range.sourceDurationMicros : null;
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;

  return (
    <output
      aria-label={t("preview.accessibility.currentTime")}
      className="font-mono text-xs text-foreground"
    >
      {currentMicros === null ? "00:00:00:00f" : formatPlaybackTime(currentMicros, frameRate)}
      <span className="text-muted-foreground">
        {" "}
        /{" "}
        {sourceDurationMicros === null
          ? "00:00:00:00f"
          : formatPlaybackTime(sourceDurationMicros, frameRate)}
      </span>
    </output>
  );
}

export { PlaybackTimecode };
