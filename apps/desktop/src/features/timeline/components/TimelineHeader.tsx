import { useTranslation } from "react-i18next";

import { PlaybackControls } from "./PlaybackControls";
import { PlaybackTimecode } from "./PlaybackTimecode";
import styles from "./TimelinePanel.module.css";
import { TimelineValues } from "./TimelineValues";

export function TimelineHeader() {
  const { t } = useTranslation();

  return (
    <div
      className={`${styles.timelineHeader} grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6`}
    >
      <div className="min-w-0 justify-self-start">
        <h2
          className="mb-0.5 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
          id="timeline-title"
        >
          {t("timeline.labels.selectedSegment")}
        </h2>
        <PlaybackTimecode />
      </div>
      <PlaybackControls />
      <TimelineValues />
    </div>
  );
}
