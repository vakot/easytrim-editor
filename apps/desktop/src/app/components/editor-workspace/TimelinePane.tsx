import type { ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import type { TrimRange } from "@/domain/trim";
import { cn } from "@/lib/class-names.utils";
import { timelineGeometryStyle } from "@/lib/interaction/timeline-geometry.utils";

interface TimelinePaneProps {
  audio: ReactNode | null;
  range: TrimRange;
  timeline: ReactNode;
}

export function TimelinePane({ audio, range, timeline }: TimelinePaneProps) {
  const hasAudio = audio !== null;

  return (
    <div
      className={cn(
        "size-full min-h-0 min-w-0 overflow-hidden px-5",
        hasAudio && "grid grid-rows-[auto_auto_minmax(0,1fr)]",
      )}
      data-slot="timeline-pane"
      style={timelineGeometryStyle(range)}
    >
      <div className="min-w-0 py-4" data-testid="timeline-fixed-content">
        {timeline}
      </div>
      {hasAudio ? <Separator /> : null}
      {hasAudio ? (
        <ScrollArea className="min-h-0 min-w-0" data-testid="audio-tracks-scroll" type="auto">
          <div className="min-w-0 py-4">{audio}</div>
        </ScrollArea>
      ) : null}
    </div>
  );
}
