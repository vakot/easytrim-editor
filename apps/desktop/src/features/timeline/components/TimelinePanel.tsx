import { useTranslation } from "react-i18next";

import { cn } from "@/lib/class-names.utils";

import { PlaybackControls } from "./PlaybackControls";
import { PlaybackTimecode } from "./PlaybackTimecode";
import styles from "./TimelinePanel.module.css";
import { TimelineScale } from "./TimelineScale";
import { TimelineToolbar } from "./TimelineToolbar";
import { TimelineTrack } from "./TimelineTrack";
import { TimelineValues } from "./TimelineValues";

function TimelinePanel() {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="timeline-title"
      className="min-w-0 p-3 select-none"
      data-testid="timeline-fixed-content"
    >
      <div
        className={cn(
          styles.timelineHeader,
          "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6",
        )}
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

      <TimelineScale />

      <div
        className="grid min-w-0 grid-cols-(--editor-timeline-track-grid-columns) items-center gap-2"
        data-slot="timeline-row"
      >
        <TimelineToolbar />
        <TimelineTrack />
      </div>
    </section>
  );
}

export { TimelinePanel };
