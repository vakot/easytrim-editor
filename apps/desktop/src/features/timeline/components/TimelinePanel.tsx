import { TimelineHeader } from "./TimelineHeader";
import { TimelineScale } from "./TimelineScale";
import { TimelineToolbar } from "./TimelineToolbar";
import { TimelineTrack } from "./TimelineTrack";

export function TimelinePanel() {
  return (
    <section
      aria-labelledby="timeline-title"
      className="min-w-0 p-3 select-none"
      data-testid="timeline-fixed-content"
    >
      <TimelineHeader />
      <TimelineScale />
      <div
        className="grid min-w-0 grid-cols-(--editor-timeline-track-grid-columns) items-center gap-3"
        data-slot="timeline-row"
      >
        <TimelineToolbar />
        <TimelineTrack />
      </div>
    </section>
  );
}
