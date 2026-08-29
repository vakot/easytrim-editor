import { useTranslation } from "react-i18next";

import { formatPlaybackTime } from "@/domain/playback";
import type { FrameRate } from "@/lib/tauri/media.types";

interface PlaybackTimecodeProps {
  currentMicros: number | null;
  sourceDurationMicros: number | null;
  frameRate?: FrameRate;
}

export function PlaybackTimecode({
  currentMicros,
  sourceDurationMicros,
  frameRate,
}: PlaybackTimecodeProps) {
  const { t } = useTranslation();

  return (
    <output className="font-mono text-xs text-foreground" aria-label={t("preview.currentTime")}>
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
