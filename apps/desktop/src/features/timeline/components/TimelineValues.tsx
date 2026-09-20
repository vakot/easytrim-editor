import { useTranslation } from "react-i18next";

import { usePlayback } from "@/app/hooks/usePlayback";
import { useTimeline } from "@/app/hooks/useTimeline";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSourceMedia } from "@/app/store/slices/source-slice";

import { EMPTY_TIMELINE_RANGE } from "../lib/timeline-range";

import styles from "./TimelinePanel.module.css";
import { TimelineTimeValue } from "./TimelineTimeValue";

export function TimelineValues() {
  const { t } = useTranslation();
  const media = useAppSelector(selectSourceMedia);
  const playback = usePlayback();
  const timeline = useTimeline();
  const range = timeline.trim ?? EMPTY_TIMELINE_RANGE;
  const frameRate = media?.video.averageFrameRate ?? media?.video.realFrameRate;
  const disabled = !playback.canInteract;

  return (
    <dl
      aria-label={t("timeline.accessibility.trimValues")}
      className={`${styles.timelineValues} m-0 flex gap-5 justify-self-end`}
      data-slot="timeline-values"
    >
      <TimelineTimeValue
        frameRate={frameRate}
        label={t("timeline.labels.start")}
        micros={disabled ? null : range.startMicros}
      />
      <TimelineTimeValue
        frameRate={frameRate}
        label={t("timeline.labels.end")}
        micros={disabled ? null : range.endMicros}
      />
      <TimelineTimeValue
        frameRate={frameRate}
        label={t("timeline.labels.duration")}
        micros={disabled ? null : range.endMicros - range.startMicros}
      />
    </dl>
  );
}
