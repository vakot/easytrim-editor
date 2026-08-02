import type { ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { TrimRange } from "@/domain/trim";
import { timelineGeometryStyle } from "@/features/timeline/utils/timeline-geometry";

interface TimelinePaneProps {
  range: TrimRange;
  timeline: ReactNode;
  audioTracks: ReactNode | null;
}

export function TimelinePane({ range, timeline, audioTracks }: TimelinePaneProps) {
  const hasAudioTracks = audioTracks !== null;

  return (
    <div
      data-slot="timeline-pane"
      style={timelineGeometryStyle(range)}
      className={
        hasAudioTracks
          ? "grid size-full min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden bg-background"
          : "size-full min-h-0 min-w-0 overflow-hidden bg-background"
      }
    >
      <div className="min-w-0" data-testid="timeline-fixed-content">
        {timeline}
      </div>
      {hasAudioTracks ? <hr className="border-t border-border mx-5" /> : null}
      {hasAudioTracks ? (
        <ScrollArea type="auto" className="min-h-0 min-w-0" data-testid="audio-tracks-scroll">
          <div className="min-w-0 px-5 pb-5">{audioTracks}</div>
        </ScrollArea>
      ) : null}
    </div>
  );
}
