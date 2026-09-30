import { useTranslation } from "react-i18next";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { formatPlaybackTime } from "@/domain/playback";
import { useTimelineReadiness } from "@/features/timeline";

function TimelineScale() {
  const { t } = useTranslation();
  const media = useAppSelector(selectSourceMedia);
  const trim = useAppSelector(selectTrim);
  const readiness = useTimelineReadiness();
  const sourceDurationMicros = trim?.sourceDurationMicros ?? 0;
  const disabled = !readiness.canInteract;
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;

  return (
    <div
      aria-hidden="true"
      className="mt-3 mb-1 grid min-w-0 grid-cols-(--editor-timeline-track-grid-columns) items-end gap-3"
    >
      <span
        className="text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase"
        data-slot="timeline-tools-title"
      >
        {t("timeline.labels.tools")}
      </span>
      <div className="flex justify-between font-mono text-[0.625rem] text-muted-foreground">
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <span key={fraction}>
            {disabled
              ? "00:00:00:00f"
              : formatPlaybackTime(Math.round(sourceDurationMicros * fraction), frameRate)}
          </span>
        ))}
      </div>
    </div>
  );
}

export { TimelineScale };
