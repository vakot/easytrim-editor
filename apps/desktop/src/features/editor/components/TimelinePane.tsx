import type { ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import type { TrimRange } from "@/domain/trim";
import { timelineGeometryStyle } from "@/features/timeline/utils/timeline-geometry";
import { cn } from "@/lib/utils";

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
      className={cn(
        "size-full min-h-0 min-w-0 overflow-hidden px-5",
        hasAudioTracks && "grid grid-rows-[auto_auto_minmax(0,1fr)]",
      )}
    >
      <div className="min-w-0 py-4" data-testid="timeline-fixed-content">
        {timeline}
      </div>
      {hasAudioTracks ? <Separator /> : null}
      {hasAudioTracks ? (
        <ScrollArea type="auto" className="min-h-0 min-w-0" data-testid="audio-tracks-scroll">
          <div className="min-w-0 py-4">{audioTracks}</div>
        </ScrollArea>
      ) : null}
    </div>
  );
}
