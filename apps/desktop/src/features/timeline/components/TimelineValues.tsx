import { useTranslation } from "react-i18next";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { useTimelineReadiness } from "@/features/timeline";
import { cn } from "@/lib/class-names.utils";

import { EMPTY_TIMELINE_RANGE } from "../lib/timeline-range";

import styles from "./TimelinePanel.module.css";
import { TimelineTimeValue } from "./TimelineTimeValue";

function TimelineValues({ className }: { className?: string }) {
  const { t } = useTranslation();
  const media = useAppSelector(selectSourceMedia);
  const readiness = useTimelineReadiness();
  const trim = useAppSelector(selectTrim);
  const range = trim ?? EMPTY_TIMELINE_RANGE;
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;
  const disabled = !readiness.canInteract;

  return (
    <dl
      aria-label={t("timeline.segment.accessibility.trimValues")}
      className={cn(styles.timelineValues, "m-0 flex gap-5 justify-self-end", className)}
      data-slot="timeline-values"
    >
      <TimelineTimeValue
        frameRate={frameRate}
        label={t("timeline.segment.labels.start")}
        micros={disabled ? null : range.startMicros}
      />
      <TimelineTimeValue
        frameRate={frameRate}
        label={t("timeline.segment.labels.end")}
        micros={disabled ? null : range.endMicros}
      />
      <TimelineTimeValue
        frameRate={frameRate}
        label={t("timeline.playhead.labels.duration")}
        micros={disabled ? null : range.endMicros - range.startMicros}
      />
    </dl>
  );
}

export { TimelineValues };
