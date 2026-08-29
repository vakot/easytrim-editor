import { useTranslation } from "react-i18next";

import { formatPlaybackTime } from "@/domain/playback";
import type { FrameRate } from "@/lib/tauri/media.types";

interface PlaybackTimecodeProps {
  currentMicros: number | null;
  frameRate?: FrameRate;
  sourceDurationMicros: number | null;
}

export function PlaybackTimecode({
  currentMicros,
  frameRate,
  sourceDurationMicros,
}: PlaybackTimecodeProps) {
  const { t } = useTranslation();

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
