import type { ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import type { TrimRange } from "@/domain/trim";
import { cn } from "@/lib/class-names";
import { timelineGeometryStyle } from "@/lib/interaction/timeline-geometry";

interface TimelinePaneProps {
  range: TrimRange;
  timeline: ReactNode;
  audio: ReactNode | null;
}

export function TimelinePane({ range, timeline, audio }: TimelinePaneProps) {
  const hasAudio = audio !== null;

  return (
    <div
      data-slot="timeline-pane"
      style={timelineGeometryStyle(range)}
      className={cn(
        "size-full min-h-0 min-w-0 overflow-hidden px-5",
        hasAudio && "grid grid-rows-[auto_auto_minmax(0,1fr)]",
      )}
    >
      <div className="min-w-0 py-4" data-testid="timeline-fixed-content">
        {timeline}
      </div>
      {hasAudio ? <Separator /> : null}
      {hasAudio ? (
        <ScrollArea type="auto" className="min-h-0 min-w-0" data-testid="audio-tracks-scroll">
          <div className="min-w-0 py-4">{audio}</div>
        </ScrollArea>
      ) : null}
    </div>
  );
}
